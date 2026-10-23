-- Blueprint v4 foundation: versioned rules, provider event log, orders ledger, entitlements, managers.
-- Additive only. Historical tables (payments, stripe_events, plan_settings) are untouched.

CREATE TABLE public.fee_rules (
  id text PRIMARY KEY,
  percent numeric(6,3) NOT NULL CHECK (percent >= 0 AND percent <= 100),
  fixed_cents integer NOT NULL DEFAULT 0 CHECK (fixed_cents >= 0),
  cap_cents integer CHECK (cap_cents IS NULL OR cap_cents >= 0),
  applies_to text[] NOT NULL,
  is_legacy boolean NOT NULL DEFAULT false,
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.fee_rules (id, percent, fixed_cents, cap_cents, applies_to, is_legacy, effective_from, effective_to, note) VALUES
 ('legacy_free_7', 7, 0, 9900, ARRAY['event','resource','membership','challenge'], true, '2026-01-01', '2026-10-23', 'Pre-v4 Free plan fee, monthly cap'),
 ('legacy_growth_2', 2, 0, NULL, ARRAY['event','resource','membership','challenge'], true, '2026-01-01', '2026-10-23', 'Pre-v4 Growth/Advanced plan fee'),
 ('legacy_pro_0', 0, 0, NULL, ARRAY['event','resource','membership','challenge'], true, '2026-01-01', '2026-10-23', 'Pre-v4 Pro plan fee'),
 ('legacy_guest_service_3_49', 3, 49, NULL, ARRAY['event'], true, '2026-01-01', '2026-10-23', 'Pre-v4 guest service fee'),
 ('v4_flat_5', 5, 0, NULL, ARRAY['event','course','resource','membership','course_subscription'], false, '2026-10-23', NULL, 'Blueprint v4: flat 5%, every plan; free offerings 0; Stripe processing separate');

CREATE TABLE public.price_versions (
  id text PRIMARY KEY,
  plan text NOT NULL,
  billing_interval text NOT NULL CHECK (billing_interval IN ('month','year')),
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  currency text NOT NULL DEFAULT 'usd',
  stripe_lookup_key text,
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.price_versions (id, plan, billing_interval, amount_cents, stripe_lookup_key, effective_from) VALUES
 ('free_month_v4','free','month',0,NULL,'2026-10-23'),
 ('advanced_month_v4','advanced','month',4900,'advanced_monthly','2026-10-23'),
 ('pro_month_v4','pro','month',9900,'pro_monthly','2026-10-23'),
 ('team25_month_v4','team25','month',19900,'team25_monthly','2026-10-23'),
 ('team100_month_v4','team100','month',49900,'team100_monthly','2026-10-23'),
 ('advanced_year_v4','advanced','year',49000,NULL,'2026-10-23'),
 ('pro_year_v4','pro','year',99000,NULL,'2026-10-23'),
 ('team25_year_v4','team25','year',199000,NULL,'2026-10-23'),
 ('team100_year_v4','team100','year',499000,NULL,'2026-10-23');

CREATE TABLE public.plan_limit_versions (
  id text PRIMARY KEY,
  plan text NOT NULL,
  limits jsonb NOT NULL DEFAULT '{}'::jsonb,
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.consent_text_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('waiver','guardian','marketing_email','marketing_sms','terms','privacy')),
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  version integer NOT NULL,
  locale text NOT NULL CHECK (locale IN ('en','es')),
  body text NOT NULL,
  body_sha256 text NOT NULL,
  effective_from timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, team_id, version, locale)
);
-- Backfill current team waivers so existing acceptances (team_id, version) stay reproducible.
INSERT INTO public.consent_text_versions (kind, team_id, version, locale, body, body_sha256)
SELECT 'waiver', w.team_id, w.version, 'en', coalesce(w.body_en,''), encode(sha256(convert_to(coalesce(w.body_en,''),'UTF8')),'hex') FROM public.waivers w
UNION ALL
SELECT 'waiver', w.team_id, w.version, 'es', coalesce(w.body_es,''), encode(sha256(convert_to(coalesce(w.body_es,''),'UTF8')),'hex') FROM public.waivers w;

CREATE TABLE public.refund_policy_versions (
  id text PRIMARY KEY,
  applies_to text NOT NULL,
  rules jsonb NOT NULL,
  summary_en text NOT NULL,
  summary_es text NOT NULL,
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.refund_policy_versions (id, applies_to, rules, summary_en, summary_es, effective_from) VALUES
 ('event_default_v1','event',
  '{"default":"final_sale","discretionary_pre_event":{"follows":"host_policy","platform_fee_refunded":false,"unless_required_by_law":true},"host_cancels":{"refund":["ticket","tax","service_fee","platform_fee"],"invalidate_access":true,"invalidate_wallet":true},"reschedule":{"keep_registration":true,"notify":true,"allow_decline_refund_per_policy":true}}',
  'Tickets are final unless the host states otherwise. If the host cancels, you get a full refund. If the event moves, your spot is kept and you can decline under the host''s policy.',
  'Las entradas son finales salvo que el anfitrión indique otra cosa. Si el anfitrión cancela, recibes un reembolso total. Si el evento cambia de fecha, conservas tu lugar y puedes rechazarlo según la política del anfitrión.',
  '2026-10-23');

CREATE TABLE public.payout_policy_versions (
  id text PRIMARY KEY,
  applies_to text NOT NULL,
  release_trigger text NOT NULL CHECK (release_trigger IN ('after_event_end','after_purchase')),
  release_offset_hours integer CHECK (release_offset_hours IS NULL OR release_offset_hours >= 0),
  is_configured boolean NOT NULL DEFAULT false,
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.payout_policy_versions (id, applies_to, release_trigger, release_offset_hours, is_configured, effective_from, note) VALUES
 ('event_after_end_v1','event','after_event_end',NULL,false,'2026-10-23','Interval set with Stripe/compliance work (Prompt 6); no payout releases until configured');

CREATE TABLE public.config_versions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  config_key text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  changed_by uuid,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Generic provider event log (stripe_events stays as a historical table).
CREATE TABLE public.provider_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider IN ('stripe','resend','mailgun','twilio','wallet_apple','wallet_google','other')),
  environment text NOT NULL CHECK (environment IN ('sandbox','live')),
  provider_event_id text NOT NULL,
  event_type text NOT NULL,
  payload_sha256 text,
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received','processed','ignored','failed')),
  attempts integer NOT NULL DEFAULT 1,
  error text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  UNIQUE (provider, environment, provider_event_id)
);

-- Entity-specific assignments (events reuse event_cohosts).
CREATE TABLE public.track_managers (
  track_id uuid NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'manager' CHECK (role IN ('manager','editor')),
  assigned_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (track_id, user_id)
);
CREATE TABLE public.offer_managers (
  offer_id uuid NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'manager' CHECK (role IN ('manager','editor')),
  assigned_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (offer_id, user_id)
);

-- Orders ledger: every new sale snapshots its economics.
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL UNIQUE,
  offering_type text NOT NULL CHECK (offering_type IN ('event','course','resource','membership','course_subscription','platform_plan','legacy')),
  event_id uuid REFERENCES public.events(id) ON DELETE RESTRICT,
  offer_id uuid REFERENCES public.offers(id) ON DELETE RESTRICT,
  track_id uuid REFERENCES public.tracks(id) ON DELETE RESTRICT,
  rsvp_id uuid REFERENCES public.rsvps(id) ON DELETE SET NULL,
  legacy_payment_id uuid UNIQUE REFERENCES public.payments(id) ON DELETE RESTRICT,
  host_id uuid,
  buyer_user_id uuid,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','partially_refunded','refunded','cancelled','failed','disputed')),
  currency text NOT NULL DEFAULT 'usd',
  gross_cents integer NOT NULL CHECK (gross_cents >= 0),
  discount_cents integer NOT NULL DEFAULT 0 CHECK (discount_cents >= 0),
  tax_cents integer NOT NULL DEFAULT 0 CHECK (tax_cents >= 0),
  processor_fee_cents integer CHECK (processor_fee_cents IS NULL OR processor_fee_cents >= 0),
  platform_fee_cents integer NOT NULL CHECK (platform_fee_cents >= 0),
  fee_rule_id text NOT NULL REFERENCES public.fee_rules(id),
  price_version_id text REFERENCES public.price_versions(id),
  refund_policy_version_id text REFERENCES public.refund_policy_versions(id),
  refund_policy_text text,
  promo_id uuid,
  stripe_checkout_session_id text UNIQUE,
  stripe_payment_intent_id text,
  connected_account_id text,
  environment text CHECK (environment IS NULL OR environment IN ('sandbox','live')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX orders_host_idx ON public.orders(host_id);
CREATE INDEX orders_buyer_idx ON public.orders(buyer_user_id);
CREATE INDEX orders_event_idx ON public.orders(event_id);

CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  item_type text NOT NULL CHECK (item_type IN ('ticket','addon','course','resource','membership','plan')),
  description text,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_cents integer NOT NULL CHECK (unit_cents >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  idempotency_key text NOT NULL UNIQUE,
  reason text NOT NULL CHECK (reason IN ('host_cancelled','discretionary','reschedule_decline','dispute','fraud','legal','other')),
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  platform_fee_refunded_cents integer NOT NULL DEFAULT 0 CHECK (platform_fee_refunded_cents >= 0),
  refund_policy_version_id text REFERENCES public.refund_policy_versions(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','succeeded','failed')),
  stripe_refund_id text UNIQUE,
  requested_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.payout_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  payout_policy_version_id text NOT NULL REFERENCES public.payout_policy_versions(id),
  reason text NOT NULL CHECK (reason IN ('awaiting_event_end','refund','dispute','cancellation','fraud','policy','offset')),
  release_after timestamptz,
  released_at timestamptz,
  amount_cents integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('event','course','resource','membership','course_subscription','platform_plan')),
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  offer_id uuid REFERENCES public.offers(id) ON DELETE CASCADE,
  track_id uuid REFERENCES public.tracks(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  source text NOT NULL CHECK (source IN ('order','subscription','free','founding','admin','legacy')),
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  revoked_at timestamptz,
  revoke_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(event_id, offer_id, track_id) <= 1)
);
CREATE INDEX entitlements_user_idx ON public.entitlements(user_id);

-- Immutability: referenced economic rules cannot change after use.
CREATE OR REPLACE FUNCTION public.guard_fee_rule_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF (NEW.percent, NEW.fixed_cents, NEW.cap_cents, NEW.applies_to) IS DISTINCT FROM (OLD.percent, OLD.fixed_cents, OLD.cap_cents, OLD.applies_to)
     AND (OLD.is_legacy OR EXISTS (SELECT 1 FROM public.orders o WHERE o.fee_rule_id = OLD.id)) THEN
    RAISE EXCEPTION 'fee_rule_in_use: create a new fee rule version instead';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER fee_rules_immutable BEFORE UPDATE ON public.fee_rules FOR EACH ROW EXECUTE FUNCTION public.guard_fee_rule_immutable();

CREATE OR REPLACE FUNCTION public.guard_order_economics() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF (NEW.gross_cents, NEW.discount_cents, NEW.tax_cents, NEW.platform_fee_cents, NEW.fee_rule_id, NEW.currency, NEW.price_version_id, NEW.refund_policy_version_id, NEW.refund_policy_text)
     IS DISTINCT FROM (OLD.gross_cents, OLD.discount_cents, OLD.tax_cents, OLD.platform_fee_cents, OLD.fee_rule_id, OLD.currency, OLD.price_version_id, OLD.refund_policy_version_id, OLD.refund_policy_text) THEN
    RAISE EXCEPTION 'order_economics_immutable';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER orders_economics_immutable BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.guard_order_economics();

-- Fee math (pure). Free => 0. Applies percent + fixed, then cap.
CREATE OR REPLACE FUNCTION public.calc_platform_fee_cents(_net_cents integer, _rule text) RETURNS integer
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT CASE WHEN coalesce(_net_cents,0) <= 0 THEN 0 ELSE
    LEAST(coalesce(r.cap_cents, 2147483647), round(_net_cents * r.percent / 100.0)::int + r.fixed_cents) END
  FROM public.fee_rules r WHERE r.id = _rule;
$$;
CREATE OR REPLACE FUNCTION public.active_fee_rule(_offering_type text, _at timestamptz DEFAULT now()) RETURNS text
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT id FROM public.fee_rules
  WHERE NOT is_legacy AND _offering_type = ANY(applies_to) AND effective_from <= _at AND (effective_to IS NULL OR effective_to > _at)
  ORDER BY effective_from DESC LIMIT 1;
$$;

-- Participant access: host, event co-host (assigned) or entity manager. Team leadership alone is NOT enough.
CREATE OR REPLACE FUNCTION public.can_access_event_participants(_event uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.events e WHERE e.id = _event
      AND (e.host_id = auth.uid() OR EXISTS (SELECT 1 FROM public.event_cohosts c WHERE c.event_id = e.id AND c.user_id = auth.uid())));
$$;
CREATE OR REPLACE FUNCTION public.can_access_offer_participants(_offer uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.offers o WHERE o.id = _offer
      AND (o.host_id = auth.uid() OR EXISTS (SELECT 1 FROM public.offer_managers m WHERE m.offer_id = o.id AND m.user_id = auth.uid())));
$$;
CREATE OR REPLACE FUNCTION public.can_access_track_participants(_track uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.track_managers m WHERE m.track_id = _track AND m.user_id = auth.uid());
$$;
CREATE OR REPLACE FUNCTION public.has_entitlement(_kind text, _target uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.entitlements x WHERE x.user_id = auth.uid() AND x.kind = _kind
      AND _target IN (x.event_id, x.offer_id, x.track_id)
      AND x.revoked_at IS NULL AND x.starts_at <= now() AND (x.ends_at IS NULL OR x.ends_at > now()));
$$;
REVOKE ALL ON FUNCTION public.can_access_event_participants(uuid), public.can_access_offer_participants(uuid), public.can_access_track_participants(uuid), public.has_entitlement(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_event_participants(uuid), public.can_access_offer_participants(uuid), public.can_access_track_participants(uuid), public.has_entitlement(text, uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.guard_fee_rule_immutable(), public.guard_order_economics() FROM PUBLIC, anon, authenticated;

-- Grants
GRANT SELECT ON public.fee_rules, public.price_versions, public.refund_policy_versions TO anon, authenticated;
GRANT SELECT ON public.plan_limit_versions, public.consent_text_versions, public.payout_policy_versions TO authenticated;
GRANT SELECT ON public.orders, public.order_items, public.refunds, public.payout_holds, public.entitlements, public.track_managers, public.offer_managers TO authenticated;
GRANT ALL ON public.fee_rules, public.price_versions, public.plan_limit_versions, public.consent_text_versions, public.refund_policy_versions, public.payout_policy_versions, public.config_versions, public.provider_events, public.track_managers, public.offer_managers, public.orders, public.order_items, public.refunds, public.payout_holds, public.entitlements TO service_role;

-- RLS
ALTER TABLE public.fee_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_limit_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_text_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refund_policy_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_policy_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.track_managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entitlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone reads fee rules" ON public.fee_rules FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Anyone reads plan prices" ON public.price_versions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Anyone reads refund policies" ON public.refund_policy_versions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Signed-in read plan limits" ON public.plan_limit_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Signed-in read payout policies" ON public.payout_policy_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Platform or own-team consent texts" ON public.consent_text_versions FOR SELECT TO authenticated
  USING (team_id IS NULL OR public.is_team_member(team_id, ARRAY['leader','host','member']));
CREATE POLICY "Admins read config history" ON public.config_versions FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
GRANT SELECT ON public.config_versions TO authenticated;
-- provider_events: no client policies (service role only).
CREATE POLICY "Managers see own assignment or host sees track managers" ON public.track_managers FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.can_edit_track(track_id));
CREATE POLICY "Managers see own assignment or host sees offer managers" ON public.offer_managers FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.offers o WHERE o.id = offer_id AND o.host_id = auth.uid()));
CREATE POLICY "Buyer, seller or assigned manager reads order" ON public.orders FOR SELECT TO authenticated
  USING (buyer_user_id = auth.uid() OR host_id = auth.uid()
     OR (event_id IS NOT NULL AND public.can_access_event_participants(event_id))
     OR (offer_id IS NOT NULL AND public.can_access_offer_participants(offer_id))
     OR (track_id IS NOT NULL AND public.can_access_track_participants(track_id)));
CREATE POLICY "Order readers read items" ON public.order_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id));
CREATE POLICY "Order readers read refunds" ON public.refunds FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id));
CREATE POLICY "Seller reads payout holds" ON public.payout_holds FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.host_id = auth.uid()));
CREATE POLICY "Holder or offering manager reads entitlements" ON public.entitlements FOR SELECT TO authenticated
  USING (user_id = auth.uid()
     OR (event_id IS NOT NULL AND public.can_access_event_participants(event_id))
     OR (offer_id IS NOT NULL AND public.can_access_offer_participants(offer_id))
     OR (track_id IS NOT NULL AND public.can_access_track_participants(track_id)));

COMMENT ON TABLE public.stripe_events IS 'HISTORICAL: pre-v4 Stripe event ids; new provider idempotency uses provider_events';
COMMENT ON COLUMN public.plan_settings.fee_percent IS 'DEPRECATED for future pricing: see fee_rules (v4_flat_5); kept for historical reproducibility';
COMMENT ON COLUMN public.plan_settings.monthly_cap IS 'DEPRECATED for future pricing: v4 has no fee cap';
COMMENT ON COLUMN public.plan_settings.service_fee_percent IS 'DEPRECATED for future pricing: guest service fee retired in v4';
COMMENT ON COLUMN public.plan_settings.service_fee_fixed IS 'DEPRECATED for future pricing: guest service fee retired in v4';
COMMENT ON TABLE public.payments IS 'LEGACY economic records; preserved unchanged. New sales use orders with fee_rule_id.';
