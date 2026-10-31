-- Proposed repair, disposable-only verified; NOT applied to shared Cloud.
-- Initial and deferred admission guards must agree on locale and immutable hash.
CREATE OR REPLACE FUNCTION public.platform_registration_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e events;
BEGIN
 IF TG_OP='UPDATE' AND NEW.event_id IS DISTINCT FROM OLD.event_id THEN RAISE EXCEPTION 'agreement_event_locked'; END IF;
 IF TG_OP='UPDATE' AND (NEW.status,NEW.checked_in_at,NEW.language) IS NOT DISTINCT FROM (OLD.status,OLD.checked_in_at,OLD.language) THEN RETURN NEW; END IF;
 IF NEW.status IN('cancelled','declined') THEN RETURN NEW; END IF;
 SELECT * INTO e FROM events WHERE id=NEW.event_id;
 IF e.platform_agreement_en IS NULL OR e.platform_agreement_es IS NULL THEN RAISE EXCEPTION 'approved_legal_document_required'; END IF;
 IF coalesce(current_setting('gw.platform_agreement',true),'')<>NEW.event_id::text AND NOT EXISTS(
   SELECT 1 FROM platform_event_acceptances a JOIN consent_text_versions c ON c.id=a.document_id AND c.body_sha256=a.content_sha256
   WHERE a.rsvp_id=NEW.id AND a.event_id=NEW.event_id AND a.document_id=CASE WHEN NEW.language='es' THEN e.platform_agreement_es ELSE e.platform_agreement_en END
 ) THEN RAISE EXCEPTION 'platform_agreement_required'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.platform_registration_guard() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS rsvps_platform_agreement ON public.rsvps;
CREATE TRIGGER rsvps_platform_agreement BEFORE INSERT OR UPDATE OF status,checked_in_at,event_id,language ON public.rsvps FOR EACH ROW EXECUTE FUNCTION public.platform_registration_guard();