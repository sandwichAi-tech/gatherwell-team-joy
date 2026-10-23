-- The plan screen needs to say "ends on X" after a cancellation and "switches to
-- Advanced on X" after a scheduled downgrade, so both states come back with status.
CREATE OR REPLACE FUNCTION public.my_plan_status()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); ep jsonb; lim jsonb; b record; _largest int; _ai int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_signed_in'; END IF;
  ep := effective_plan(_uid); lim := plan_limits(ep->>'plan');
  SELECT * INTO b FROM billing_accounts WHERE user_id = _uid;
  SELECT coalesce(max(event_seats_used(id)), 0) INTO _largest FROM events
    WHERE host_id = _uid AND status = 'published' AND coalesce(ends_at, starts_at) >= now();
  SELECT count(*)::int INTO _ai FROM ai_usage WHERE user_id = _uid AND created_at >= date_trunc('month', now());
  RETURN ep || jsonb_build_object('limits', lim,
    'own_plan', coalesce(b.plan, 'free'), 'billing_period', b.billing_period, 'status', coalesce(b.status, 'active'),
    'renews_at', b.renews_at, 'has_customer', b.stripe_customer_id IS NOT NULL,
    'cancel_at_period_end', coalesce(b.cancel_at_period_end, false),
    'pending_plan', b.pending_plan, 'pending_plan_at', b.pending_plan_at,
    'connect_status', coalesce(b.connect_status, 'not_started'), 'pass_fee', coalesce(b.pass_fee, false),
    'legacy_price_cents', b.legacy_price_cents, 'fees_month', host_fees_this_month(_uid),
    'sales_month', host_sales_this_month(_uid), 'no_limits_until', host_no_limits_until(_uid),
    'founding', founding_status(_uid),
    'usage', jsonb_build_object('gatherings', gatherings_this_month(_uid), 'largest_guests', _largest,
      'storage_bytes', storage_used_bytes(_uid), 'assistant', _ai));
END; $function$;