CREATE OR REPLACE FUNCTION public.coach_referral_dashboard(_program uuid DEFAULT NULL::uuid, _referrer uuid DEFAULT NULL::uuid, _status text DEFAULT NULL::text, _from date DEFAULT NULL::date, _to date DEFAULT NULL::date)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE res jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  PERFORM public.referral_release_due();
  WITH progs AS (
    SELECT p.*, it.title, it.price_cents, it.eligible FROM referral_programs p
    CROSS JOIN LATERAL public.referral_item(p.item_kind, coalesce(p.event_id, p.offer_id)) it
    WHERE public.can_manage_offering(p.item_kind, coalesce(p.event_id, p.offer_id))
  ), rw AS (
    SELECT r.* FROM referral_rewards r JOIN progs ON progs.id = r.program_id
    WHERE (_program IS NULL OR r.program_id = _program) AND (_referrer IS NULL OR r.referrer_id = _referrer)
      AND (_status IS NULL OR r.status = _status) AND (_from IS NULL OR r.created_at::date >= _from) AND (_to IS NULL OR r.created_at::date <= _to)
  ), ck AS (
    SELECT l.program_id, l.referrer_id, count(c.id) AS clicks, count(DISTINCT c.user_id) AS signups FROM referral_links l JOIN progs ON progs.id = l.program_id
    LEFT JOIN referral_clicks c ON c.link_id = l.id AND (_from IS NULL OR c.clicked_at::date >= _from) AND (_to IS NULL OR c.clicked_at::date <= _to)
    WHERE (_program IS NULL OR l.program_id = _program) AND (_referrer IS NULL OR l.referrer_id = _referrer)
    GROUP BY 1,2
  )
  SELECT jsonb_build_object(
    'programs', coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'item_kind', item_kind, 'item_id', coalesce(event_id, offer_id), 'title', title, 'price_cents', price_cents, 'eligible', eligible,
        'enabled', enabled, 'reward_kind', reward_kind, 'reward_value', reward_value, 'window_days', window_days) ORDER BY updated_at DESC) FROM progs), '[]'),
    'referrers', coalesce((SELECT jsonb_agg(DISTINCT jsonb_build_object('id', l.referrer_id, 'name', coalesce(pr.full_name, ''))) FROM referral_links l JOIN progs ON progs.id = l.program_id LEFT JOIN profiles pr ON pr.id = l.referrer_id), '[]'),
    'totals', jsonb_build_object(
      'clicks', coalesce((SELECT sum(clicks) FROM ck), 0), 'signups', coalesce((SELECT sum(signups) FROM ck), 0),
      'conversions', (SELECT count(*) FROM rw WHERE status <> 'reversed'),
      'revenue_cents', coalesce((SELECT sum(sale_cents - refunded_cents) FROM rw WHERE status <> 'reversed'), 0),
      'pending_cents', coalesce((SELECT sum(reward_cents) FROM rw WHERE status = 'pending'), 0),
      'available_cents', coalesce((SELECT sum(reward_cents) FROM rw WHERE status = 'available'), 0),
      'paid_cents', coalesce((SELECT sum(reward_cents) FROM rw WHERE status = 'paid'), 0),
      'reversed_cents', coalesce((SELECT sum(coalesce(original_reward_cents, reward_cents)) FROM rw WHERE status = 'reversed'), 0),
      'needs_reconcile', (SELECT count(*) FROM rw WHERE refunded_after_payout)),
    'rewards', coalesce((SELECT jsonb_agg(jsonb_build_object('id', rw.id, 'program_id', rw.program_id, 'referrer_id', rw.referrer_id, 'referrer_name', coalesce(pr.full_name,''), 'sale_cents', rw.sale_cents,
        'reward_cents', rw.reward_cents, 'status', rw.status, 'created_at', rw.created_at, 'available_at', rw.available_at,
        'refunded_cents', rw.refunded_cents, 'refunded_after_payout', rw.refunded_after_payout, 'reward_kind', rw.reward_kind, 'reward_value', rw.reward_value) ORDER BY rw.created_at DESC) FROM (SELECT * FROM rw ORDER BY created_at DESC LIMIT 200) rw LEFT JOIN profiles pr ON pr.id = rw.referrer_id), '[]'),
    'payouts', coalesce((SELECT jsonb_agg(jsonb_build_object('id', po.id, 'referrer_id', po.referrer_id, 'referrer_name', coalesce(pr.full_name,''), 'amount_cents', po.amount_cents, 'paid_on', po.paid_on, 'note', po.note, 'reference', po.reference) ORDER BY po.paid_on DESC, po.created_at DESC)
        FROM referral_payouts po LEFT JOIN profiles pr ON pr.id = po.referrer_id WHERE po.host_id = auth.uid() AND (_referrer IS NULL OR po.referrer_id = _referrer)), '[]')
  ) INTO res;
  RETURN res;
END $function$;