ALTER TABLE public.events ADD COLUMN team_registration boolean NOT NULL DEFAULT false,
  ADD COLUMN team_min int NOT NULL DEFAULT 2, ADD COLUMN team_max int NOT NULL DEFAULT 6,
  ADD COLUMN team_price_mode text NOT NULL DEFAULT 'person';
ALTER TABLE public.events ADD CONSTRAINT events_team_size_check CHECK (team_min BETWEEN 2 AND 20 AND team_max BETWEEN team_min AND 20),
  ADD CONSTRAINT events_team_price_mode_check CHECK (team_price_mode IN ('person','team'));
ALTER TABLE public.rsvps ADD COLUMN group_id uuid, ADD COLUMN group_name text;
ALTER TABLE public.rsvps ADD CONSTRAINT rsvps_group_name_check CHECK (group_name IS NULL OR length(group_name) BETWEEN 1 AND 80);
CREATE INDEX rsvps_group_idx ON public.rsvps(group_id) WHERE group_id IS NOT NULL;
ALTER TABLE public.waiver_acceptances DROP CONSTRAINT waiver_acceptances_source_check;
ALTER TABLE public.waiver_acceptances ADD CONSTRAINT waiver_acceptances_source_check CHECK (source IN ('rsvp','walk_in','door','link'));

CREATE OR REPLACE FUNCTION public.rsvp_team(_event_id uuid, _token text, _team_name text, _language text, _participants jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE e record; _n int; _cap int; _st text; _gid uuid := gen_random_uuid(); p jsonb; q jsonb; _clean jsonb; v text;
  _name text; _ph text; _em text; _id uuid; _code text; _out jsonb := '[]'::jsonb; _ip text; _i int := 0; _lang text;
BEGIN
  PERFORM unlock_invite(_event_id, _token);
  _ip := 'ip:' || trim(split_part(coalesce(current_setting('request.headers', true)::json->>'x-forwarded-for', 'unknown'), ',', 1));
  IF (SELECT count(*) FROM rsvp_attempts WHERE key = _ip AND created_at > now() - interval '1 minute') >= 10 THEN RAISE EXCEPTION 'rate_limited'; END IF;
  SELECT * INTO e FROM events WHERE id = _event_id FOR UPDATE;
  IF NOT FOUND OR e.status <> 'published' OR NOT (e.visibility = 'public' OR (e.visibility = 'invite' AND current_setting('gw.invite', true) = _event_id::text) OR (auth.uid() IS NOT NULL AND can_rsvp_event(_event_id))) THEN RAISE EXCEPTION 'not_open'; END IF;
  IF NOT e.team_registration THEN RAISE EXCEPTION 'not_open'; END IF;
  IF e.price_cents IS NOT NULL THEN RAISE EXCEPTION 'payment_required'; END IF;
  _team_name := trim(coalesce(_team_name,''));
  IF length(_team_name) NOT BETWEEN 1 AND 80 THEN RAISE EXCEPTION 'team_name_required'; END IF;
  IF jsonb_typeof(_participants) <> 'array' THEN RAISE EXCEPTION 'team_size'; END IF;
  _n := jsonb_array_length(_participants);
  IF _n < e.team_min OR _n > e.team_max THEN RAISE EXCEPTION 'team_size'; END IF;
  IF nullif(trim(_participants->0->>'phone'),'') IS NULL AND nullif(trim(_participants->0->>'email'),'') IS NULL THEN RAISE EXCEPTION 'contact_required'; END IF;
  _lang := CASE WHEN _language = 'es' THEN 'es' ELSE 'en' END;
  _cap := guest_cap(_event_id);
  _st := CASE WHEN _cap IS NOT NULL AND event_seats_used(_event_id) + _n > _cap THEN 'waitlist' ELSE 'going' END;
  IF e.require_approval THEN _st := 'requested'; END IF;
  FOR p IN SELECT * FROM jsonb_array_elements(_participants) LOOP
    _name := trim(coalesce(p->>'first','') || ' ' || coalesce(p->>'last',''));
    IF coalesce(trim(p->>'first'),'') = '' OR length(_name) > 120 THEN RAISE EXCEPTION 'name_required'; END IF;
    _ph := nullif(trim(coalesce(p->>'phone','')),''); _em := nullif(trim(coalesce(p->>'email','')),'');
    IF length(coalesce(_ph,'')) > 30 OR length(coalesce(_em,'')) > 200 THEN RAISE EXCEPTION 'too_long'; END IF;
    IF _em IS NOT NULL AND _em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'invalid_email'; END IF;
    _clean := '{}'::jsonb;
    FOR q IN SELECT * FROM jsonb_array_elements(coalesce(e.rsvp_questions,'[]'::jsonb)) LOOP
      v := left(trim(coalesce(p->'answers'->>(q->>'id'), '')), 500);
      IF v <> '' THEN
        IF q->>'kind' = 'yesno' AND v NOT IN ('yes','no') THEN RAISE EXCEPTION 'answers_required'; END IF;
        IF q->>'kind' = 'choice' AND NOT (q->'options' ? v) THEN RAISE EXCEPTION 'answers_required'; END IF;
        _clean := _clean || jsonb_build_object(q->>'id', v);
      ELSIF coalesce((q->>'required')::boolean, false) THEN RAISE EXCEPTION 'answers_required'; END IF;
    END LOOP;
    INSERT INTO rsvps (event_id, user_id, guest_name, guest_phone, guest_email, language, plus_ones, status, sms_opt_in, email_opt_in, group_id, group_name)
    VALUES (_event_id, CASE WHEN _i = 0 THEN auth.uid() END, _name, _ph, _em, _lang, 0, _st, _ph IS NOT NULL AND coalesce((p->>'sms')::boolean,false), _em IS NOT NULL AND coalesce((p->>'mail')::boolean,false), _gid, _team_name)
    RETURNING rsvps.id, rsvps.checkin_code INTO _id, _code;
    IF _clean <> '{}'::jsonb THEN INSERT INTO rsvp_answers (rsvp_id, event_id, answers) VALUES (_id, _event_id, _clean); END IF;
    IF e.requires_waiver AND length(trim(coalesce(p->>'waiver_name',''))) >= 2 THEN PERFORM record_waiver(_id, p->>'waiver_name', request_ip(), 'rsvp'); END IF;
    IF _ph IS NOT NULL OR _em IS NOT NULL THEN
      IF _st = 'requested' THEN IF _i = 0 THEN PERFORM notify_rsvp_request(_id); END IF;
      ELSE PERFORM queue_rsvp_notices(_id, CASE WHEN _st = 'waitlist' THEN 'rsvp_waitlisted' ELSE 'rsvp_confirmed' END); END IF;
    END IF;
    _out := _out || jsonb_build_object('name', _name, 'code', _code, 'signed', EXISTS (SELECT 1 FROM waiver_acceptances WHERE rsvp_id = _id));
    _i := _i + 1;
  END LOOP;
  INSERT INTO rsvp_attempts (key) VALUES (_ip);
  RETURN jsonb_build_object('status', _st, 'team', _team_name, 'participants', _out);
END $$;
REVOKE ALL ON FUNCTION public.rsvp_team(uuid,text,text,text,jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.rsvp_team(uuid,text,text,text,jsonb) TO anon, authenticated;

-- Participant signs their own waiver from the link with their check-in code.
CREATE OR REPLACE FUNCTION public.sign_waiver_by_code(_code text, _name text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _id uuid;
BEGIN
  SELECT r.id INTO _id FROM rsvps r JOIN events e ON e.id = r.event_id WHERE r.checkin_code = _code AND r.status <> 'cancelled' AND e.requires_waiver;
  IF _id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  PERFORM record_waiver(_id, _name, request_ip(), 'link');
END $$;
REVOKE ALL ON FUNCTION public.sign_waiver_by_code(text,text) FROM public;
GRANT EXECUTE ON FUNCTION public.sign_waiver_by_code(text,text) TO anon, authenticated;

-- Host or co-host records a signature at the door.
CREATE OR REPLACE FUNCTION public.sign_waiver_at_door(_rsvp uuid, _name text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _ev uuid;
BEGIN
  SELECT event_id INTO _ev FROM rsvps WHERE id = _rsvp;
  IF _ev IS NULL OR NOT can_manage_event(_ev) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  PERFORM record_waiver(_rsvp, _name, request_ip(), 'door');
END $$;
REVOKE ALL ON FUNCTION public.sign_waiver_at_door(uuid,text) FROM public;
GRANT EXECUTE ON FUNCTION public.sign_waiver_at_door(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_public_event(_id uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE e record; _host jsonb; _team text; _initials jsonb; _used int; _mine text; _co jsonb;
BEGIN
  SELECT * INTO e FROM public.events WHERE id = _id AND status IN ('published','cancelled')
    AND (visibility = 'public' OR (visibility = 'invite' AND current_setting('gw.invite', true) = _id::text) OR public.is_team_member(team_id, ARRAY['leader','host','member']));
  IF e IS NULL THEN RETURN NULL; END IF;
  SELECT jsonb_build_object('name', p.full_name, 'avatar_url', p.avatar_url) INTO _host FROM public.profiles p WHERE p.id = e.host_id;
  SELECT coalesce(jsonb_agg(jsonb_build_object('name', p.full_name, 'avatar_url', p.avatar_url) ORDER BY c.created_at), '[]'::jsonb) INTO _co
    FROM public.event_cohosts c JOIN public.profiles p ON p.id = c.user_id WHERE c.event_id = _id;
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
    'host', _host, 'cohosts', _co, 'team_name', _team, 'my_code', _mine, 'questions', e.rsvp_questions, 'require_approval', e.require_approval, 'visibility', e.visibility,
    'team_registration', e.team_registration, 'team_min', e.team_min, 'team_max', e.team_max, 'team_price_mode', e.team_price_mode);
END; $function$;