\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN IF current_setting('app.disposable_database',true) IS DISTINCT FROM 'YES' THEN RAISE EXCEPTION 'Disposable database only'; END IF; END $$;
-- Explicit invocation only on an independently verified disposable full-schema copy.
CREATE FUNCTION pg_temp.challenge_assert(ok boolean,label text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %',label; END IF; END $$;
SELECT pg_temp.challenge_assert(NOT has_table_privilege('authenticated','public.challenge_members','INSERT'),'client cannot mint enrollment');
SELECT pg_temp.challenge_assert(NOT has_function_privilege('anon','public.enroll_challenge(uuid,jsonb)','EXECUTE'),'anonymous enrollment denied');
SELECT pg_temp.challenge_assert(NOT has_function_privilege('authenticated','public.challenge_streaks(uuid,uuid,date)','EXECUTE'),'arbitrary participant score RPC denied');
SELECT pg_temp.challenge_assert(NOT has_function_privilege('authenticated','public.challenge_member_active(uuid,uuid)','EXECUTE'),'arbitrary participant eligibility RPC denied');
SELECT pg_temp.challenge_assert(NOT has_function_privilege('anon','public.my_challenge_list()','EXECUTE'),'private My challenges anonymous denied');
SELECT pg_temp.challenge_assert(NOT has_function_privilege('anon','public.challenge_host_enrollments(uuid)','EXECUTE'),'host extras anonymous denied');
SELECT pg_temp.challenge_assert(EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='activity' AND policyname='challenge_activity_privacy' AND permissive='RESTRICTIVE'),'challenge recognition privacy gate');
SELECT pg_temp.challenge_assert(EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.challenge_messages'::regclass AND tgname='challenge_message_schedule_guard'),'unconnected message delivery cannot be enabled');
SELECT pg_temp.challenge_assert(EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='challenges' AND indexname='challenge_draft_request_unique'),'save retry identity unique');
ROLLBACK;