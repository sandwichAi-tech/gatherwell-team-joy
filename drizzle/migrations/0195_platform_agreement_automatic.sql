-- The ZoheeWell event agreement is platform-owned and automatic: hosts never configure it and it never blocks
-- event creation, saving, editing, duplication or publishing. Registration stays fail-closed until an approved
-- agreement is pinned to the event.

-- 1. A dedicated document kind, so approving ordinary Terms never silently becomes the event agreement.
ALTER TABLE public.consent_text_versions DROP CONSTRAINT consent_text_versions_kind_check;
ALTER TABLE public.consent_text_versions ADD CONSTRAINT consent_text_versions_kind_check
  CHECK (kind = ANY (ARRAY['waiver','guardian','marketing_email','marketing_sms','terms','privacy','adult','event_agreement']));

CREATE OR REPLACE FUNCTION public.approved_event_agreement(_locale text) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT id FROM consent_text_versions WHERE kind='event_agreement' AND team_id IS NULL AND locale=_locale AND approved_at IS NOT NULL
    AND length(trim(approval_reference))>0 AND document_url ~ '^https://' AND effective_from<=now()
  ORDER BY version DESC, created_at DESC LIMIT 1 $$;
REVOKE ALL ON FUNCTION public.approved_event_agreement(text) FROM PUBLIC, anon, authenticated;

-- 2. Pinning: once set, a pin never changes; an empty pin may be filled once. Publishing pins the current approved
--    version when one exists and otherwise publishes without a pin (no error).
CREATE OR REPLACE FUNCTION public.pin_platform_event_agreement() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF TG_OP='UPDATE' AND ((OLD.platform_agreement_en IS NOT NULL AND NEW.platform_agreement_en IS DISTINCT FROM OLD.platform_agreement_en)
     OR (OLD.platform_agreement_es IS NOT NULL AND NEW.platform_agreement_es IS DISTINCT FROM OLD.platform_agreement_es)) THEN
    RAISE EXCEPTION 'agreement_pinned';
  END IF;
  IF NEW.status='published' THEN
    NEW.platform_agreement_en := coalesce(NEW.platform_agreement_en, approved_event_agreement('en'));
    NEW.platform_agreement_es := coalesce(NEW.platform_agreement_es, approved_event_agreement('es'));
  END IF;
  RETURN NEW;
END $$;

-- 3. Reference validation only checks pins that are present; a missing agreement never blocks publishing.
CREATE OR REPLACE FUNCTION public.verify_platform_event_reference() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.platform_agreement_en IS NOT NULL AND NEW.platform_agreement_en IS DISTINCT FROM (CASE WHEN TG_OP='UPDATE' THEN OLD.platform_agreement_en END)
     AND NOT EXISTS (SELECT 1 FROM consent_text_versions c WHERE c.id=NEW.platform_agreement_en AND c.kind IN ('event_agreement','terms') AND c.team_id IS NULL AND c.locale='en'
       AND c.approved_at IS NOT NULL AND length(trim(c.approval_reference))>0 AND c.document_url ~ '^https://') THEN
    RAISE EXCEPTION 'approved_legal_document_required';
  END IF;
  IF NEW.platform_agreement_es IS NOT NULL AND NEW.platform_agreement_es IS DISTINCT FROM (CASE WHEN TG_OP='UPDATE' THEN OLD.platform_agreement_es END)
     AND NOT EXISTS (SELECT 1 FROM consent_text_versions c WHERE c.id=NEW.platform_agreement_es AND c.kind IN ('event_agreement','terms') AND c.team_id IS NULL AND c.locale='es'
       AND c.approved_at IS NOT NULL AND length(trim(c.approval_reference))>0 AND c.document_url ~ '^https://') THEN
    RAISE EXCEPTION 'approved_legal_document_required';
  END IF;
  RETURN NEW;
END $$;

-- 4. When a platform agreement is approved, fill the empty pins of published events (idempotent; never overwrites
--    an existing pin, so historical consent and published versions stay untouched).
CREATE OR REPLACE FUNCTION public.pin_unpinned_published_events() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE en uuid := approved_event_agreement('en'); es uuid := approved_event_agreement('es'); n integer;
BEGIN
  UPDATE events SET platform_agreement_en = coalesce(platform_agreement_en, en), platform_agreement_es = coalesce(platform_agreement_es, es)
   WHERE status='published' AND ((platform_agreement_en IS NULL AND en IS NOT NULL) OR (platform_agreement_es IS NULL AND es IS NOT NULL));
  GET DIAGNOSTICS n = ROW_COUNT; RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.pin_unpinned_published_events() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pin_unpinned_published_events() TO service_role;

CREATE OR REPLACE FUNCTION public.platform_agreement_approved_pin() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.kind='event_agreement' AND NEW.team_id IS NULL AND NEW.approved_at IS NOT NULL THEN PERFORM pin_unpinned_published_events(); END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS consent_event_agreement_pin ON public.consent_text_versions;
CREATE TRIGGER consent_event_agreement_pin AFTER INSERT OR UPDATE OF approved_at, approval_reference, document_url ON public.consent_text_versions
  FOR EACH ROW EXECUTE FUNCTION public.platform_agreement_approved_pin();

-- 5. Platform-admin diagnostic (not shown to hosts): approved agreement presence and published events still waiting.
CREATE OR REPLACE FUNCTION public.admin_platform_agreement_status() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not_allowed'; END IF;
  RETURN jsonb_build_object(
    'en_ready', approved_event_agreement('en') IS NOT NULL, 'es_ready', approved_event_agreement('es') IS NOT NULL,
    'published_unpinned', (SELECT count(*) FROM events WHERE status='published' AND (platform_agreement_en IS NULL OR platform_agreement_es IS NULL)));
END $$;
REVOKE ALL ON FUNCTION public.admin_platform_agreement_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_platform_agreement_status() TO authenticated, service_role;
COMMENT ON FUNCTION public.current_platform_agreement() IS 'DEPRECATED for the host builder: the event agreement is automatic; kept for admin/attendee reads.';