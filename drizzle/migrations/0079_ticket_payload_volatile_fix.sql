-- ticket_payload and attendance_export write audit/rate-limit rows, so they must be VOLATILE (not STABLE).
CREATE OR REPLACE FUNCTION public.ticket_payload(_code text) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
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

CREATE OR REPLACE FUNCTION public.attendance_export(_event uuid) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
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