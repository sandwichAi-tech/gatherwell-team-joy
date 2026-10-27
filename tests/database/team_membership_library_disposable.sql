\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN IF current_setting('app.disposable_database',true) IS DISTINCT FROM 'YES' THEN RAISE EXCEPTION 'Disposable database only'; END IF; END $$;
CREATE FUNCTION pg_temp.check_rule(ok boolean,label text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %',label; END IF; END $$;
INSERT INTO profiles(id,full_name,adult_confirmed_at) VALUES('00000000-0000-0000-0000-000000000001','ZZ-TEST Owner',now()),('00000000-0000-0000-0000-000000000002','ZZ-TEST Member',now());
INSERT INTO teams(id,owner_id) VALUES('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001');
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
SELECT pg_temp.check_rule(request_team_membership('10000000-0000-0000-0000-000000000001')='pending','request creates pending');
SELECT pg_temp.check_rule(request_team_membership('10000000-0000-0000-0000-000000000001')='pending','request retry stays pending');
SELECT pg_temp.check_rule(NOT team_channel_access('10000000-0000-0000-0000-000000000001'),'pending denies channels');
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
SELECT decide_team_request('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','approved');
SELECT decide_team_request('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','approved');
SELECT pg_temp.check_rule((SELECT count(*)=1 FROM team_members WHERE user_id='00000000-0000-0000-0000-000000000002'),'approval retry creates one membership');
SELECT decide_team_request('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','removed');
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
SELECT pg_temp.check_rule(NOT team_channel_access('10000000-0000-0000-0000-000000000001'),'removed denies channels');
SELECT pg_temp.check_rule(my_team_states()->0->>'status'='removed','removed status remains visible');
ROLLBACK;