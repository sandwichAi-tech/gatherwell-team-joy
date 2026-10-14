ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS no_limits_until timestamptz;

-- Existing hosts: 30 days from this change.
UPDATE public.profiles p SET no_limits_until = now() + interval '30 days'
WHERE no_limits_until IS NULL AND EXISTS (SELECT 1 FROM public.events e WHERE e.host_id = p.id);

CREATE OR REPLACE FUNCTION public.host_no_limits_until(_uid uuid)
RETURNS timestamptz LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT no_limits_until FROM profiles WHERE id = _uid $$;

-- Set once, when the person finishes going live.
CREATE OR REPLACE FUNCTION public.start_hosting_window()
RETURNS timestamptz LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path TO 'public'
AS $$
  UPDATE profiles SET no_limits_until = coalesce(no_limits_until, now() + interval '30 days')
  WHERE id = auth.uid() RETURNING no_limits_until;
$$;
REVOKE ALL ON FUNCTION public.start_hosting_window() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.start_hosting_window() TO authenticated;

-- Gatherings dated inside the window don't count toward the monthly limit.
CREATE OR REPLACE FUNCTION public.gatherings_in_month(_uid uuid, _at timestamptz)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT count(*)::int FROM events
  WHERE host_id = _uid AND status <> 'cancelled'
    AND starts_at >= date_trunc('month', _at) AND starts_at < date_trunc('month', _at) + interval '1 month'
    AND starts_at >= coalesce(host_no_limits_until(_uid), '-infinity'::timestamptz);
$$;

CREATE OR REPLACE FUNCTION public.enforce_gathering_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _max int; _nlu timestamptz;
BEGIN
  IF coalesce(auth.jwt()->>'role','') = 'service_role' THEN RETURN NEW; END IF;
  -- Fallback: someone who starts hosting without finishing go-live still gets the window.
  UPDATE profiles SET no_limits_until = now() + interval '30 days' WHERE id = NEW.host_id AND no_limits_until IS NULL;
  _nlu := host_no_limits_until(NEW.host_id);
  _max := (plan_limits(effective_plan(NEW.host_id)->>'plan')->>'gatherings')::int;
  IF _max IS NOT NULL AND NEW.status <> 'cancelled' AND NOT (_nlu IS NOT NULL AND NEW.starts_at < _nlu)
     AND gatherings_in_month(NEW.host_id, NEW.starts_at) >= _max THEN
    IF NEW.series_id IS NOT NULL AND EXISTS (SELECT 1 FROM events WHERE series_id = NEW.series_id) THEN RETURN NULL; END IF;
    RAISE EXCEPTION 'plan_limit_gatherings';
  END IF;
  IF NEW.price_cents IS NOT NULL AND NOT EXISTS (SELECT 1 FROM billing_accounts WHERE user_id = NEW.host_id AND connect_status = 'active') THEN
    NEW.price_cents := NULL;
  END IF;
  RETURN NEW;
END; $$;

-- Gatherings dated inside the window have no plan guest limit.
CREATE OR REPLACE FUNCTION public.guest_cap(_event uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT CASE WHEN (plan_limits(effective_plan(e.host_id)->>'plan')->>'guests') IS NULL
      OR e.starts_at < coalesce(host_no_limits_until(e.host_id), '-infinity'::timestamptz) THEN e.capacity
    ELSE least(coalesce(e.capacity, 100000), (plan_limits(effective_plan(e.host_id)->>'plan')->>'guests')::int) END
  FROM events e WHERE e.id = _event;
$$;

CREATE OR REPLACE FUNCTION public.host_sales_this_month(_host uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT coalesce(sum(amount_cents - coalesce(service_fee_cents, 0)), 0)::int FROM payments
  WHERE host_id = _host AND status = 'paid' AND created_at >= date_trunc('month', now());
$$;
REVOKE ALL ON FUNCTION public.host_sales_this_month(uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.host_no_limits_until(uuid) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.my_plan_status()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
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
    'sales_month', host_sales_this_month(_uid), 'no_limits_until', host_no_limits_until(_uid),
    'founding', founding_status(_uid),
    'usage', jsonb_build_object('gatherings', gatherings_this_month(_uid), 'largest_guests', _largest,
      'storage_bytes', storage_used_bytes(_uid), 'assistant', _ai));
END; $$;