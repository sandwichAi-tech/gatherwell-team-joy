-- Event builder milestone: additive fields for the full host creation/editing workflow.

ALTER TABLE public.events
  ADD COLUMN summary_en text,
  ADD COLUMN summary_es text,
  ADD COLUMN language text NOT NULL DEFAULT 'en',
  ADD COLUMN format text NOT NULL DEFAULT 'person',
  ADD COLUMN map_url text,
  ADD COLUMN reg_opens_at timestamptz,
  ADD COLUMN reg_closes_at timestamptz,
  ADD COLUMN waitlist_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN contact_email text,
  ADD COLUMN contact_phone text,
  ADD COLUMN accessibility_notes text,
  ADD COLUMN what_to_bring text,
  ADD COLUMN cancellation_policy text,
  ADD COLUMN min_age int,
  ADD COLUMN ticket_tiers jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN addons jsonb NOT NULL DEFAULT '[]';

ALTER TABLE public.rsvps
  ADD COLUMN guardian_name text,
  ADD COLUMN guardian_relationship text,
  ADD COLUMN guardian_email text,
  ADD COLUMN guardian_phone text;

-- Host-checked editor for the new detail fields; clients never touch them directly.
CREATE OR REPLACE FUNCTION public.update_event_details(_event uuid, _p jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE _e public.events; _tags text[]; _tiers jsonb; _addons jsonb; t jsonb; _clean jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO _e FROM public.events WHERE id = _event;
  IF _e.id IS NULL OR NOT public.can_manage_event(_event) THEN RAISE EXCEPTION 'not_allowed'; END IF;

  IF _p ? 'format' AND coalesce(_p->>'format','person') NOT IN ('person','online','hybrid') THEN RAISE EXCEPTION 'invalid_format'; END IF;
  IF _p ? 'language' AND coalesce(_p->>'language','en') NOT IN ('en','es') THEN RAISE EXCEPTION 'invalid_language'; END IF;
  IF nullif(_p->>'reg_opens_at','') IS NOT NULL AND nullif(_p->>'reg_closes_at','') IS NOT NULL
     AND (_p->>'reg_opens_at')::timestamptz >= (_p->>'reg_closes_at')::timestamptz THEN RAISE EXCEPTION 'invalid_reg_window'; END IF;
  IF nullif(_p->>'min_age','') IS NOT NULL AND ((_p->>'min_age')::int < 0 OR (_p->>'min_age')::int > 17) THEN RAISE EXCEPTION 'invalid_min_age'; END IF;
  IF nullif(_p->>'map_url','') IS NOT NULL AND (_p->>'map_url') !~* '^https://' THEN RAISE EXCEPTION 'invalid_url'; END IF;
  IF nullif(_p->>'contact_email','') IS NOT NULL AND (_p->>'contact_email') !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'invalid_email'; END IF;

  _tags := '{}'; 
  IF _p ? 'tags' THEN
    SELECT coalesce(array_agg(DISTINCT lower(left(trim(x), 24))), '{}') INTO _tags
      FROM (SELECT jsonb_array_elements_text(coalesce(_p->'tags','[]'::jsonb)) AS x) s WHERE trim(x) <> '';
    IF coalesce(array_length(_tags,1),0) > 8 THEN RAISE EXCEPTION 'too_many_tags'; END IF;
  END IF;

  IF _p ? 'ticket_tiers' THEN
    _tiers := coalesce(_p->'ticket_tiers','[]'::jsonb);
    IF jsonb_typeof(_tiers) <> 'array' OR jsonb_array_length(_tiers) > 6 THEN RAISE EXCEPTION 'invalid_tiers'; END IF;
    FOR t IN SELECT * FROM jsonb_array_elements(_tiers) LOOP
      IF length(trim(coalesce(t->>'name',''))) = 0 OR length(t->>'name') > 60 THEN RAISE EXCEPTION 'invalid_tiers'; END IF;
      IF coalesce((t->>'price_cents')::int, -1) < 0 OR (t->>'price_cents')::int > 100000 THEN RAISE EXCEPTION 'invalid_tiers'; END IF;
      IF nullif(t->>'quantity','') IS NOT NULL AND (t->>'quantity')::int < 1 THEN RAISE EXCEPTION 'invalid_tiers'; END IF;
      IF nullif(t->>'sale_starts_at','') IS NOT NULL AND nullif(t->>'sale_ends_at','') IS NOT NULL
         AND (t->>'sale_starts_at')::timestamptz >= (t->>'sale_ends_at')::timestamptz THEN RAISE EXCEPTION 'invalid_tiers'; END IF;
      _clean := _clean || jsonb_build_array(jsonb_build_object(
        'id', coalesce(nullif(t->>'id',''), substr(replace(gen_random_uuid()::text,'-',''),1,12)),
        'name', trim(t->>'name'), 'price_cents', (t->>'price_cents')::int,
        'quantity', nullif(t->>'quantity','')::int,
        'sale_starts_at', nullif(t->>'sale_starts_at',''), 'sale_ends_at', nullif(t->>'sale_ends_at','')));
    END LOOP;
    _tiers := _clean; _clean := '[]'::jsonb;
  ELSE _tiers := _e.ticket_tiers; END IF;

  IF _p ? 'addons' THEN
    _addons := coalesce(_p->'addons','[]'::jsonb);
    IF jsonb_typeof(_addons) <> 'array' OR jsonb_array_length(_addons) > 8 THEN RAISE EXCEPTION 'invalid_addons'; END IF;
    FOR t IN SELECT * FROM jsonb_array_elements(_addons) LOOP
      IF length(trim(coalesce(t->>'name',''))) = 0 OR length(t->>'name') > 60 THEN RAISE EXCEPTION 'invalid_addons'; END IF;
      IF coalesce((t->>'price_cents')::int, -1) < 0 OR (t->>'price_cents')::int > 100000 THEN RAISE EXCEPTION 'invalid_addons'; END IF;
      _clean := _clean || jsonb_build_array(jsonb_build_object(
        'id', coalesce(nullif(t->>'id',''), substr(replace(gen_random_uuid()::text,'-',''),1,12)),
        'name', trim(t->>'name'), 'price_cents', (t->>'price_cents')::int));
    END LOOP;
    _addons := _clean;
  ELSE _addons := _e.addons; END IF;

  UPDATE public.events SET
    summary_en = CASE WHEN _p ? 'summary_en' THEN nullif(left(trim(_p->>'summary_en'),200),'') ELSE summary_en END,
    summary_es = CASE WHEN _p ? 'summary_es' THEN nullif(left(trim(_p->>'summary_es'),200),'') ELSE summary_es END,
    language = CASE WHEN _p ? 'language' THEN coalesce(_p->>'language','en') ELSE language END,
    format = CASE WHEN _p ? 'format' THEN coalesce(_p->>'format','person') ELSE format END,
    map_url = CASE WHEN _p ? 'map_url' THEN nullif(trim(_p->>'map_url'),'') ELSE map_url END,
    reg_opens_at = CASE WHEN _p ? 'reg_opens_at' THEN nullif(_p->>'reg_opens_at','')::timestamptz ELSE reg_opens_at END,
    reg_closes_at = CASE WHEN _p ? 'reg_closes_at' THEN nullif(_p->>'reg_closes_at','')::timestamptz ELSE reg_closes_at END,
    waitlist_enabled = CASE WHEN _p ? 'waitlist_enabled' THEN coalesce((_p->>'waitlist_enabled')::boolean, true) ELSE waitlist_enabled END,
    tags = CASE WHEN _p ? 'tags' THEN _tags ELSE tags END,
    contact_email = CASE WHEN _p ? 'contact_email' THEN nullif(left(trim(_p->>'contact_email'),200),'') ELSE contact_email END,
    contact_phone = CASE WHEN _p ? 'contact_phone' THEN nullif(left(trim(_p->>'contact_phone'),30),'') ELSE contact_phone END,
    accessibility_notes = CASE WHEN _p ? 'accessibility_notes' THEN nullif(left(trim(_p->>'accessibility_notes'),1000),'') ELSE accessibility_notes END,
    what_to_bring = CASE WHEN _p ? 'what_to_bring' THEN nullif(left(trim(_p->>'what_to_bring'),1000),'') ELSE what_to_bring END,
    cancellation_policy = CASE WHEN _p ? 'cancellation_policy' THEN nullif(left(trim(_p->>'cancellation_policy'),1000),'') ELSE cancellation_policy END,
    allows_minors = CASE WHEN _p ? 'allows_minors' THEN coalesce((_p->>'allows_minors')::boolean, false) ELSE allows_minors END,
    min_age = CASE WHEN _p ? 'min_age' THEN nullif(_p->>'min_age','')::int ELSE min_age END,
    ticket_tiers = _tiers,
    addons = _addons
  WHERE id = _event;
END; $fn$;

GRANT EXECUTE ON FUNCTION public.update_event_details(uuid, jsonb) TO authenticated;

-- Registration window enforced for every guest RSVP path; door walk-ins bypass.
CREATE OR REPLACE FUNCTION public.enforce_reg_window()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE _e public.events;
BEGIN
  IF coalesce(NEW.is_walk_in, false) THEN RETURN NEW; END IF;
  SELECT * INTO _e FROM public.events WHERE id = NEW.event_id;
  IF _e.id IS NULL THEN RETURN NEW; END IF;
  IF _e.reg_opens_at IS NOT NULL AND now() < _e.reg_opens_at THEN RAISE EXCEPTION 'registration_not_open'; END IF;
  IF _e.reg_closes_at IS NOT NULL AND now() > _e.reg_closes_at THEN RAISE EXCEPTION 'registration_closed'; END IF;
  RETURN NEW;
END; $fn$;

CREATE TRIGGER rsvps_reg_window BEFORE INSERT ON public.rsvps FOR EACH ROW EXECUTE FUNCTION public.enforce_reg_window();

-- Minor registration: guardian (18+) registers a minor; consent version resolved server-side, never client-chosen.
CREATE OR REPLACE FUNCTION public.rsvp_event_minor(
  _event_id uuid, _minor_first text, _minor_age_band text,
  _guardian_name text, _guardian_relationship text, _guardian_email text, _guardian_phone text,
  _language text, _sms boolean, _mail boolean, _token text)
RETURNS TABLE(code text, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE _e public.events; _code text; _st text; _rid uuid; _ver uuid;
BEGIN
  PERFORM public.unlock_invite(_event_id, _token);
  SELECT * INTO _e FROM public.events WHERE id = _event_id AND status = 'published';
  IF _e.id IS NULL THEN RAISE EXCEPTION 'not_allowed'; END IF;
  IF NOT _e.allows_minors THEN RAISE EXCEPTION 'minors_not_allowed'; END IF;
  IF _e.reg_opens_at IS NOT NULL AND now() < _e.reg_opens_at THEN RAISE EXCEPTION 'registration_not_open'; END IF;
  IF _e.reg_closes_at IS NOT NULL AND now() > _e.reg_closes_at THEN RAISE EXCEPTION 'registration_closed'; END IF;
  IF _e.min_age IS NOT NULL AND _minor_age_band = 'under_5' AND _e.min_age >= 5 THEN RAISE EXCEPTION 'min_age_not_met'; END IF;
  IF _e.min_age IS NOT NULL AND _minor_age_band = '5_12' AND _e.min_age >= 13 THEN RAISE EXCEPTION 'min_age_not_met'; END IF;
  IF length(trim(coalesce(_minor_first,''))) = 0 OR length(_minor_first) > 40 THEN RAISE EXCEPTION 'minor_details_incomplete'; END IF;
  IF _minor_age_band NOT IN ('under_5','5_12','13_17') THEN RAISE EXCEPTION 'minor_details_incomplete'; END IF;
  IF length(trim(coalesce(_guardian_name,''))) < 2 OR length(_guardian_name) > 120 THEN RAISE EXCEPTION 'guardian_details_incomplete'; END IF;
  IF length(trim(coalesce(_guardian_relationship,''))) = 0 OR length(_guardian_relationship) > 60 THEN RAISE EXCEPTION 'guardian_details_incomplete'; END IF;
  IF length(trim(coalesce(_guardian_email,''))) = 0 AND length(trim(coalesce(_guardian_phone,''))) = 0 THEN RAISE EXCEPTION 'guardian_details_incomplete'; END IF;

  SELECT c.id INTO _ver FROM public.consent_text_versions c
    WHERE c.kind = 'guardian' AND c.locale = coalesce(nullif(_language,''), 'en')
    ORDER BY c.version DESC, c.created_at DESC LIMIT 1;
  IF _ver IS NULL THEN
    SELECT c.id INTO _ver FROM public.consent_text_versions c WHERE c.kind = 'guardian' ORDER BY c.version DESC, c.created_at DESC LIMIT 1;
  END IF;
  IF _ver IS NULL THEN RAISE EXCEPTION 'guardian_consent_required'; END IF;

  SELECT r.code, r.status INTO _code, _st FROM public.rsvp_event_waiver(
    _event_id, trim(_guardian_name), '', trim(coalesce(_guardian_phone,'')), trim(coalesce(_guardian_email,'')),
    coalesce(nullif(_language,''),'en'), 0, 'going', _sms, _mail, '') r;

  UPDATE public.rsvps SET
    minor_first_name = left(trim(_minor_first), 40),
    minor_age_band = _minor_age_band,
    guardian_name = left(trim(_guardian_name), 120),
    guardian_relationship = left(trim(_guardian_relationship), 60),
    guardian_email = nullif(left(trim(coalesce(_guardian_email,'')),200),''),
    guardian_phone = nullif(left(trim(coalesce(_guardian_phone,'')),30),''),
    guardian_consent_at = now(),
    guardian_consent_version_id = _ver
  WHERE checkin_code = _code;

  RETURN QUERY SELECT _code, _st;
END; $fn$;

GRANT EXECUTE ON FUNCTION public.rsvp_event_minor(uuid,text,text,text,text,text,text,text,boolean,boolean,text) TO anon, authenticated;

-- Public page payload gains the new fields; private join details stay out.
CREATE OR REPLACE FUNCTION public.get_public_event(_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE e record; _host jsonb; _team text; _initials jsonb; _used int; _mine text; _co jsonb;
BEGIN
  SELECT * INTO e FROM public.events WHERE id = _id AND status IN ('published','cancelled')
    AND (visibility = 'public' OR (visibility = 'invite' AND current_setting('gw.invite', true) = _id::text) OR public.is_team_member(team_id, ARRAY['leader','host','member']));
  IF e IS NULL THEN RETURN NULL; END IF;
  SELECT jsonb_build_object('name', p.full_name, 'avatar_url', p.avatar_url, 'verified', public.is_verified_coach(p.id)) INTO _host FROM public.profiles p WHERE p.id = e.host_id;
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
    'summary_en', e.summary_en, 'summary_es', e.summary_es, 'language', e.language, 'format', e.format,
    'cover_url', e.cover_url, 'cover_style', e.cover_style, 'starts_at', e.starts_at, 'ends_at', e.ends_at, 'timezone', e.timezone,
    'location_name', e.location_name, 'address', e.address, 'meeting_note', e.meeting_note, 'lat', e.lat, 'lng', e.lng, 'map_url', e.map_url,
    'is_online', e.online_url IS NOT NULL AND e.location_name IS NULL AND e.address IS NULL, 'has_online', e.online_url IS NOT NULL,
    'capacity', e.capacity, 'status', e.status, 'hide_guest_list', e.hide_guest_list, 'going', _used, 'initials', _initials,
    'host', _host, 'cohosts', _co, 'team_name', _team, 'my_code', _mine, 'questions', e.rsvp_questions, 'require_approval', e.require_approval, 'visibility', e.visibility,
    'team_registration', e.team_registration, 'team_min', e.team_min, 'team_max', e.team_max, 'team_price_mode', e.team_price_mode, 'retreat', e.retreat,
    'reg_opens_at', e.reg_opens_at, 'reg_closes_at', e.reg_closes_at, 'waitlist_enabled', e.waitlist_enabled,
    'tags', e.tags, 'contact_email', e.contact_email, 'contact_phone', e.contact_phone,
    'accessibility_notes', e.accessibility_notes, 'what_to_bring', e.what_to_bring, 'cancellation_policy', e.cancellation_policy,
    'allows_minors', e.allows_minors, 'min_age', e.min_age);
END; $fn$;

GRANT EXECUTE ON FUNCTION public.get_public_event(uuid) TO anon, authenticated;