-- Follow-up after read-back verified all 7 acceptances linked and hashed, 0 unmatched.
-- Fail atomically rather than overwriting any concurrent unmatched acceptance.
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM public.waiver_acceptances w LEFT JOIN public.consent_text_versions c ON c.id=w.consent_text_version_id WHERE c.id IS NULL OR w.accepted_body_sha256 IS DISTINCT FROM c.body_sha256) THEN RAISE EXCEPTION 'unmatched_waiver_snapshot'; END IF;
END $$;
ALTER TABLE public.waiver_acceptances ALTER COLUMN consent_text_version_id SET NOT NULL;
ALTER TABLE public.waiver_acceptances ALTER COLUMN accepted_body_sha256 SET NOT NULL;
