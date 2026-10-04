ALTER TABLE public.events ADD COLUMN IF NOT EXISTS hide_guest_list boolean NOT NULL DEFAULT false;

CREATE TABLE public.notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  rsvp_id uuid REFERENCES public.rsvps(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('sms','email')),
  recipient text NOT NULL,
  template text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  send_after timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'simulated',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.notification_outbox TO authenticated;
GRANT ALL ON public.notification_outbox TO service_role;
ALTER TABLE public.notification_outbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Hosts and leaders read outbox" ON public.notification_outbox FOR SELECT TO authenticated
  USING (event_id IS NOT NULL AND public.can_manage_event(event_id));
CREATE INDEX ON public.notification_outbox (status, send_after);

-- Queue confirmation + 24h reminder for opted-in channels.
CREATE OR REPLACE FUNCTION public.queue_rsvp_notices(_rsvp uuid, _template text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; e record; _p jsonb;
BEGIN
  SELECT * INTO r FROM public.rsvps WHERE id = _rsvp;
  SELECT * INTO e FROM public.events WHERE id = r.event_id;
  IF r IS NULL OR e IS NULL THEN RETURN; END IF;
  _p := jsonb_build_object('title', e.title, 'starts_at', e.starts_at, 'timezone', e.timezone, 'name', r.guest_name,
    'language', r.language, 'code', r.checkin_code, 'status', r.status);
  IF r.sms_opt_in AND r.guest_phone IS NOT NULL THEN
    INSERT INTO public.notification_outbox (event_id, rsvp_id, channel, recipient, template, payload) VALUES (e.id, r.id, 'sms', r.guest_phone, _template, _p);
    IF _template = 'rsvp_confirmed' AND e.starts_at - interval '24 hours' > now() THEN
      INSERT INTO public.notification_outbox (event_id, rsvp_id, channel, recipient, template, payload, send_after) VALUES (e.id, r.id, 'sms', r.guest_phone, 'reminder_24h', _p, e.starts_at - interval '24 hours');
    END IF;
  END IF;
  IF r.email_opt_in AND r.guest_email IS NOT NULL THEN
    INSERT INTO public.notification_outbox (event_id, rsvp_id, channel, recipient, template, payload) VALUES (e.id, r.id, 'email', r.guest_email, _template, _p);
    IF _template = 'rsvp_confirmed' AND e.starts_at - interval '24 hours' > now() THEN
      INSERT INTO public.notification_outbox (event_id, rsvp_id, channel, recipient, template, payload, send_after) VALUES (e.id, r.id, 'email', r.guest_email, 'reminder_24h', _p, e.starts_at - interval '24 hours');
    END IF;
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.event_seats_used(_event uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(sum(1 + plus_ones),0)::int FROM public.rsvps WHERE event_id = _event AND status = 'going';
$$;

-- Move waitlisted guests in while there is room.
CREATE OR REPLACE FUNCTION public.promote_waitlist(_event uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _cap int; w record;
BEGIN
  SELECT capacity INTO _cap FROM public.events WHERE id = _event FOR UPDATE;
  FOR w IN SELECT id, plus_ones FROM public.rsvps WHERE event_id = _event AND status = 'waitlist' ORDER BY created_at LOOP
    IF _cap IS NOT NULL AND public.event_seats_used(_event) + 1 + w.plus_ones > _cap THEN EXIT; END IF;
    UPDATE public.rsvps SET status = 'going' WHERE id = w.id;
    PERFORM public.queue_rsvp_notices(w.id, 'waitlist_promoted');
  END LOOP;
END; $$;

CREATE OR REPLACE FUNCTION public.on_rsvp_freed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.status = 'going' AND NEW.status <> 'going' THEN PERFORM public.promote_waitlist(NEW.event_id);
  ELSIF OLD.status = 'going' AND NEW.plus_ones < OLD.plus_ones THEN PERFORM public.promote_waitlist(NEW.event_id); END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER rsvp_freed AFTER UPDATE OF status, plus_ones ON public.rsvps FOR EACH ROW EXECUTE FUNCTION public.on_rsvp_freed();

-- Team win when guests reach 10 / 25 / 50.
CREATE OR REPLACE FUNCTION public.log_guest_milestone()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _used int; _m int; e record;
BEGIN
  IF NEW.status <> 'going' THEN RETURN NEW; END IF;
  _used := public.event_seats_used(NEW.event_id);
  SELECT id, team_id, host_id, title INTO e FROM public.events WHERE id = NEW.event_id;
  FOREACH _m IN ARRAY ARRAY[10,25,50] LOOP
    IF _used >= _m AND NOT EXISTS (SELECT 1 FROM public.activity WHERE team_id = e.team_id AND type = 'guest_milestone'
        AND payload->>'event_id' = e.id::text AND (payload->>'guests')::int = _m) THEN
      INSERT INTO public.activity (team_id, actor_id, type, payload)
      VALUES (e.team_id, e.host_id, 'guest_milestone', jsonb_build_object('event_id', e.id, 'title', e.title, 'guests', _m));
    END IF;
  END LOOP;
  RETURN NEW;
END; $$;
CREATE TRIGGER rsvp_guest_milestone AFTER INSERT OR UPDATE OF status, plus_ones ON public.rsvps FOR EACH ROW EXECUTE FUNCTION public.log_guest_milestone();

-- Public page data: no contact details, initials only.
CREATE OR REPLACE FUNCTION public.get_public_event(_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE e record; _host jsonb; _team text; _initials jsonb; _used int; _mine text;
BEGIN
  SELECT * INTO e FROM public.events WHERE id = _id AND status IN ('published','cancelled')
    AND (visibility = 'public' OR public.is_team_member(team_id, ARRAY['leader','host','member']));
  IF e IS NULL THEN RETURN NULL; END IF;
  SELECT jsonb_build_object('name', p.full_name, 'avatar_url', p.avatar_url) INTO _host FROM public.profiles p WHERE p.id = e.host_id;
  SELECT name INTO _team FROM public.teams WHERE id = e.team_id;
  _used := public.event_seats_used(_id);
  IF NOT e.hide_guest_list THEN
    SELECT coalesce(jsonb_agg(i), '[]'::jsonb) INTO _initials FROM (
      SELECT upper(left(coalesce(r.guest_name, p.full_name, '?'),1) ||
        coalesce(left(nullif(split_part(trim(coalesce(r.guest_name, p.full_name, '')), ' ', 2),''),1),'')) AS i
      FROM public.rsvps r LEFT JOIN public.profiles p ON p.id = r.user_id
      WHERE r.event_id = _id AND r.status = 'going' ORDER BY r.created_at LIMIT 8) s;
  END IF;
  IF auth.uid() IS NOT NULL THEN
    SELECT checkin_code INTO _mine FROM public.rsvps WHERE event_id = _id AND user_id = auth.uid() AND status <> 'cancelled' LIMIT 1;
  END IF;
  RETURN jsonb_build_object('id', e.id, 'title', e.title, 'description_en', e.description_en, 'description_es', e.description_es,
    'cover_url', e.cover_url, 'cover_style', e.cover_style, 'starts_at', e.starts_at, 'ends_at', e.ends_at, 'timezone', e.timezone,
    'location_name', e.location_name, 'address', e.address, 'meeting_note', e.meeting_note, 'lat', e.lat, 'lng', e.lng,
    'is_online', e.online_url IS NOT NULL AND e.location_name IS NULL AND e.address IS NULL, 'has_online', e.online_url IS NOT NULL,
    'capacity', e.capacity, 'status', e.status, 'hide_guest_list', e.hide_guest_list, 'going', _used, 'initials', _initials,
    'host', _host, 'team_name', _team, 'my_code', _mine);
END; $$;

CREATE OR REPLACE FUNCTION public.rsvp_event(_event_id uuid, _first text, _last text, _phone text, _email text,
  _language text, _plus_ones int, _status text, _sms boolean, _mail boolean)
RETURNS TABLE (code text, status text) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e record; _name text; _uid uuid := auth.uid(); _st text; _id uuid; _code text; _existing record; _held int;
BEGIN
  _name := trim(coalesce(_first,'') || ' ' || coalesce(_last,''));
  IF coalesce(trim(_first),'') = '' OR length(_name) > 120 THEN RAISE EXCEPTION 'name_required'; END IF;
  IF nullif(trim(_phone),'') IS NULL AND nullif(trim(_email),'') IS NULL THEN RAISE EXCEPTION 'contact_required'; END IF;
  IF length(coalesce(_phone,'')) > 30 OR length(coalesce(_email,'')) > 200 THEN RAISE EXCEPTION 'too_long'; END IF;
  IF nullif(trim(_email),'') IS NOT NULL AND trim(_email) !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'invalid_email'; END IF;
  IF _status NOT IN ('going','maybe') THEN RAISE EXCEPTION 'invalid_status'; END IF;
  SELECT * INTO e FROM public.events WHERE id = _event_id FOR UPDATE;
  IF e IS NULL OR e.status <> 'published' OR NOT (e.visibility = 'public' OR (_uid IS NOT NULL AND public.can_rsvp_event(_event_id))) THEN
    RAISE EXCEPTION 'not_open';
  END IF;
  _plus_ones := greatest(0, least(coalesce(_plus_ones,0), 3));
  _st := _status;
  IF _uid IS NOT NULL THEN
    SELECT * INTO _existing FROM public.rsvps r WHERE r.event_id = _event_id AND r.user_id = _uid LIMIT 1;
  END IF;
  _held := 0;
  IF _existing.id IS NOT NULL AND _existing.status = 'going' THEN _held := 1 + _existing.plus_ones; END IF;
  IF _st = 'going' AND e.capacity IS NOT NULL AND public.event_seats_used(_event_id) - _held + 1 + _plus_ones > e.capacity THEN
    _st := 'waitlist';
  END IF;
  IF _existing.id IS NOT NULL THEN
    UPDATE public.rsvps r SET guest_name = _name, guest_phone = nullif(trim(_phone),''), guest_email = nullif(trim(_email),''),
      language = CASE WHEN _language = 'es' THEN 'es' ELSE 'en' END, plus_ones = _plus_ones, status = _st,
      sms_opt_in = coalesce(_sms,false), email_opt_in = coalesce(_mail,false)
    WHERE r.id = _existing.id RETURNING r.id, r.checkin_code INTO _id, _code;
  ELSE
    INSERT INTO public.rsvps (event_id, user_id, guest_name, guest_phone, guest_email, language, plus_ones, status, sms_opt_in, email_opt_in)
    VALUES (_event_id, _uid, _name, nullif(trim(_phone),''), nullif(trim(_email),''), CASE WHEN _language = 'es' THEN 'es' ELSE 'en' END,
      _plus_ones, _st, coalesce(_sms,false), coalesce(_mail,false))
    RETURNING rsvps.id, rsvps.checkin_code INTO _id, _code;
  END IF;
  PERFORM public.queue_rsvp_notices(_id, CASE WHEN _st = 'waitlist' THEN 'rsvp_waitlisted' ELSE 'rsvp_confirmed' END);
  RETURN QUERY SELECT _code, _st;
END; $$;

DROP FUNCTION IF EXISTS public.get_rsvp_by_code(text);
CREATE FUNCTION public.get_rsvp_by_code(_code text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('id', r.id, 'event_id', r.event_id, 'guest_name', r.guest_name, 'plus_ones', r.plus_ones, 'status', r.status,
    'checkin_code', r.checkin_code, 'checked_in_at', r.checked_in_at, 'language', r.language,
    'event', jsonb_build_object('id', e.id, 'title', e.title, 'starts_at', e.starts_at, 'ends_at', e.ends_at, 'timezone', e.timezone,
      'location_name', e.location_name, 'address', e.address, 'meeting_note', e.meeting_note, 'lat', e.lat, 'lng', e.lng,
      'online_url', CASE WHEN r.status IN ('going','maybe') THEN e.online_url END, 'cover_url', e.cover_url, 'cover_style', e.cover_style,
      'status', e.status, 'capacity', e.capacity, 'description_en', e.description_en, 'description_es', e.description_es))
  FROM public.rsvps r JOIN public.events e ON e.id = r.event_id
  WHERE r.checkin_code = _code AND length(_code) >= 16;
$$;

CREATE OR REPLACE FUNCTION public.update_rsvp_by_code(_code text, _status text, _plus_ones int)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; e record; _st text; _plus int; _mine int;
BEGIN
  IF length(coalesce(_code,'')) < 16 OR _status NOT IN ('going','maybe') THEN RAISE EXCEPTION 'invalid'; END IF;
  SELECT * INTO r FROM public.rsvps WHERE checkin_code = _code;
  IF r IS NULL OR r.status = 'cancelled' THEN RAISE EXCEPTION 'not_found'; END IF;
  SELECT * INTO e FROM public.events WHERE id = r.event_id FOR UPDATE;
  IF e.status <> 'published' THEN RAISE EXCEPTION 'not_open'; END IF;
  _plus := greatest(0, least(coalesce(_plus_ones,0), 3));
  _st := _status;
  _mine := 0;
  IF r.status = 'going' THEN _mine := 1 + r.plus_ones; END IF;
  IF _st = 'going' AND e.capacity IS NOT NULL AND public.event_seats_used(e.id) - _mine + 1 + _plus > e.capacity THEN
    IF r.status = 'going' AND _plus <= r.plus_ones THEN _st := 'going'; ELSE _st := 'waitlist'; END IF;
  END IF;
  UPDATE public.rsvps SET status = _st, plus_ones = _plus WHERE id = r.id;
  RETURN _st;
END; $$;

CREATE OR REPLACE FUNCTION public.cancel_rsvp_by_code(_code text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF length(coalesce(_code,'')) < 16 THEN RETURN false; END IF;
  UPDATE public.rsvps SET status = 'cancelled' WHERE checkin_code = _code AND status <> 'cancelled';
  RETURN FOUND;
END; $$;

REVOKE EXECUTE ON FUNCTION public.queue_rsvp_notices(uuid,text), public.promote_waitlist(uuid), public.event_seats_used(uuid),
  public.on_rsvp_freed(), public.log_guest_milestone() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_public_event(uuid), public.rsvp_event(uuid,text,text,text,text,text,int,text,boolean,boolean),
  public.get_rsvp_by_code(text), public.update_rsvp_by_code(text,text,int), public.cancel_rsvp_by_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_event(uuid), public.rsvp_event(uuid,text,text,text,text,text,int,text,boolean,boolean),
  public.get_rsvp_by_code(text), public.update_rsvp_by_code(text,text,int), public.cancel_rsvp_by_code(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.promote_waitlist(uuid) TO authenticated;