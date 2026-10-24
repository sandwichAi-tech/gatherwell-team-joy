-- Manual only: run against a disposable schema copy, never preview/production.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
 IF current_setting('app.disposable_database',true) IS DISTINCT FROM 'YES' THEN RAISE EXCEPTION 'Disposable copy required'; END IF;
 IF has_function_privilege('anon','public.admin_safety_list(text,text,text,integer)','EXECUTE') THEN RAISE EXCEPTION 'anonymous safety read enabled'; END IF;
 IF has_function_privilege('anon','public.admin_safety_action(text,uuid,text,text,uuid)','EXECUTE') THEN RAISE EXCEPTION 'anonymous safety action enabled'; END IF;
END $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','ee000028-0000-4000-8000-000000000099',true);
DO $$ BEGIN
 BEGIN PERFORM public.admin_safety_list('users','','all',0); RAISE EXCEPTION 'non-admin list unexpectedly allowed';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'forbidden' THEN RAISE; END IF; END;
 BEGIN PERFORM public.admin_safety_action('team','ee000028-0000-4000-8000-000000000010','suspend','security regression'); RAISE EXCEPTION 'non-admin action unexpectedly allowed';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'forbidden' THEN RAISE; END IF; END;
 IF EXISTS (SELECT 1 FROM public.admin_audit) THEN RAISE EXCEPTION 'audit RLS leak'; END IF;
 IF EXISTS (SELECT 1 FROM public.reports) THEN RAISE EXCEPTION 'report RLS leak'; END IF;
END $$;
ROLLBACK;
\echo 'Platform safety denial checks rolled back.'