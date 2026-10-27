-- Explicit disposable-copy invocation only; never execute against shared preview/production.
BEGIN;
DO $$ BEGIN
 IF current_setting('app.disposable_database',true) IS DISTINCT FROM 'YES' THEN RAISE EXCEPTION 'disposable_copy_required'; END IF;
 IF has_function_privilege('anon','public.save_wellness_assessment(uuid,uuid,jsonb,text,uuid,integer,integer)','EXECUTE') THEN RAISE EXCEPTION 'anonymous_assessment_write'; END IF;
 IF has_function_privilege('anon','public.reorder_course_curriculum(uuid,uuid,uuid[])','EXECUTE') THEN RAISE EXCEPTION 'anonymous_curriculum_write'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='assessment_attempt_guard' AND tgenabled='O') THEN RAISE EXCEPTION 'assessment_collection_not_guarded'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='course_link_guard' AND tgenabled='O') THEN RAISE EXCEPTION 'unsafe_course_links'; END IF;
 IF has_function_privilege('authenticated','public.reconcile_challenge_order(uuid,text,text,integer,text,text,text)','EXECUTE') THEN RAISE EXCEPTION 'client_payment_success'; END IF;
 IF has_function_privilege('anon','public.complete_wellness_assessment(uuid,uuid,integer,uuid,boolean,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'anonymous_completion'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='assessment_receipt_immutable' AND tgenabled='O') THEN RAISE EXCEPTION 'mutable_receipts'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_class WHERE relname='assessment_receipts' AND relrowsecurity) THEN RAISE EXCEPTION 'receipt_rls_missing'; END IF;
END $$;
ROLLBACK;