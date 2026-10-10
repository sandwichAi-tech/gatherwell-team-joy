ALTER TABLE public.plan_settings ADD COLUMN service_fee_percent numeric(5,2) NOT NULL DEFAULT 3 CHECK (service_fee_percent >= 0 AND service_fee_percent <= 20);
ALTER TABLE public.plan_settings ADD COLUMN service_fee_fixed integer NOT NULL DEFAULT 49 CHECK (service_fee_fixed >= 0 AND service_fee_fixed <= 1000);
COMMENT ON COLUMN public.plan_settings.service_fee_fixed IS 'Guest service fee fixed part in cents, per paid ticket order.';
ALTER TABLE public.events ADD COLUMN cover_service_fee boolean NOT NULL DEFAULT false;
ALTER TABLE public.payments ADD COLUMN service_fee_cents integer NOT NULL DEFAULT 0;
ALTER TABLE public.payments ADD COLUMN service_fee_covered boolean NOT NULL DEFAULT false;

-- Guest service fee for one paid ticket order (0 for free). Numbers come from the host's plan row.
CREATE OR REPLACE FUNCTION public.service_fee_cents(_host uuid, _amount integer) RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT CASE WHEN coalesce(_amount, 0) <= 0 THEN 0 ELSE
    (SELECT round(_amount * ps.service_fee_percent / 100)::int + ps.service_fee_fixed FROM plan_settings ps
     WHERE ps.plan = CASE WHEN effective_plan(_host)->>'plan' IN ('pro','growth') THEN effective_plan(_host)->>'plan' ELSE 'free' END) END;
$$;
REVOKE EXECUTE ON FUNCTION public.service_fee_cents(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.service_fee_cents(uuid, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.event_price(_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT CASE WHEN e.price_cents IS NULL OR e.price_cents <= 0 THEN NULL ELSE jsonb_build_object('price_cents', e.price_cents, 'pass_fee', e.pass_fee,
    'fee_pct', current_fee_pct(e.host_id), 'cover_service_fee', e.cover_service_fee,
    'service_fee_percent', ps.service_fee_percent, 'service_fee_fixed', ps.service_fee_fixed) END
  FROM events e
  LEFT JOIN plan_settings ps ON ps.plan = CASE WHEN effective_plan(e.host_id)->>'plan' IN ('pro','growth') THEN effective_plan(e.host_id)->>'plan' ELSE 'free' END
  WHERE e.id = _id AND e.status = 'published' AND (e.visibility = 'public' OR public.can_view_event(e.id));
$$;