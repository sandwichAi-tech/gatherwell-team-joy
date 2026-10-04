-- ===== Security cleanup =====
DROP FUNCTION IF EXISTS public.create_guest_rsvp(uuid,text,text,text,text,integer,boolean,boolean);
REVOKE EXECUTE ON FUNCTION public.event_going_count(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.event_going_count(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_member_role(), public.set_new_gathering_coords(), public.gathering_validate(jsonb) FROM PUBLIC, anon, authenticated;

CREATE TABLE public.rsvp_attempts (key text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.rsvp_attempts TO service_role;
ALTER TABLE public.rsvp_attempts ENABLE ROW LEVEL SECURITY;
CREATE INDEX ON public.rsvp_attempts (key, created_at);

ALTER TABLE public.rsvps ADD COLUMN IF NOT EXISTS is_walk_in boolean NOT NULL DEFAULT false;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS completed_at timestamptz;

CREATE OR REPLACE FUNCTION public.rsvp_event(_event_id uuid, _first text, _last text, _phone text, _email text,
  _language text, _plus_ones int, _status text, _sms boolean, _mail boolean)
RETURNS TABLE (code text, status text) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e record; _name text; _uid uuid := auth.uid(); _st text; _id uuid; _code text;
  _ex_id uuid; _ex_status text; _ex_plus int; _held int := 0; _ip text; _ph text;
BEGIN
  _name := trim(coalesce(_first,'') || ' ' || coalesce(_last,''));
  IF coalesce(trim(_first),'') = '' OR length(_name) > 120 THEN RAISE EXCEPTION 'name_required'; END IF;
  IF nullif(trim(_phone),'') IS NULL AND nullif(trim(_email),'') IS NULL THEN RAISE EXCEPTION 'contact_required'; END IF;
  IF length(coalesce(_phone,'')) > 30 OR length(coalesce(_email,'')) > 200 THEN RAISE EXCEPTION 'too_long'; END IF;
  IF nullif(trim(_email),'') IS NOT NULL AND trim(_email) !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'invalid_email'; END IF;
  IF _status NOT IN ('going','maybe') THEN RAISE EXCEPTION 'invalid_status'; END IF;
  _ip := 'ip:' || trim(split_part(coalesce(current_setting('request.headers', true)::json->>'x-forwarded-for', 'unknown'), ',', 1));
  _ph := 'phone:' || regexp_replace(coalesce(_phone,''), '\D', '', 'g');
  DELETE FROM public.rsvp_attempts WHERE created_at < now() - interval '1 day';
  IF (SELECT count(*) FROM public.rsvp_attempts WHERE key = _ip AND created_at > now() - interval '1 minute') >= 10
     OR (_ph <> 'phone:' AND (SELECT count(*) FROM public.rsvp_attempts WHERE key = _ph AND created_at > now() - interval '1 minute') >= 10) THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;
  SELECT * INTO e FROM public.events WHERE id = _event_id FOR UPDATE;
  IF NOT FOUND OR e.status <> 'published' OR NOT (e.visibility = 'public' OR (_uid IS NOT NULL AND public.can_rsvp_event(_event_id))) THEN
    RAISE EXCEPTION 'not_open';
  END IF;
  _plus_ones := greatest(0, least(coalesce(_plus_ones,0), 3));
  _st := _status;
  IF _uid IS NOT NULL THEN
    SELECT r.id, r.status, r.plus_ones INTO _ex_id, _ex_status, _ex_plus FROM public.rsvps r WHERE r.event_id = _event_id AND r.user_id = _uid LIMIT 1;
  END IF;
  IF _ex_id IS NOT NULL AND _ex_status = 'going' THEN _held := 1 + _ex_plus; END IF;
  IF _st = 'going' AND e.capacity IS NOT NULL AND public.event_seats_used(_event_id) - _held + 1 + _plus_ones > e.capacity THEN
    _st := 'waitlist';
  END IF;
  IF _ex_id IS NOT NULL THEN
    UPDATE public.rsvps r SET guest_name = _name, guest_phone = nullif(trim(_phone),''), guest_email = nullif(trim(_email),''),
      language = CASE WHEN _language = 'es' THEN 'es' ELSE 'en' END, plus_ones = _plus_ones, status = _st,
      sms_opt_in = coalesce(_sms,false), email_opt_in = coalesce(_mail,false)
    WHERE r.id = _ex_id RETURNING r.id, r.checkin_code INTO _id, _code;
  ELSE
    INSERT INTO public.rsvps (event_id, user_id, guest_name, guest_phone, guest_email, language, plus_ones, status, sms_opt_in, email_opt_in)
    VALUES (_event_id, _uid, _name, nullif(trim(_phone),''), nullif(trim(_email),''), CASE WHEN _language = 'es' THEN 'es' ELSE 'en' END,
      _plus_ones, _st, coalesce(_sms,false), coalesce(_mail,false))
    RETURNING rsvps.id, rsvps.checkin_code INTO _id, _code;
  END IF;
  INSERT INTO public.rsvp_attempts (key) VALUES (_ip);
  IF _ph <> 'phone:' THEN INSERT INTO public.rsvp_attempts (key) VALUES (_ph); END IF;
  PERFORM public.queue_rsvp_notices(_id, CASE WHEN _st = 'waitlist' THEN 'rsvp_waitlisted' ELSE 'rsvp_confirmed' END);
  RETURN QUERY SELECT _code, _st;
END; $$;

-- ===== Visibility helper (public published, or team member) =====
CREATE OR REPLACE FUNCTION public.can_view_event(_event_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.events e WHERE e.id = _event_id AND (
    (e.visibility = 'public' AND e.status IN ('published','cancelled'))
    OR (auth.uid() IS NOT NULL AND public.is_team_member(e.team_id, ARRAY['leader','host','member']))));
$$;

-- ===== Live counts (no names, no contact details) =====
CREATE TABLE public.event_live_counts (
  event_id uuid PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
  going int NOT NULL DEFAULT 0, checked_in int NOT NULL DEFAULT 0, walk_ins int NOT NULL DEFAULT 0, waitlist int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.event_live_counts TO anon, authenticated;
GRANT ALL ON public.event_live_counts TO service_role;
ALTER TABLE public.event_live_counts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read counts of visible gatherings" ON public.event_live_counts FOR SELECT TO anon, authenticated USING (public.can_view_event(event_id));

CREATE OR REPLACE FUNCTION public.refresh_live_counts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _ev uuid := coalesce(NEW.event_id, OLD.event_id);
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.events WHERE id = _ev) THEN RETURN NULL; END IF;
  INSERT INTO public.event_live_counts (event_id, going, checked_in, walk_ins, waitlist, updated_at)
  SELECT _ev,
    coalesce(sum(1 + plus_ones) FILTER (WHERE status = 'going'),0),
    count(*) FILTER (WHERE checked_in_at IS NOT NULL),
    count(*) FILTER (WHERE is_walk_in),
    count(*) FILTER (WHERE status = 'waitlist'), now()
  FROM public.rsvps WHERE event_id = _ev
  ON CONFLICT (event_id) DO UPDATE SET going = EXCLUDED.going, checked_in = EXCLUDED.checked_in, walk_ins = EXCLUDED.walk_ins, waitlist = EXCLUDED.waitlist, updated_at = now();
  RETURN NULL;
END; $$;
CREATE TRIGGER rsvp_live_counts AFTER INSERT OR UPDATE OR DELETE ON public.rsvps FOR EACH ROW EXECUTE FUNCTION public.refresh_live_counts();
INSERT INTO public.event_live_counts (event_id, going, checked_in, walk_ins, waitlist)
SELECT e.id, coalesce(sum(1 + r.plus_ones) FILTER (WHERE r.status = 'going'),0), count(r.id) FILTER (WHERE r.checked_in_at IS NOT NULL), 0, count(r.id) FILTER (WHERE r.status = 'waitlist')
FROM public.events e LEFT JOIN public.rsvps r ON r.event_id = e.id GROUP BY e.id ON CONFLICT DO NOTHING;

-- ===== Grouped check-in wins =====
CREATE OR REPLACE FUNCTION public.log_checkin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _team uuid; _title text; _act uuid;
BEGIN
  IF NEW.checked_in_at IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.checked_in_at IS NULL) THEN
    SELECT team_id, title INTO _team, _title FROM public.events WHERE id = NEW.event_id;
    SELECT id INTO _act FROM public.activity WHERE team_id = _team AND type = 'checked_in' AND payload->>'event_id' = NEW.event_id::text
      AND created_at > now() - interval '12 hours' ORDER BY created_at DESC LIMIT 1;
    IF _act IS NOT NULL THEN
      UPDATE public.activity SET payload = jsonb_set(payload, '{count}', to_jsonb(coalesce((payload->>'count')::int, 1) + 1)) WHERE id = _act;
    ELSE
      INSERT INTO public.activity (team_id, actor_id, type, payload)
      VALUES (_team, NEW.user_id, 'checked_in', jsonb_build_object('event_id', NEW.event_id, 'title', _title, 'count', 1,
        'guest', CASE WHEN NEW.user_id IS NULL THEN split_part(coalesce(NEW.guest_name,''), ' ', 1) END));
    END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_rsvp_inserted_checked_in AFTER INSERT ON public.rsvps FOR EACH ROW EXECUTE FUNCTION public.log_checkin();

-- ===== Check-in actions (host or leader only) =====
CREATE OR REPLACE FUNCTION public.check_in_code(_event uuid, _code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  IF NOT public.can_manage_event(_event) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  SELECT id, guest_name, status, checked_in_at, plus_ones INTO r FROM public.rsvps WHERE event_id = _event AND checkin_code = trim(_code);
  IF NOT FOUND THEN RETURN jsonb_build_object('result', 'not_found'); END IF;
  IF r.checked_in_at IS NOT NULL THEN RETURN jsonb_build_object('result', 'already', 'name', r.guest_name, 'at', r.checked_in_at); END IF;
  UPDATE public.rsvps SET checked_in_at = now(), status = 'going' WHERE id = r.id;
  RETURN jsonb_build_object('result', 'ok', 'name', r.guest_name, 'plus_ones', r.plus_ones);
END; $$;

CREATE OR REPLACE FUNCTION public.check_in_rsvp(_rsvp uuid, _undo boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _ev uuid;
BEGIN
  SELECT event_id INTO _ev FROM public.rsvps WHERE id = _rsvp;
  IF _ev IS NULL OR NOT public.can_manage_event(_ev) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  IF _undo THEN UPDATE public.rsvps SET checked_in_at = NULL WHERE id = _rsvp;
  ELSE UPDATE public.rsvps SET checked_in_at = coalesce(checked_in_at, now()), status = 'going' WHERE id = _rsvp; END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.add_walk_in(_event uuid, _first text, _last text, _phone text, _email text, _sms boolean, _mail boolean, _language text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _name text := trim(coalesce(_first,'') || ' ' || coalesce(_last,'')); _id uuid;
BEGIN
  IF NOT public.can_manage_event(_event) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  IF coalesce(trim(_first),'') = '' OR length(_name) > 120 THEN RAISE EXCEPTION 'name_required'; END IF;
  IF nullif(trim(_phone),'') IS NULL AND nullif(trim(_email),'') IS NULL THEN RAISE EXCEPTION 'contact_required'; END IF;
  IF length(coalesce(_phone,'')) > 30 OR length(coalesce(_email,'')) > 200 THEN RAISE EXCEPTION 'too_long'; END IF;
  INSERT INTO public.rsvps (event_id, guest_name, guest_phone, guest_email, language, status, is_walk_in, checked_in_at, sms_opt_in, email_opt_in)
  VALUES (_event, _name, nullif(trim(_phone),''), nullif(trim(_email),''), CASE WHEN _language = 'es' THEN 'es' ELSE 'en' END,
    'going', true, now(), coalesce(_sms,false), coalesce(_mail,false)) RETURNING id INTO _id;
  RETURN _id;
END; $$;

-- ===== Polls =====
CREATE TABLE public.event_polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  question text NOT NULL CHECK (length(question) BETWEEN 1 AND 200),
  created_by uuid DEFAULT auth.uid(),
  closed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.event_poll_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.event_polls(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  label text NOT NULL CHECK (length(label) BETWEEN 1 AND 80),
  position int NOT NULL DEFAULT 0,
  votes int NOT NULL DEFAULT 0
);
CREATE TABLE public.event_poll_votes (
  poll_id uuid NOT NULL REFERENCES public.event_polls(id) ON DELETE CASCADE,
  rsvp_id uuid NOT NULL REFERENCES public.rsvps(id) ON DELETE CASCADE,
  option_id uuid NOT NULL REFERENCES public.event_poll_options(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (poll_id, rsvp_id)
);
GRANT SELECT ON public.event_polls, public.event_poll_options TO anon, authenticated;
GRANT UPDATE, DELETE ON public.event_polls TO authenticated;
GRANT ALL ON public.event_polls, public.event_poll_options, public.event_poll_votes TO service_role;
ALTER TABLE public.event_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_poll_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read polls of visible gatherings" ON public.event_polls FOR SELECT TO anon, authenticated USING (public.can_view_event(event_id));
CREATE POLICY "Hosts close polls" ON public.event_polls FOR UPDATE TO authenticated USING (public.can_manage_event(event_id)) WITH CHECK (public.can_manage_event(event_id));
CREATE POLICY "Hosts delete polls" ON public.event_polls FOR DELETE TO authenticated USING (public.can_manage_event(event_id));
CREATE POLICY "Read poll options of visible gatherings" ON public.event_poll_options FOR SELECT TO anon, authenticated USING (public.can_view_event(event_id));

CREATE OR REPLACE FUNCTION public.create_poll(_event uuid, _question text, _options text[])
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid; _i int := 0; _o text;
BEGIN
  IF NOT public.can_manage_event(_event) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  IF coalesce(trim(_question),'') = '' OR length(_question) > 200 THEN RAISE EXCEPTION 'invalid_question'; END IF;
  _options := ARRAY(SELECT trim(x) FROM unnest(_options) x WHERE trim(x) <> '');
  IF array_length(_options,1) IS NULL OR array_length(_options,1) < 2 OR array_length(_options,1) > 5 THEN RAISE EXCEPTION 'invalid_options'; END IF;
  INSERT INTO public.event_polls (event_id, question) VALUES (_event, trim(_question)) RETURNING id INTO _id;
  FOREACH _o IN ARRAY _options LOOP
    IF length(_o) > 80 THEN RAISE EXCEPTION 'too_long'; END IF;
    INSERT INTO public.event_poll_options (poll_id, event_id, label, position) VALUES (_id, _event, _o, _i);
    _i := _i + 1;
  END LOOP;
  RETURN _id;
END; $$;

CREATE OR REPLACE FUNCTION public.vote_poll(_code text, _option uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o record; r record; _prev uuid;
BEGIN
  SELECT op.id, op.poll_id, op.event_id, p.closed INTO o FROM public.event_poll_options op JOIN public.event_polls p ON p.id = op.poll_id WHERE op.id = _option;
  IF NOT FOUND OR o.closed THEN RAISE EXCEPTION 'poll_closed'; END IF;
  SELECT id INTO r FROM public.rsvps WHERE checkin_code = _code AND length(_code) >= 16 AND event_id = o.event_id AND status IN ('going','maybe');
  IF NOT FOUND THEN RAISE EXCEPTION 'rsvp_required'; END IF;
  SELECT option_id INTO _prev FROM public.event_poll_votes WHERE poll_id = o.poll_id AND rsvp_id = r.id;
  IF _prev IS NOT NULL THEN RAISE EXCEPTION 'already_voted'; END IF;
  INSERT INTO public.event_poll_votes (poll_id, rsvp_id, option_id) VALUES (o.poll_id, r.id, _option);
  UPDATE public.event_poll_options SET votes = votes + 1 WHERE id = _option;
END; $$;

CREATE OR REPLACE FUNCTION public.my_poll_votes(_code text, _event uuid)
RETURNS TABLE (poll_id uuid, option_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT v.poll_id, v.option_id FROM public.event_poll_votes v JOIN public.rsvps r ON r.id = v.rsvp_id
  WHERE r.checkin_code = _code AND length(_code) >= 16 AND r.event_id = _event;
$$;

-- ===== Photo roll =====
CREATE TABLE public.event_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  path text NOT NULL,
  uploaded_by uuid,
  rsvp_id uuid REFERENCES public.rsvps(id) ON DELETE SET NULL,
  hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.event_photos TO authenticated;
GRANT ALL ON public.event_photos TO service_role;
ALTER TABLE public.event_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Hosts read all photos" ON public.event_photos FOR SELECT TO authenticated USING (public.can_manage_event(event_id));
CREATE POLICY "Hosts hide photos" ON public.event_photos FOR UPDATE TO authenticated USING (public.can_manage_event(event_id)) WITH CHECK (public.can_manage_event(event_id));

-- ===== After-gathering summary =====
CREATE OR REPLACE FUNCTION public.event_summary(_event uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e record; _out jsonb;
BEGIN
  IF NOT public.can_manage_event(_event) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  SELECT * INTO e FROM public.events WHERE id = _event;
  IF e.completed_at IS NULL AND e.status = 'published' AND coalesce(e.ends_at, e.starts_at + interval '1 hour') < now() THEN
    UPDATE public.events SET completed_at = now() WHERE id = _event;
  END IF;
  SELECT jsonb_build_object(
    'rsvps', count(*) FILTER (WHERE r.status <> 'cancelled' AND NOT r.is_walk_in),
    'checkins', count(*) FILTER (WHERE r.checked_in_at IS NOT NULL),
    'walk_ins', count(*) FILTER (WHERE r.is_walk_in),
    'first_timers', count(*) FILTER (WHERE r.checked_in_at IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.rsvps o JOIN public.events oe ON oe.id = o.event_id
      WHERE oe.team_id = e.team_id AND o.event_id <> _event AND o.checked_in_at IS NOT NULL AND o.checked_in_at < r.checked_in_at
        AND ((r.user_id IS NOT NULL AND o.user_id = r.user_id) OR (r.guest_phone IS NOT NULL AND o.guest_phone = r.guest_phone) OR (r.guest_email IS NOT NULL AND lower(o.guest_email) = lower(r.guest_email))))),
    'photos', (SELECT count(*) FROM public.event_photos p WHERE p.event_id = _event AND NOT p.hidden),
    'ended', coalesce(e.ends_at, e.starts_at + interval '1 hour') < now())
  INTO _out FROM public.rsvps r WHERE r.event_id = _event;
  RETURN _out;
END; $$;

-- ===== Grants =====
REVOKE EXECUTE ON FUNCTION public.refresh_live_counts() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.can_view_event(uuid), public.check_in_code(uuid,text), public.check_in_rsvp(uuid,boolean),
  public.add_walk_in(uuid,text,text,text,text,boolean,boolean,text), public.create_poll(uuid,text,text[]), public.vote_poll(text,uuid),
  public.my_poll_votes(text,uuid), public.event_summary(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_in_code(uuid,text), public.check_in_rsvp(uuid,boolean), public.add_walk_in(uuid,text,text,text,text,boolean,boolean,text),
  public.create_poll(uuid,text,text[]), public.event_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_event(uuid), public.vote_poll(text,uuid), public.my_poll_votes(text,uuid) TO anon, authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.event_live_counts, public.event_poll_options, public.rsvps;