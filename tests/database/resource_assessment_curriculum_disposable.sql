-- Explicit disposable-copy invocation only; never execute against shared preview/production.
BEGIN;
DO $$ BEGIN
 IF current_setting('app.disposable_database',true) IS DISTINCT FROM 'YES' THEN RAISE EXCEPTION 'disposable_copy_required'; END IF;
 IF has_function_privilege('anon','public.save_wellness_assessment(uuid,uuid,jsonb,text,uuid,integer,integer)','EXECUTE') THEN RAISE EXCEPTION 'anonymous_assessment_write'; END IF;
 IF has_function_privilege('anon','public.reorder_course_curriculum(uuid,uuid,uuid[])','EXECUTE') THEN RAISE EXCEPTION 'anonymous_curriculum_write'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='assessment_attempt_guard' AND tgenabled='O') THEN RAISE EXCEPTION 'assessment_collection_not_guarded'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='course_link_guard' AND tgenabled='O') THEN RAISE EXCEPTION 'unsafe_course_links'; END IF;
END $$;
ROLLBACK;