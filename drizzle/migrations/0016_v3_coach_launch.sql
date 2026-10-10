CREATE TABLE public.coach_steps (
  user_id uuid NOT NULL DEFAULT auth.uid(),
  step text NOT NULL CHECK (step IN ('profile','offer','shared','first_rsvp','first_paid','first_100','earn_100','earn_1000','earn_10000','dismissed')),
  celebrated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, step)
);
GRANT SELECT, INSERT, DELETE ON public.coach_steps TO authenticated;
GRANT ALL ON public.coach_steps TO service_role;
ALTER TABLE public.coach_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own coach steps" ON public.coach_steps FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Private to the caller: only their own earnings, never shown to others
CREATE OR REPLACE FUNCTION public.coach_checklist() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _u uuid := auth.uid(); _p public.profiles; _earned bigint; _paid int;
BEGIN
  IF _u IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO _p FROM public.profiles WHERE id = _u;
  SELECT coalesce(sum(amount_cents - coalesce(fee_cents,0)),0), count(*) INTO _earned, _paid FROM public.payments WHERE host_id = _u AND status = 'paid';
  RETURN jsonb_build_object(
    'profile', _p.avatar_url IS NOT NULL AND length(coalesce(_p.bio,'')) > 0 AND _p.full_name IS NOT NULL,
    'offer', EXISTS (SELECT 1 FROM public.offers WHERE host_id = _u AND status = 'published' AND kind = 'membership')
          OR EXISTS (SELECT 1 FROM public.events e WHERE e.host_id = _u AND e.status = 'published' AND coalesce((public.event_price(e.id)->>'price_cents')::int,0) > 0),
    'shared', EXISTS (SELECT 1 FROM public.coach_steps WHERE user_id = _u AND step = 'shared'),
    'first_rsvp', EXISTS (SELECT 1 FROM public.rsvps r JOIN public.events e ON e.id = r.event_id WHERE e.host_id = _u AND r.user_id IS DISTINCT FROM _u AND r.status IN ('going','waitlist','maybe')),
    'first_paid', _paid > 0 OR EXISTS (SELECT 1 FROM public.offer_purchases op JOIN public.offers o ON o.id = op.offer_id WHERE o.host_id = _u AND o.price_cents > 0 AND op.status IN ('active','paid')),
    'earned_cents', _earned,
    'celebrated', coalesce((SELECT jsonb_agg(step) FROM public.coach_steps WHERE user_id = _u), '[]'::jsonb),
    'is_host', EXISTS (SELECT 1 FROM public.team_members WHERE user_id = _u AND role IN ('leader','host'))
  );
END $$;
REVOKE ALL ON FUNCTION public.coach_checklist() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.coach_checklist() TO authenticated;

-- Neutral price guidance from anonymous platform data (needs >=20 gatherings from >=5 hosts)
CREATE OR REPLACE FUNCTION public.price_guidance(_category text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH p AS (
    SELECT e.host_id, coalesce((public.event_price(e.id)->>'price_cents')::int, 0) cents
    FROM public.events e WHERE e.status = 'published' AND e.starts_at > now() - interval '180 days'
      AND (nullif(_category,'') IS NULL OR e.category = _category)
  )
  SELECT CASE WHEN count(*) >= 20 AND count(DISTINCT host_id) >= 5 THEN jsonb_build_object('sample', false,
      'low', percentile_disc(0.2) WITHIN GROUP (ORDER BY cents), 'high', percentile_disc(0.8) WITHIN GROUP (ORDER BY cents), 'n', count(*))
    ELSE jsonb_build_object('sample', true, 'low', 0, 'high', 2500, 'n', 0) END FROM p
$$;
REVOKE ALL ON FUNCTION public.price_guidance(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.price_guidance(text) TO authenticated;