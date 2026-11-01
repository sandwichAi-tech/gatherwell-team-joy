CREATE OR REPLACE FUNCTION public.admin_overview(_since timestamp with time zone)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _r jsonb; _tu uuid[];
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  -- Test accounts (profiles.is_test) and everything they own are excluded from every number and chart.
  SELECT coalesce(array_agg(id), '{}') INTO _tu FROM profiles WHERE is_test;
  SELECT jsonb_build_object(
    'signups', (SELECT count(*) FROM auth.users WHERE created_at >= _since AND NOT id = ANY(_tu)),
    'active_teams', (SELECT count(DISTINCT a.team_id) FROM activity a JOIN teams t ON t.id = a.team_id WHERE a.created_at >= _since AND NOT t.owner_id = ANY(_tu)),
    'gatherings', (SELECT count(*) FROM events WHERE created_at >= _since AND NOT host_id = ANY(_tu)),
    'rsvps', (SELECT count(*) FROM rsvps r JOIN events e ON e.id = r.event_id WHERE r.created_at >= _since AND NOT e.host_id = ANY(_tu) AND (r.user_id IS NULL OR NOT r.user_id = ANY(_tu))),
    'checkins', (SELECT count(*) FROM rsvps r JOIN events e ON e.id = r.event_id WHERE r.checked_in_at >= _since AND NOT e.host_id = ANY(_tu) AND (r.user_id IS NULL OR NOT r.user_id = ANY(_tu))),
    'ai_requests', (SELECT count(*) FROM ai_usage WHERE created_at >= _since AND (user_id IS NULL OR NOT user_id = ANY(_tu))),
    'ai_cost_cents', (SELECT coalesce(round(sum(input_tokens) * 0.0003 + sum(output_tokens) * 0.0015), 0) FROM ai_usage WHERE created_at >= _since AND (user_id IS NULL OR NOT user_id = ANY(_tu))),
    'messages', (SELECT coalesce(jsonb_object_agg(k, n), '{}'::jsonb) FROM (SELECT channel || ':' || CASE WHEN status IN ('pending','sending') THEN 'queued' ELSE status END AS k, count(*) AS n FROM notification_outbox
       WHERE created_at >= _since AND coalesce(error, '') <> 'test_account' AND (user_id IS NULL OR NOT user_id = ANY(_tu)) GROUP BY 1) m),
    'plans', (SELECT jsonb_build_object(
        'free', count(*) FILTER (WHERE pl = 'free'), 'growth', count(*) FILTER (WHERE pl = 'growth' AND src = 'own'),
        'pro', count(*) FILTER (WHERE pl = 'pro'), 'team', count(*) FILTER (WHERE src = 'license'))
      FROM (SELECT effective_plan(p.id)->>'plan' AS pl, effective_plan(p.id)->>'source' AS src FROM profiles p WHERE NOT p.is_test) x),
    'paid', (SELECT jsonb_build_object('growth_month', count(*) FILTER (WHERE plan = 'growth' AND billing_period = 'month' AND stripe_subscription_id IS NOT NULL),
        'growth_year', count(*) FILTER (WHERE plan = 'growth' AND billing_period = 'year' AND stripe_subscription_id IS NOT NULL),
        'pro_month', count(*) FILTER (WHERE plan = 'pro' AND billing_period = 'month' AND stripe_subscription_id IS NOT NULL),
        'pro_year', count(*) FILTER (WHERE plan = 'pro' AND billing_period = 'year' AND stripe_subscription_id IS NOT NULL))
      FROM billing_accounts WHERE status IN ('active','past_due') AND NOT user_id = ANY(_tu)),
    'licenses', (SELECT jsonb_build_object('team25', count(*) FILTER (WHERE tier = 'team25'), 'team100', count(*) FILTER (WHERE tier = 'team100'))
      FROM team_licenses WHERE status IN ('active','past_due') AND NOT is_preview AND NOT leader_id = ANY(_tu)),
    'weeks', (SELECT jsonb_agg(jsonb_build_object('week', w,
        'signups', (SELECT count(*) FROM auth.users WHERE created_at >= w AND created_at < w + interval '7 days' AND NOT id = ANY(_tu)),
        'checkins', (SELECT count(*) FROM rsvps r JOIN events e ON e.id = r.event_id WHERE r.checked_in_at >= w AND r.checked_in_at < w + interval '7 days' AND NOT e.host_id = ANY(_tu) AND (r.user_id IS NULL OR NOT r.user_id = ANY(_tu)))) ORDER BY w)
      FROM generate_series(date_trunc('week', now()) - interval '11 weeks', date_trunc('week', now()), interval '7 days') w)
  ) INTO _r;
  RETURN _r;
END; $function$;