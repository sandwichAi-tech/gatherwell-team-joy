CREATE TABLE public.promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL,
  code text NOT NULL CHECK (code ~ '^[A-Z0-9]{3,20}$'),
  kind text NOT NULL DEFAULT 'percent' CHECK (kind IN ('percent','flat')),
  amount integer NOT NULL CHECK (amount > 0),
  applies_all boolean NOT NULL DEFAULT true,
  event_ids uuid[] NOT NULL DEFAULT '{}',
  challenge_ids uuid[] NOT NULL DEFAULT '{}',
  offer_ids uuid[] NOT NULL DEFAULT '{}',
  max_uses integer CHECK (max_uses IS NULL OR max_uses > 0),
  per_person integer CHECK (per_person IS NULL OR per_person > 0),
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (kind <> 'percent' OR amount <= 100),
  UNIQUE (host_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promo_codes TO authenticated;
GRANT ALL ON public.promo_codes TO service_role;
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Hosts manage own promo codes" ON public.promo_codes FOR ALL TO authenticated
  USING (host_id = auth.uid()) WITH CHECK (host_id = auth.uid());

ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS promo_id uuid REFERENCES public.promo_codes(id) ON DELETE SET NULL;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS discount_cents integer NOT NULL DEFAULT 0;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS buyer_key text;
CREATE INDEX IF NOT EXISTS payments_promo_idx ON public.payments(promo_id);

-- Validates a code for one purchase. Usage counts only paid payments. Never reveals other hosts' codes.
CREATE OR REPLACE FUNCTION public.check_promo(_code text, _kind text, _target uuid, _buyer text DEFAULT '')
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _host uuid; p public.promo_codes; _used int; _mine int; _key text := lower(trim(coalesce(_buyer,'')));
BEGIN
  IF _kind = 'gathering' THEN SELECT host_id INTO _host FROM events WHERE id = _target;
  ELSIF _kind = 'challenge' THEN SELECT created_by INTO _host FROM challenges WHERE id = _target;
  ELSIF _kind = 'offer' THEN SELECT host_id INTO _host FROM offers WHERE id = _target;
  END IF;
  IF _host IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid'); END IF;
  SELECT * INTO p FROM promo_codes WHERE host_id = _host AND code = upper(trim(_code));
  IF p.id IS NULL OR NOT p.active THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid'); END IF;
  IF NOT p.applies_all AND NOT (
    (_kind = 'gathering' AND _target = ANY(p.event_ids)) OR (_kind = 'challenge' AND _target = ANY(p.challenge_ids)) OR (_kind = 'offer' AND _target = ANY(p.offer_ids))
  ) THEN RETURN jsonb_build_object('ok', false, 'error', 'not_here'); END IF;
  IF p.starts_at IS NOT NULL AND now() < p.starts_at THEN RETURN jsonb_build_object('ok', false, 'error', 'not_started'); END IF;
  IF p.ends_at IS NOT NULL AND now() > p.ends_at THEN RETURN jsonb_build_object('ok', false, 'error', 'expired'); END IF;
  SELECT count(*) INTO _used FROM payments WHERE promo_id = p.id AND status = 'paid';
  IF p.max_uses IS NOT NULL AND _used >= p.max_uses THEN RETURN jsonb_build_object('ok', false, 'error', 'used_up'); END IF;
  IF p.per_person IS NOT NULL AND _key <> '' THEN
    SELECT count(*) INTO _mine FROM payments WHERE promo_id = p.id AND status = 'paid' AND buyer_key = _key;
    IF _mine >= p.per_person THEN RETURN jsonb_build_object('ok', false, 'error', 'per_person'); END IF;
  END IF;
  RETURN jsonb_build_object('ok', true, 'id', p.id, 'code', p.code, 'kind', p.kind, 'amount', p.amount);
END $$;
REVOKE ALL ON FUNCTION public.check_promo(text, text, uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.check_promo(text, text, uuid, text) TO anon, authenticated, service_role;

-- Host's own usage summary for Earnings.
CREATE OR REPLACE FUNCTION public.promo_usage()
RETURNS TABLE(promo_id uuid, uses integer, discount_cents integer) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, count(pa.id)::int, coalesce(sum(pa.discount_cents),0)::int
  FROM promo_codes p LEFT JOIN payments pa ON pa.promo_id = p.id AND pa.status = 'paid'
  WHERE p.host_id = auth.uid() GROUP BY p.id
$$;
REVOKE ALL ON FUNCTION public.promo_usage() FROM public;
GRANT EXECUTE ON FUNCTION public.promo_usage() TO authenticated;