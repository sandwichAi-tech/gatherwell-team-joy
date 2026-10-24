-- Tickets, check-in operations, attendance export support.
-- 1. Privacy-minimized ticket payload resolved by the opaque admission code.
--    Constant-shape response for invalid/rate-limited codes; exact address,
--    online URL and arrival note only for active registrations on published events.
CREATE OR REPLACE FUNCTION public.ticket_payload(_code text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; e record; _active boolean; _key text;
BEGIN
  _key := 'ticket:' || left(trim(coalesce(_code, '')), 12);
  DELETE FROM public.rsvp_attempts WHERE created_at < now() - interval '1 day';
  IF (SELECT count(*) FROM public.rsvp_attempts WHERE key = _key AND created_at > now() - interval '1 minute') >= 20 THEN
    RETURN jsonb_build_object('found', false);
  END IF;
  INSERT INTO public.rsvp_attempts (key) VALUES (_key);
  IF trim(coalesce(_code, '')) !~ '^[0-9a-f]{32}$' THEN RETURN jsonb_build_object('found', false); END IF;
  SELECT id, event_id, guest_name, status, plus_ones, checked_in_at, tier_id INTO r FROM public.rsvps WHERE checkin_code = trim(_code) AND merged_into_rsvp_id IS NULL;
  IF NOT FOUND THEN RETURN jsonb_build_object('found', false); END IF;
  SELECT id, title, starts_at, ends_at, timezone, location_name, address, online_url, meeting_note, accessibility_notes, cancellation_policy, status, visibility, format, capacity INTO e FROM public.events WHERE id = r.event_id;
  _active := r.status IN ('going', 'maybe') AND e.status = 'published';
  RETURN jsonb_build_object(
    'found', true,
    'status', r.status,
    'guest_name', r.guest_name,
    'plus_ones', r.plus_ones,
    'checked_in_at', r.checked_in_at,
    'waitlist_position', CASE WHEN r.status = 'waitlist' THEN public.waitlist_position(trim(_code)) END,
    'tier_name', (SELECT x->>'name' FROM jsonb_array_elements(coalesce((SELECT ticket_tiers FROM events WHERE id = e.id), '[]'::jsonb)) x WHERE x->>'id' = r.tier_id),
    'event', jsonb_build_object(
      'id', e.id, 'title', e.title, 'starts_at', e.starts_at, 'ends_at', e.ends_at, 'timezone', e.timezone,
      'status', e.status, 'visibility', e.visibility, 'format', e.format,
      'location_name', e.location_name,
      'address', CASE WHEN _active THEN e.address END,
      'online_url', CASE WHEN _active THEN e.online_url END,
      'meeting_note', CASE WHEN _active THEN e.meeting_note END,
      'accessibility_notes', e.accessibility_notes,
      'cancellation_policy', e.cancellation_policy));
END $$;
GRANT EXECUTE ON FUNCTION public.ticket_payload(text) TO anon, authenticated;

-- 2. Rate-limited, audited code check-in (constant-shape invalid responses).
CREATE OR REPLACE FUNCTION public.check_in_code(_event uuid, _code text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; _key text; _team uuid;
BEGIN
  IF NOT public.can_checkin_event(_event) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  _key := 'checkin:' || _event::text || ':' || coalesce(auth.uid()::text, 'anon');
  IF (SELECT count(*) FROM public.rsvp_attempts WHERE key = _key AND created_at > now() - interval '1 minute') >= 40 THEN
    RETURN jsonb_build_object('result', 'not_found');
  END IF;
  INSERT INTO public.rsvp_attempts (key) VALUES (_key);
  SELECT id, guest_name, status, checked_in_at, plus_ones INTO r FROM public.rsvps WHERE event_id = _event AND checkin_code = trim(_code) AND merged_into_rsvp_id IS NULL;
  IF NOT FOUND THEN RETURN jsonb_build_object('result', 'not_found'); END IF;
  IF r.status = 'cancelled' THEN RETURN jsonb_build_object('result', 'cancelled'); END IF;
  IF r.status = 'waitlist' THEN RETURN jsonb_build_object('result', 'waitlist'); END IF;
  IF r.checked_in_at IS NOT NULL THEN RETURN jsonb_build_object('result', 'already', 'name', r.guest_name, 'at', r.checked_in_at); END IF;
  UPDATE public.rsvps SET checked_in_at = now(), status = 'going' WHERE id = r.id;
  SELECT team_id INTO _team FROM public.events WHERE id = _event;
  IF _team IS NOT NULL THEN
    INSERT INTO public.team_audit (team_id, actor, action, target, meta) VALUES (_team, auth.uid(), 'checkin', r.id, jsonb_build_object('event_id', _event, 'via', 'code'));
  END IF;
  RETURN jsonb_build_object('result', 'ok', 'name', r.guest_name, 'plus_ones', r.plus_ones);
END $$;

-- 3. Audited check-in / undo by RSVP id (idempotent: re-check-in keeps first timestamp).
CREATE OR REPLACE FUNCTION public.check_in_rsvp(_rsvp uuid, _undo boolean DEFAULT false) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _ev uuid; _team uuid;
BEGIN
  SELECT event_id INTO _ev FROM public.rsvps WHERE id = _rsvp;
  IF _ev IS NULL OR NOT public.can_checkin_event(_ev) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  SELECT team_id INTO _team FROM public.events WHERE id = _ev;
  IF _undo THEN
    UPDATE public.rsvps SET checked_in_at = NULL WHERE id = _rsvp;
    IF _team IS NOT NULL THEN
      INSERT INTO public.team_audit (team_id, actor, action, target, meta) VALUES (_team, auth.uid(), 'checkin_undo', _rsvp, jsonb_build_object('event_id', _ev));
    END IF;
  ELSE
    UPDATE public.rsvps SET checked_in_at = coalesce(checked_in_at, now()), status = 'going' WHERE id = _rsvp;
    IF _team IS NOT NULL THEN
      INSERT INTO public.team_audit (team_id, actor, action, target, meta) VALUES (_team, auth.uid(), 'checkin', _rsvp, jsonb_build_object('event_id', _ev, 'via', 'list'));
    END IF;
  END IF;
END $$;

-- 4. Audited walk-in creation (event managers only — unchanged gate).
CREATE OR REPLACE FUNCTION public.add_walk_in(_event uuid, _first text, _last text, _phone text, _email text, _sms boolean, _mail boolean, _language text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _name text := trim(coalesce(_first,'') || ' ' || coalesce(_last,'')); _id uuid; _team uuid;
BEGIN
  IF NOT public.can_manage_event(_event) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  IF coalesce(trim(_first),'') = '' OR length(_name) > 120 THEN RAISE EXCEPTION 'name_required'; END IF;
  IF nullif(trim(_phone),'') IS NULL AND nullif(trim(_email),'') IS NULL THEN RAISE EXCEPTION 'contact_required'; END IF;
  IF length(coalesce(_phone,'')) > 30 OR length(coalesce(_email,'')) > 200 THEN RAISE EXCEPTION 'too_long'; END IF;
  INSERT INTO public.rsvps (event_id, guest_name, guest_phone, guest_email, language, status, is_walk_in, checked_in_at, sms_opt_in, email_opt_in)
  VALUES (_event, _name, nullif(trim(_phone),''), nullif(trim(_email),''), CASE WHEN _language = 'es' THEN 'es' ELSE 'en' END,
    'going', true, now(), coalesce(_sms,false), coalesce(_mail,false)) RETURNING id INTO _id;
  SELECT team_id INTO _team FROM public.events WHERE id = _event;
  IF _team IS NOT NULL THEN
    INSERT INTO public.team_audit (team_id, actor, action, target, meta) VALUES (_team, auth.uid(), 'walk_in', _id, jsonb_build_object('event_id', _event));
  END IF;
  RETURN _id;
END $$;

-- 5. Real-time attendance totals for event-day staff (aggregate counts only).
CREATE OR REPLACE FUNCTION public.attendance_totals(_event uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _cap integer;
BEGIN
  IF NOT public.can_checkin_event(_event) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  SELECT capacity INTO _cap FROM public.events WHERE id = _event;
  RETURN (SELECT jsonb_build_object(
    'registered', coalesce(sum(CASE WHEN status IN ('going','maybe') THEN 1 + plus_ones END), 0),
    'checked_in', coalesce(sum(CASE WHEN checked_in_at IS NOT NULL THEN 1 + plus_ones END), 0),
    'waitlisted', coalesce(sum(CASE WHEN status = 'waitlist' THEN 1 + plus_ones END), 0),
    'cancelled', count(*) FILTER (WHERE status = 'cancelled'),
    'capacity', _cap,
    'remaining', CASE WHEN _cap IS NULL THEN NULL ELSE greatest(_cap - coalesce(sum(CASE WHEN status IN ('going','maybe') THEN 1 + plus_ones END), 0), 0) END)
    FROM public.rsvps WHERE event_id = _event AND merged_into_rsvp_id IS NULL);
END $$;
GRANT EXECUTE ON FUNCTION public.attendance_totals(uuid) TO authenticated;

-- 6. Attendance export: event managers only, minimal admission fields, audited.
--    No waiver text, guardian data, contact details, payment or profile fields.
CREATE OR REPLACE FUNCTION public.attendance_export(_event uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _team uuid;
BEGIN
  IF NOT public.can_access_event_participants(_event) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  SELECT team_id INTO _team FROM public.events WHERE id = _event;
  IF _team IS NOT NULL THEN
    INSERT INTO public.team_audit (team_id, actor, action, target, meta) VALUES (_team, auth.uid(), 'attendance_export', _event, jsonb_build_object('event_id', _event));
  END IF;
  RETURN (SELECT coalesce(jsonb_agg(row_to_json(x)::jsonb ORDER BY x.guest_name), '[]'::jsonb) FROM (
    SELECT r.guest_name, r.status, r.plus_ones, r.checked_in_at, r.is_walk_in, r.created_at,
      (SELECT t->>'name' FROM jsonb_array_elements(coalesce(e.ticket_tiers, '[]'::jsonb)) t WHERE t->>'id' = r.tier_id) AS tier_name
    FROM public.rsvps r JOIN public.events e ON e.id = r.event_id
    WHERE r.event_id = _event AND r.merged_into_rsvp_id IS NULL) x);
END $$;
GRANT EXECUTE ON FUNCTION public.attendance_export(uuid) TO authenticated;