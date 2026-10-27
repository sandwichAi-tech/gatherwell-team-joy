-- Explicit disposable-copy invocation only. Never run against shared preview/production.
BEGIN;
DO $$ BEGIN
 IF current_setting('app.disposable_database',true) IS DISTINCT FROM 'YES' THEN RAISE EXCEPTION 'disposable_copy_required'; END IF;
 IF has_function_privilege('anon','public.approved_event_agreement(text)','EXECUTE') THEN RAISE EXCEPTION 'private_approval_helper_exposed';END IF;
 IF has_function_privilege('authenticated','public.platform_registration_guard()','EXECUTE') THEN RAISE EXCEPTION 'trigger_exposed';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='rsvps_agreements_final' AND tgdeferrable AND tginitdeferred) THEN RAISE EXCEPTION 'atomic_final_guard_missing';END IF;
 IF strpos(pg_get_functiondef('public.attach_library_waiver(uuid,uuid,integer)'::regprocedure),'agreements_locked')=0 THEN RAISE EXCEPTION 'published_once_pin_missing';END IF;
 IF strpos(pg_get_functiondef('public.get_public_host(text)'::regprocedure),'user_suspensions')=0 THEN RAISE EXCEPTION 'suspended_public_identity';END IF;
END $$;
ROLLBACK;