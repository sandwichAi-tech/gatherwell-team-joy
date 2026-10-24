
-- Expose price_cents in the public event payload so free events never need the event_price lookup.
CREATE OR REPLACE FUNCTION public.get_public_event(_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
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
    'cover_url', e.cover_url, 'cover_style', e.cover_style, 'cover_overlay', e.cover_overlay, 'cover_focal', e.cover_focal, 'cover_alt', e.cover_alt,
    'starts_at', e.starts_at, 'ends_at', e.ends_at, 'timezone', e.timezone,
    'location_name', e.location_name, 'address', e.address, 'meeting_note', e.meeting_note, 'lat', e.lat, 'lng', e.lng, 'map_url', e.map_url,
    'is_online', e.online_url IS NOT NULL AND e.location_name IS NULL AND e.address IS NULL, 'has_online', e.online_url IS NOT NULL,
    'capacity', e.capacity, 'status', e.status, 'hide_guest_list', e.hide_guest_list, 'going', _used, 'initials', _initials)
  || jsonb_build_object(
    'host', _host, 'cohosts', _co, 'team_name', _team, 'my_code', _mine, 'questions', e.rsvp_questions, 'require_approval', e.require_approval, 'visibility', e.visibility,
    'team_registration', e.team_registration, 'team_min', e.team_min, 'team_max', e.team_max, 'team_price_mode', e.team_price_mode, 'retreat', e.retreat,
    'reg_opens_at', e.reg_opens_at, 'reg_closes_at', e.reg_closes_at, 'waitlist_enabled', e.waitlist_enabled,
    'tags', e.tags, 'contact_email', e.contact_email, 'contact_phone', e.contact_phone,
    'accessibility_notes', e.accessibility_notes, 'what_to_bring', e.what_to_bring, 'cancellation_policy', e.cancellation_policy,
    'allows_minors', e.allows_minors, 'min_age', e.min_age, 'price_cents', e.price_cents);
END; $fn$;
GRANT EXECUTE ON FUNCTION public.get_public_event(uuid) TO anon, authenticated;
