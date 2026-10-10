CREATE TABLE public.plan_settings (
  plan text PRIMARY KEY CHECK (plan IN ('free','growth','pro')),
  fee_percent numeric(5,2) NOT NULL CHECK (fee_percent >= 0 AND fee_percent <= 30),
  monthly_cap integer CHECK (monthly_cap IS NULL OR monthly_cap >= 0),
  monthly_price integer NOT NULL DEFAULT 0 CHECK (monthly_price >= 0),
  legacy boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.plan_settings IS 'Host plan numbers in cents (monthly_cap, monthly_price). growth is a legacy plan kept for existing subscribers.';
GRANT SELECT ON public.plan_settings TO anon, authenticated;
GRANT ALL ON public.plan_settings TO service_role;
ALTER TABLE public.plan_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read plan settings" ON public.plan_settings FOR SELECT TO anon, authenticated USING (true);
INSERT INTO public.plan_settings (plan, fee_percent, monthly_cap, monthly_price, legacy) VALUES
  ('free', 7, 9900, 0, false), ('pro', 0, NULL, 9900, false), ('growth', 4, 9900, 2900, true);

ALTER TABLE public.billing_accounts ADD COLUMN legacy_price_cents integer;
UPDATE public.billing_accounts SET legacy_price_cents = CASE plan WHEN 'growth' THEN (CASE billing_period WHEN 'year' THEN 29000 ELSE 2900 END) ELSE (CASE billing_period WHEN 'year' THEN 79000 ELSE 7900 END) END
  WHERE plan IN ('growth','pro') AND stripe_subscription_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.plan_limits(_plan text) RETURNS jsonb LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT (CASE _plan
    WHEN 'pro' THEN '{"gatherings":null,"guests":null,"storage_mb":102400,"assistant":2000}'::jsonb
    WHEN 'growth' THEN '{"gatherings":null,"guests":150,"storage_mb":10240,"assistant":500}'::jsonb
    ELSE '{"gatherings":4,"guests":30,"storage_mb":500,"assistant":50}'::jsonb END)
  || jsonb_build_object('fee_pct', coalesce((SELECT fee_percent FROM plan_settings WHERE plan = CASE WHEN _plan IN ('pro','growth') THEN _plan ELSE 'free' END), 0),
       'fee_cap', (SELECT monthly_cap FROM plan_settings WHERE plan = CASE WHEN _plan IN ('pro','growth') THEN _plan ELSE 'free' END));
$$;

-- Platform fees a host has paid (or has in checkout right now) this calendar month (UTC).
CREATE OR REPLACE FUNCTION public.host_fees_this_month(_host uuid) RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT coalesce(sum(fee_cents), 0)::int FROM payments
  WHERE host_id = _host AND created_at >= date_trunc('month', now())
    AND (status = 'paid' OR (status = 'pending' AND created_at > now() - interval '1 hour'));
$$;

-- The exact platform fee for a new sale: percent of the amount, never past the monthly cap.
CREATE OR REPLACE FUNCTION public.platform_fee_cents(_host uuid, _amount integer) RETURNS integer LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE lim jsonb := plan_limits(effective_plan(_host)->>'plan'); _fee int; _cap int;
BEGIN
  _fee := round(greatest(_amount, 0) * (lim->>'fee_pct')::numeric / 100);
  _cap := (lim->>'fee_cap')::int;
  IF _cap IS NOT NULL THEN _fee := least(_fee, greatest(_cap - host_fees_this_month(_host), 0)); END IF;
  RETURN _fee;
END; $$;

CREATE OR REPLACE FUNCTION public.current_fee_pct(_host uuid) RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE lim jsonb := plan_limits(effective_plan(_host)->>'plan');
BEGIN
  IF (lim->>'fee_cap') IS NOT NULL AND host_fees_this_month(_host) >= (lim->>'fee_cap')::int THEN RETURN 0; END IF;
  RETURN (lim->>'fee_pct')::numeric;
END; $$;
REVOKE EXECUTE ON FUNCTION public.host_fees_this_month(uuid), public.platform_fee_cents(uuid, integer), public.current_fee_pct(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.host_fees_this_month(uuid), public.platform_fee_cents(uuid, integer), public.current_fee_pct(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.event_price(_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT CASE WHEN e.price_cents IS NULL THEN NULL ELSE jsonb_build_object('price_cents', e.price_cents, 'pass_fee', e.pass_fee,
    'fee_pct', current_fee_pct(e.host_id)) END
  FROM events e WHERE e.id = _id AND e.status = 'published' AND (e.visibility = 'public' OR public.can_view_event(e.id));
$$;

CREATE OR REPLACE FUNCTION public.my_plan_status() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
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
    'connect_status', coalesce(b.connect_status, 'not_started'), 'pass_fee', coalesce(b.pass_fee, false),
    'legacy_price_cents', b.legacy_price_cents, 'fees_month', host_fees_this_month(_uid),
    'usage', jsonb_build_object('gatherings', gatherings_this_month(_uid), 'largest_guests', _largest,
      'storage_bytes', storage_used_bytes(_uid), 'assistant', _ai));
END; $$;