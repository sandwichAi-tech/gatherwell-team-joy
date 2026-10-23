-- Prompt 3: one identity, 18+ attestation, view modes, guardian fields, auth intents, guest claim.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS adult_confirmed_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS adult_consent_version_id uuid REFERENCES public.consent_text_versions(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS view_mode text NOT NULL DEFAULT 'attending' CHECK (view_mode IN ('attending','hosting'));
COMMENT ON COLUMN public.profiles.role_intent IS 'Onboarding hint only; never a permission source. View preference lives in view_mode.';
COMMENT ON COLUMN public.profiles.view_mode IS 'Hosting vs Attending & Learning default view; never grants permissions.';

ALTER TABLE public.consent_text_versions DROP CONSTRAINT IF EXISTS consent_text_versions_kind_check;
ALTER TABLE public.consent_text_versions ADD CONSTRAINT consent_text_versions_kind_check
  CHECK (kind = ANY (ARRAY['waiver','guardian','marketing_email','marketing_sms','terms','privacy','adult']));

INSERT INTO public.consent_text_versions (kind, team_id, version, locale, body, body_sha256, effective_from)
SELECT v.kind, NULL, 1, v.locale, v.body, encode(digest(v.body,'sha256'),'hex'), now()
FROM (VALUES
  ('adult','en','I confirm I am 18 or older.'),
  ('adult','es','Confirmo que tengo 18 años o más.'),
  ('guardian','en','I am this minor''s parent or legal guardian, I am 18 or older, and I consent to registering them for this event.'),
  ('guardian','es','Soy madre, padre o tutor legal de este menor, tengo 18 años o más y doy mi consentimiento para inscribirlo en este evento.')
) AS v(kind, locale, body)
WHERE NOT EXISTS (SELECT 1 FROM public.consent_text_versions c WHERE c.kind=v.kind AND c.team_id IS NULL AND c.version=1 AND c.locale=v.locale);

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS allows_minors boolean NOT NULL DEFAULT false;

ALTER TABLE public.rsvps ADD COLUMN IF NOT EXISTS merged_into_rsvp_id uuid REFERENCES public.rsvps(id) ON DELETE SET NULL;
ALTER TABLE public.rsvps ADD COLUMN IF NOT EXISTS merged_at timestamptz;
ALTER TABLE public.rsvps ADD COLUMN IF NOT EXISTS minor_first_name text CHECK (minor_first_name IS NULL OR length(btrim(minor_first_name)) BETWEEN 1 AND 40);
ALTER TABLE public.rsvps ADD COLUMN IF NOT EXISTS minor_age_band text CHECK (minor_age_band IS NULL OR minor_age_band IN ('under_5','5_12','13_17'));
ALTER TABLE public.rsvps ADD COLUMN IF NOT EXISTS guardian_consent_at timestamptz;
ALTER TABLE public.rsvps ADD COLUMN IF NOT EXISTS guardian_consent_version_id uuid REFERENCES public.consent_text_versions(id) ON DELETE SET NULL;
COMMENT ON COLUMN public.rsvps.merged_into_rsvp_id IS 'Set when a verified guest duplicate is merged into the canonical RSVP; row is kept for audit.';

CREATE UNIQUE INDEX IF NOT EXISTS rsvps_one_active_per_user_event
  ON public.rsvps (event_id, user_id) WHERE user_id IS NOT NULL AND status <> 'cancelled' AND merged_into_rsvp_id IS NULL;

CREATE OR REPLACE FUNCTION public.is_adult(_uid uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _uid AND adult_confirmed_at IS NOT NULL)
$$;

CREATE OR REPLACE FUNCTION public.confirm_adult(_attest boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_lang text; v_ver uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_signed_in'; END IF;
  IF _attest IS DISTINCT FROM true THEN RAISE EXCEPTION 'adult_attestation_required'; END IF;
  SELECT CASE WHEN language='es' THEN 'es' ELSE 'en' END INTO v_lang FROM public.profiles WHERE id=v_uid;
  SELECT id INTO v_ver FROM public.consent_text_versions WHERE kind='adult' AND team_id IS NULL AND locale=coalesce(v_lang,'en') ORDER BY version DESC LIMIT 1;
  UPDATE public.profiles SET adult_confirmed_at = coalesce(adult_confirmed_at, now()), adult_consent_version_id = coalesce(adult_consent_version_id, v_ver) WHERE id = v_uid;
END $$;

-- Server-side 18+ enforcement for team creation and hosting (signed-in callers; service jobs have no auth.uid()).
CREATE OR REPLACE FUNCTION public.require_adult_actor()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_adult(auth.uid()) THEN
    IF TG_TABLE_NAME = 'events' AND TG_OP = 'UPDATE' AND (NEW.status IS NOT DISTINCT FROM OLD.status OR NEW.status <> 'published') THEN RETURN NEW; END IF;
    RAISE EXCEPTION 'adult_required' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS teams_require_adult ON public.teams;
CREATE TRIGGER teams_require_adult BEFORE INSERT ON public.teams FOR EACH ROW EXECUTE FUNCTION public.require_adult_actor();
DROP TRIGGER IF EXISTS events_require_adult ON public.events;
CREATE TRIGGER events_require_adult BEFORE INSERT OR UPDATE OF status ON public.events FOR EACH ROW EXECUTE FUNCTION public.require_adult_actor();
DROP TRIGGER IF EXISTS offers_require_adult ON public.offers;
CREATE TRIGGER offers_require_adult BEFORE INSERT ON public.offers FOR EACH ROW EXECUTE FUNCTION public.require_adult_actor();

-- Guardian registrations: only on events that allow minors, with consent, adult-owned.
CREATE OR REPLACE FUNCTION public.guard_minor_registration()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.minor_first_name IS NULL AND NEW.minor_age_band IS NULL THEN RETURN NEW; END IF;
  IF NEW.minor_first_name IS NULL OR NEW.minor_age_band IS NULL THEN RAISE EXCEPTION 'minor_details_incomplete'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.events WHERE id = NEW.event_id AND allows_minors) THEN RAISE EXCEPTION 'minors_not_allowed'; END IF;
  IF NEW.guardian_consent_at IS NULL OR NEW.guardian_consent_version_id IS NULL THEN RAISE EXCEPTION 'guardian_consent_required'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS rsvps_guard_minor ON public.rsvps;
CREATE TRIGGER rsvps_guard_minor BEFORE INSERT OR UPDATE OF minor_first_name, minor_age_band, guardian_consent_at ON public.rsvps FOR EACH ROW EXECUTE FUNCTION public.guard_minor_registration();

-- Hashed, expiring, single-use return-path intents.
CREATE TABLE IF NOT EXISTS public.auth_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  path text NOT NULL CHECK (length(path) <= 512),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.auth_intents TO service_role;
ALTER TABLE public.auth_intents ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_safe_return_path(_p text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT _p IS NOT NULL AND length(_p) <= 512
    AND _p ~ '^/(e|l|t|h|i|r|join|offer|event|learn|learn/track|learn/lesson|challenge)/[A-Za-z0-9_-]{1,80}([?][A-Za-z0-9=&_-]{0,200})?$|^/(home|discover|gathering/new|events|learn|me|start)$'
$$;

CREATE OR REPLACE FUNCTION public.create_auth_intent(_path text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_token text := encode(gen_random_bytes(24), 'hex');
BEGIN
  IF NOT public.is_safe_return_path(_path) THEN RAISE EXCEPTION 'unsafe_path'; END IF;
  DELETE FROM public.auth_intents WHERE expires_at < now() - interval '1 day';
  INSERT INTO public.auth_intents (token_hash, path, expires_at) VALUES (encode(digest(v_token,'sha256'),'hex'), _path, now() + interval '30 minutes');
  RETURN v_token;
END $$;

CREATE OR REPLACE FUNCTION public.consume_auth_intent(_token text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_path text;
BEGIN
  IF _token IS NULL OR _token !~ '^[0-9a-f]{48}$' THEN RETURN NULL; END IF;
  UPDATE public.auth_intents SET consumed_at = now()
   WHERE token_hash = encode(digest(_token,'sha256'),'hex') AND consumed_at IS NULL AND expires_at > now()
   RETURNING path INTO v_path;
  RETURN v_path;
END $$;

CREATE OR REPLACE FUNCTION public.cleanup_auth_intents()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  DELETE FROM public.auth_intents WHERE expires_at < now() - interval '1 day' OR consumed_at < now() - interval '1 day';
  GET DIAGNOSTICS n = ROW_COUNT; RETURN n;
END $$;

-- Guest-claim audit log.
CREATE TABLE IF NOT EXISTS public.guest_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  rsvp_id uuid NOT NULL REFERENCES public.rsvps(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('claimed','merged')),
  canonical_rsvp_id uuid REFERENCES public.rsvps(id) ON DELETE SET NULL,
  orders_linked integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rsvp_id)
);
GRANT SELECT ON public.guest_claims TO authenticated;
GRANT ALL ON public.guest_claims TO service_role;
ALTER TABLE public.guest_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own claim history" ON public.guest_claims FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.claim_guest_records()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_email text; r record; v_canon uuid; v_orders int; n_claimed int := 0; n_merged int := 0;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_signed_in'); END IF;
  SELECT lower(btrim(email)) INTO v_email FROM auth.users WHERE id = v_uid AND email_confirmed_at IS NOT NULL;
  IF v_email IS NULL OR v_email = '' THEN RETURN jsonb_build_object('ok', false, 'reason', 'unverified'); END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('claim:' || v_email, 0));
  FOR r IN SELECT id, event_id FROM public.rsvps
            WHERE user_id IS NULL AND merged_into_rsvp_id IS NULL AND lower(btrim(guest_email)) = v_email
            ORDER BY created_at, id FOR UPDATE LOOP
    SELECT id INTO v_canon FROM public.rsvps
     WHERE event_id = r.event_id AND user_id = v_uid AND status <> 'cancelled' AND merged_into_rsvp_id IS NULL
     ORDER BY created_at, id LIMIT 1;
    UPDATE public.orders SET buyer_user_id = v_uid WHERE rsvp_id = r.id AND buyer_user_id IS NULL;
    GET DIAGNOSTICS v_orders = ROW_COUNT;
    IF v_canon IS NULL THEN
      UPDATE public.rsvps SET user_id = v_uid WHERE id = r.id;
      INSERT INTO public.guest_claims (user_id, rsvp_id, action, canonical_rsvp_id, orders_linked) VALUES (v_uid, r.id, 'claimed', r.id, v_orders) ON CONFLICT (rsvp_id) DO NOTHING;
      n_claimed := n_claimed + 1;
    ELSE
      UPDATE public.rsvps SET merged_into_rsvp_id = v_canon, merged_at = now(), status = 'cancelled' WHERE id = r.id;
      INSERT INTO public.guest_claims (user_id, rsvp_id, action, canonical_rsvp_id, orders_linked) VALUES (v_uid, r.id, 'merged', v_canon, v_orders) ON CONFLICT (rsvp_id) DO NOTHING;
      n_merged := n_merged + 1;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'claimed', n_claimed, 'merged', n_merged);
END $$;

REVOKE ALL ON FUNCTION public.claim_guest_records() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_guest_records() TO authenticated;
REVOKE ALL ON FUNCTION public.confirm_adult(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_adult(boolean) TO authenticated;
REVOKE ALL ON FUNCTION public.is_adult(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_adult(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.cleanup_auth_intents() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_auth_intent(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_auth_intent(text) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.require_adult_actor() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_minor_registration() FROM PUBLIC, anon, authenticated;
