ALTER TABLE public.founding_coaches ADD COLUMN IF NOT EXISTS stay_at_rate boolean;

CREATE OR REPLACE FUNCTION public.admin_day60() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE s date; st timestamptz; r jsonb;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT start_date INTO s FROM founding_program LIMIT 1;
  IF s IS NULL THEN RETURN jsonb_build_object('start_date', null); END IF;
  st := s::timestamptz;
  WITH c AS (
    SELECT fc.id, fc.user_id, fc.full_name, fc.language, fc.small_town, fc.stay_at_rate, p.live_at, p.created_at AS signed_up
    FROM founding_coaches fc LEFT JOIN profiles p ON p.id = fc.user_id),
  pay AS (
    SELECT op.*, o.host_id FROM offer_purchases op JOIN offers o ON o.id = op.offer_id
    WHERE o.kind = 'membership' AND o.host_id IN (SELECT user_id FROM c WHERE user_id IS NOT NULL)
      AND coalesce(op.community, false) = false AND coalesce(op.amount_cents, 0) > 0),
  active AS (SELECT * FROM pay WHERE status = 'active')
  SELECT jsonb_build_object(
    'start_date', s,
    'coaches', coalesce((SELECT jsonb_agg(jsonb_build_object(
       'id', c.id, 'name', c.full_name, 'language', c.language, 'small_town', c.small_town, 'stay', c.stay_at_rate,
       'live', c.live_at IS NOT NULL,
       'minutes_to_live', CASE WHEN c.live_at IS NOT NULL THEN round(extract(epoch FROM c.live_at - c.signed_up) / 60) END,
       'gatherings', (SELECT count(*) FROM events e WHERE e.host_id = c.user_id AND e.status = 'published' AND e.starts_at >= st AND e.starts_at <= now()),
       'paying', (SELECT count(DISTINCT a.user_id) FROM active a WHERE a.host_id = c.user_id),
       'first_paid_days', (SELECT extract(epoch FROM min(pp.created_at) - greatest(st, coalesce(c.live_at, st))) / 86400 FROM pay pp WHERE pp.host_id = c.user_id),
       'top_circle_paying', (SELECT coalesce(max(n), 0) FROM (SELECT count(DISTINCT a.user_id) n FROM active a WHERE a.host_id = c.user_id GROUP BY a.offer_id) x)
     )) FROM c), '[]'::jsonb),
    'spanish_circles_15', (SELECT count(*) FROM (SELECT a.offer_id FROM active a JOIN c ON c.user_id = a.host_id WHERE c.language = 'es' GROUP BY a.offer_id HAVING count(DISTINCT a.user_id) >= 15) x),
    'paying_members', (SELECT count(DISTINCT user_id) FROM active),
    'month1_members', (SELECT count(DISTINCT user_id) FROM pay WHERE created_at >= st AND created_at < st + interval '30 days' AND created_at <= now() - interval '30 days'),
    'month1_retained', (SELECT count(DISTINCT user_id) FROM pay WHERE status = 'active' AND created_at >= st AND created_at < st + interval '30 days' AND created_at <= now() - interval '30 days'),
    'in_person_members', (SELECT count(DISTINCT a.user_id) FROM active a WHERE EXISTS (
       SELECT 1 FROM rsvps rv JOIN events e ON e.id = rv.event_id WHERE rv.user_id = a.user_id AND rv.checked_in_at IS NOT NULL AND e.online_url IS NULL AND e.starts_at >= st)),
    'rsvps', (SELECT count(*) FROM rsvps rv JOIN events e ON e.id = rv.event_id WHERE e.host_id IN (SELECT user_id FROM c WHERE user_id IS NOT NULL) AND e.starts_at >= st AND e.starts_at <= now() AND rv.status NOT IN ('cancelled','waitlist','waitlisted','declined','pending')),
    'checked_in', (SELECT count(*) FROM rsvps rv JOIN events e ON e.id = rv.event_id WHERE e.host_id IN (SELECT user_id FROM c WHERE user_id IS NOT NULL) AND e.starts_at >= st AND e.starts_at <= now() AND rv.checked_in_at IS NOT NULL)
  ) INTO r;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.admin_day60() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_day60() TO authenticated;