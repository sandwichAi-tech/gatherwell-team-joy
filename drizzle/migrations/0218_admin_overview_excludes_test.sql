CREATE OR REPLACE FUNCTION public.admin_overview(_since timestamp with time zone)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _r jsonb;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  -- Test accounts (profiles.is_test) and everything they own are excluded from every number and chart.
  CREATE TEMP TABLE IF NOT EXISTS _tu ON COMMIT DROP AS SELECT id FROM profiles WHERE is_test;
  CREATE TEMP TABLE IF NOT EXISTS _ev ON COMMIT DROP AS SELECT e.id, e.created_at FROM events e WHERE e.host_id NOT IN (SELECT id FROM _tu);
  CREATE TEMP TABLE IF NOT EXISTS _rs ON COMMIT DROP AS SELECT r.created_at, r.checked_in_at FROM rsvps r
    WHERE r.event_id IN (SELECT id FROM _ev) AND (r.user_id IS NULL OR r.user_id NOT IN (SELECT id FROM _tu));
  SELECT jsonb_build_object(
    'signups', (SELECT count(*) FROM auth.users WHERE created_at >= _since AND id NOT IN (SELECT id FROM _tu)),
    'active_teams', (SELECT count(DISTINCT a.team_id) FROM activity a JOIN teams t ON t.id = a.team_id WHERE a.created_at >= _since AND t.owner_id NOT IN (SELECT id FROM _tu)),
    'gatherings', (SELECT count(*) FROM _ev WHERE created_at >= _since),
    'rsvps', (SELECT count(*) FROM _rs WHERE created_at >= _since),
    'checkins', (SELECT count(*) FROM _rs WHERE checked_in_at >= _since),
    'ai_requests', (SELECT count(*) FROM ai_usage WHERE created_at >= _since AND (user_id IS NULL OR user_id NOT IN (SELECT id FROM _tu))),
    'ai_cost_cents', (SELECT coalesce(round(sum(input_tokens) * 0.0003 + sum(output_tokens) * 0.0015), 0) FROM ai_usage WHERE created_at >= _since AND (user_id IS NULL OR user_id NOT IN (SELECT id FROM _tu))),
    'messages', (SELECT coalesce(jsonb_object_agg(k, n), '{}'::jsonb) FROM (SELECT channel || ':' || CASE WHEN status IN ('pending','sending') THEN 'queued' ELSE status END AS k, count(*) AS n FROM notification_outbox
       WHERE created_at >= _since AND coalesce(error, '') <> 'test_account' AND (user_id IS NULL OR user_id NOT IN (SELECT id FROM _tu)) GROUP BY 1) m),
    'plans', (SELECT jsonb_build_object(
        'free', count(*) FILTER (WHERE pl = 'free'), 'growth', count(*) FILTER (WHERE pl = 'growth' AND src = 'own'),
        'pro', count(*) FILTER (WHERE pl = 'pro'), 'team', count(*) FILTER (WHERE src = 'license'))
      FROM (SELECT effective_plan(p.id)->>'plan' AS pl, effective_plan(p.id)->>'source' AS src FROM profiles p WHERE NOT p.is_test) x),
    'paid', (SELECT jsonb_build_object('growth_month', count(*) FILTER (WHERE plan = 'growth' AND billing_period = 'month' AND stripe_subscription_id IS NOT NULL),
        'growth_year', count(*) FILTER (WHERE plan = 'growth' AND billing_period = 'year' AND stripe_subscription_id IS NOT NULL),
        'pro_month', count(*) FILTER (WHERE plan = 'pro' AND billing_period = 'month' AND stripe_subscription_id IS NOT NULL),
        'pro_year', count(*) FILTER (WHERE plan = 'pro' AND billing_period = 'year' AND stripe_subscription_id IS NOT NULL))
      FROM billing_accounts WHERE status IN ('active','past_due') AND user_id NOT IN (SELECT id FROM _tu)),
    'licenses', (SELECT jsonb_build_object('team25', count(*) FILTER (WHERE tier = 'team25'), 'team100', count(*) FILTER (WHERE tier = 'team100'))
      FROM team_licenses WHERE status IN ('active','past_due') AND NOT is_preview AND leader_id NOT IN (SELECT id FROM _tu)),
    'weeks', (SELECT jsonb_agg(jsonb_build_object('week', w,
        'signups', (SELECT count(*) FROM auth.users WHERE created_at >= w AND created_at < w + interval '7 days' AND id NOT IN (SELECT id FROM _tu)),
        'checkins', (SELECT count(*) FROM _rs WHERE checked_in_at >= w AND checked_in_at < w + interval '7 days')) ORDER BY w)
      FROM generate_series(date_trunc('week', now()) - interval '11 weeks', date_trunc('week', now()), interval '7 days') w)
  ) INTO _r;
  DROP TABLE IF EXISTS _tu, _ev, _rs;
  RETURN _r;
END; $function$;

CREATE OR REPLACE FUNCTION public.admin_time_to_live(_since timestamp with time zone)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r jsonb;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not_allowed'; END IF;
  SELECT jsonb_build_object(
    'median_minutes', round((percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM p.live_at - p.created_at) / 60))::numeric),
    'live', count(*),
    'within_hour', count(*) FILTER (WHERE p.live_at - p.created_at <= interval '1 hour'))
  INTO r FROM profiles p WHERE p.live_at IS NOT NULL AND p.created_at >= _since AND NOT p.is_test;
  RETURN r;
END $function$;