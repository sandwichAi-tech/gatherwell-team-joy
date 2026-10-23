-- Prompt 2 corrective hardening. No business rows deleted or offering/config values changed.
ALTER TABLE public.orders ADD CONSTRAINT orders_environment_required CHECK (environment IS NOT NULL) NOT VALID;
ALTER TABLE public.orders ADD CONSTRAINT orders_offering_target_check CHECK (
 (offering_type='event' AND event_id IS NOT NULL AND num_nonnulls(offer_id,track_id,legacy_payment_id)=0) OR
 (offering_type='course' AND track_id IS NOT NULL AND num_nonnulls(event_id,offer_id,legacy_payment_id)=0) OR
 (offering_type IN ('resource','membership','course_subscription') AND offer_id IS NOT NULL AND num_nonnulls(event_id,track_id,legacy_payment_id)=0) OR
 (offering_type='legacy' AND legacy_payment_id IS NOT NULL AND num_nonnulls(event_id,offer_id,track_id)=0) OR
 (offering_type='platform_plan' AND num_nonnulls(event_id,offer_id,track_id,legacy_payment_id)=0)
) NOT VALID;
ALTER TABLE public.orders ADD CONSTRAINT orders_environment_idempotency_key UNIQUE (environment,idempotency_key);
-- Constraint-only replacement required to permit the same key in sandbox and live.
ALTER TABLE public.orders DROP CONSTRAINT orders_idempotency_key_key;
ALTER TABLE public.entitlements ADD CONSTRAINT entitlements_kind_target_check CHECK (
 (kind='event' AND event_id IS NOT NULL AND num_nonnulls(offer_id,track_id)=0) OR
 (kind='course' AND track_id IS NOT NULL AND num_nonnulls(event_id,offer_id)=0) OR
 (kind IN ('resource','membership','course_subscription') AND offer_id IS NOT NULL AND num_nonnulls(event_id,track_id)=0) OR
 (kind='platform_plan' AND num_nonnulls(event_id,offer_id,track_id)=0)
) NOT VALID;
COMMENT ON CONSTRAINT entitlements_check ON public.entitlements IS 'Redundant historical at-most-one check; stricter entitlements_kind_target_check is authoritative.';
LOCK TABLE public.profiles, public.entitlements, public.offer_managers, public.track_managers IN SHARE ROW EXCLUSIVE MODE;
DO $$
DECLARE r record; has_orphan boolean; has_invalid boolean;
BEGIN
 FOR r IN SELECT * FROM (VALUES
 ('orders','host_id','orders_host_profile_fkey','SET NULL'),
 ('orders','buyer_user_id','orders_buyer_profile_fkey','SET NULL'),
 ('entitlements','user_id','entitlements_user_profile_fkey','CASCADE'),
 ('offer_managers','user_id','offer_managers_user_profile_fkey','CASCADE'),
 ('offer_managers','assigned_by','offer_managers_assigner_profile_fkey','SET NULL'),
 ('track_managers','user_id','track_managers_user_profile_fkey','CASCADE'),
 ('track_managers','assigned_by','track_managers_assigner_profile_fkey','SET NULL')
 ) v(tbl,col,constraint_name,delete_action) LOOP
   EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I t LEFT JOIN public.profiles p ON p.id=t.%I WHERE t.%I IS NOT NULL AND p.id IS NULL)',r.tbl,r.col,r.col) INTO has_orphan;
   IF has_orphan THEN RAISE WARNING 'Skipped %: orphan profile references',r.constraint_name;
   ELSE EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.profiles(id) ON DELETE %s',r.tbl,r.constraint_name,r.col,r.delete_action); END IF;
 END LOOP;
 -- Preserve any concurrent preflight rows; validate only if they conform. NOT VALID still enforces future writes.
 FOR r IN SELECT conrelid::regclass AS tbl,conname,pg_get_expr(conbin,conrelid) AS expr FROM pg_constraint
 WHERE conname IN ('orders_environment_required','orders_offering_target_check','entitlements_kind_target_check') LOOP
   EXECUTE format('SELECT EXISTS (SELECT 1 FROM %s WHERE NOT (%s))',r.tbl,r.expr) INTO has_invalid;
   IF has_invalid THEN RAISE WARNING 'Existing rows do not satisfy %; constraint remains NOT VALID',r.conname;
   ELSE EXECUTE format('ALTER TABLE %s VALIDATE CONSTRAINT %I',r.tbl,r.conname); END IF;
 END LOOP;
END $$;
-- Host required on new host-generated orders. Allow only profile FK anonymization of existing history.
CREATE OR REPLACE FUNCTION public.require_order_host() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.offering_type IN ('event','course','resource','membership','course_subscription') AND NEW.host_id IS NULL THEN
   IF TG_OP='UPDATE' THEN
     IF OLD.host_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=OLD.host_id) THEN RETURN NEW; END IF;
   END IF;
   RAISE EXCEPTION 'host_id_required' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER orders_require_host BEFORE INSERT OR UPDATE OF host_id,offering_type ON public.orders FOR EACH ROW EXECUTE FUNCTION public.require_order_host();
REVOKE ALL ON FUNCTION public.require_order_host() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.can_access_track_participants(_track uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT auth.uid() IS NOT NULL AND (
 EXISTS (SELECT 1 FROM public.track_managers m WHERE m.track_id=_track AND m.user_id=auth.uid()) OR
 EXISTS (SELECT 1 FROM public.tracks t JOIN public.offers o ON o.id=t.offer_id WHERE t.id=_track AND o.host_id=auth.uid()));
$$;
REVOKE ALL ON FUNCTION public.can_access_track_participants(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_access_track_participants(uuid) TO authenticated,service_role;

ALTER TABLE public.waiver_acceptances ADD COLUMN consent_text_version_id uuid REFERENCES public.consent_text_versions(id) ON DELETE RESTRICT;
ALTER TABLE public.waiver_acceptances ADD COLUMN accepted_body_sha256 text;
UPDATE public.waiver_acceptances w SET consent_text_version_id=c.id,accepted_body_sha256=c.body_sha256
FROM public.rsvps r,public.consent_text_versions c
WHERE r.id=w.rsvp_id AND c.kind='waiver' AND c.team_id=w.team_id AND c.version=w.version
AND c.locale=CASE WHEN r.language IN ('en','es') THEN r.language ELSE 'en' END;
-- Preserve text versions for subsequent waiver edits; never silently alter a published version.
CREATE OR REPLACE FUNCTION public.version_waiver_text() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE lang text; txt text; existing_body text;
BEGIN
 FOREACH lang IN ARRAY ARRAY['en','es'] LOOP
   txt:=CASE WHEN lang='es' THEN NEW.body_es ELSE NEW.body_en END;
   INSERT INTO public.consent_text_versions(kind,team_id,version,locale,body,body_sha256)
   VALUES ('waiver',NEW.team_id,NEW.version,lang,txt,encode(sha256(convert_to(txt,'UTF8')),'hex')) ON CONFLICT (kind,team_id,version,locale) DO NOTHING;
   SELECT body INTO existing_body FROM public.consent_text_versions WHERE kind='waiver' AND team_id=NEW.team_id AND version=NEW.version AND locale=lang;
   IF existing_body IS DISTINCT FROM txt THEN RAISE EXCEPTION 'consent_version_conflict'; END IF;
 END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER waivers_version_text AFTER INSERT OR UPDATE ON public.waivers FOR EACH ROW EXECUTE FUNCTION public.version_waiver_text();
CREATE OR REPLACE FUNCTION public.snapshot_waiver_acceptance() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE lang text; c record; r record;
BEGIN
 IF TG_OP='UPDATE' THEN
   IF (NEW.rsvp_id,NEW.event_id,NEW.team_id,NEW.version) IS NOT DISTINCT FROM (OLD.rsvp_id,OLD.event_id,OLD.team_id,OLD.version) THEN
     NEW.consent_text_version_id:=OLD.consent_text_version_id; NEW.accepted_body_sha256:=OLD.accepted_body_sha256; RETURN NEW;
   END IF;
 END IF;
 SELECT rs.language,e.team_id,rs.event_id INTO r FROM public.rsvps rs JOIN public.events e ON e.id=rs.event_id WHERE rs.id=NEW.rsvp_id;
 IF NOT FOUND OR r.event_id IS DISTINCT FROM NEW.event_id OR r.team_id IS DISTINCT FROM NEW.team_id THEN RAISE EXCEPTION 'waiver_target_mismatch'; END IF;
 lang:=CASE WHEN r.language IN ('en','es') THEN r.language ELSE 'en' END;
 SELECT id,body_sha256 INTO c FROM public.consent_text_versions WHERE kind='waiver' AND team_id=NEW.team_id AND version=NEW.version AND locale=lang;
 IF NOT FOUND THEN RAISE EXCEPTION 'consent_version_missing'; END IF;
 NEW.consent_text_version_id:=c.id; NEW.accepted_body_sha256:=c.body_sha256;
 RETURN NEW;
END $$;
CREATE TRIGGER waiver_acceptances_snapshot BEFORE INSERT OR UPDATE ON public.waiver_acceptances FOR EACH ROW EXECUTE FUNCTION public.snapshot_waiver_acceptance();
CREATE OR REPLACE FUNCTION public.guard_consent_snapshot() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF EXISTS (SELECT 1 FROM public.waiver_acceptances WHERE consent_text_version_id=OLD.id) THEN
   IF TG_OP='DELETE' THEN RAISE EXCEPTION 'consent_version_in_use'; END IF;
   IF (NEW.id,NEW.kind,NEW.team_id,NEW.version,NEW.locale,NEW.body,NEW.body_sha256) IS DISTINCT FROM (OLD.id,OLD.kind,OLD.team_id,OLD.version,OLD.locale,OLD.body,OLD.body_sha256) THEN RAISE EXCEPTION 'consent_version_in_use'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER consent_snapshot_immutable BEFORE UPDATE OR DELETE ON public.consent_text_versions FOR EACH ROW EXECUTE FUNCTION public.guard_consent_snapshot();
REVOKE ALL ON FUNCTION public.version_waiver_text(),public.snapshot_waiver_acceptance(),public.guard_consent_snapshot() FROM PUBLIC,anon,authenticated;

ALTER TABLE public.config_versions ADD COLUMN source text;
CREATE OR REPLACE FUNCTION public.audit_feature_flag() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE old_json jsonb; new_json jsonb; flag_key text;
BEGIN
 IF TG_OP<>'INSERT' THEN old_json:=to_jsonb(OLD); flag_key:=OLD.key; END IF;
 IF TG_OP<>'DELETE' THEN new_json:=to_jsonb(NEW); flag_key:=NEW.key; END IF;
 INSERT INTO public.config_versions(config_key,old_value,new_value,changed_by,reason,source,created_at)
 VALUES ('feature_flags.'||flag_key,old_json,new_json,auth.uid(),nullif(current_setting('app.config_reason',true),''),coalesce(nullif(current_setting('app.config_source',true),''),'database_trigger:'||TG_OP),clock_timestamp());
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER feature_flags_version_audit AFTER INSERT OR UPDATE OR DELETE ON public.feature_flags FOR EACH ROW EXECUTE FUNCTION public.audit_feature_flag();
REVOKE ALL ON FUNCTION public.audit_feature_flag() FROM PUBLIC,anon,authenticated;
REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public.config_versions FROM PUBLIC,anon,authenticated;
