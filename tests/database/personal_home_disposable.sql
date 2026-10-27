\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN IF current_setting('app.disposable_database',true) IS DISTINCT FROM 'YES' THEN RAISE EXCEPTION 'Disposable database only'; END IF; END $$;
CREATE FUNCTION pg_temp.check_home(ok boolean,label text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %',label; END IF; END $$;
-- Run only on an independently verified disposable full-schema copy, never shared preview.
INSERT INTO profiles(id,full_name,view_mode) VALUES
 ('00000000-0000-0000-0000-000000000101','ZZ-TEST Home owner','hosting'),
 ('00000000-0000-0000-0000-000000000102','ZZ-TEST Home customer','attending');
INSERT INTO teams(id,owner_id,name,slug,join_code) VALUES
 ('10000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000101','ZZ-TEST Home','zz-test-home-disposable','ZZHOME101');
INSERT INTO events(id,team_id,host_id,title,starts_at,status,visibility,format,location_name) VALUES
 ('20000000-0000-0000-0000-000000000101','10000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000101','ZZ-TEST Home event',now()+interval '1 day','published','public','person','ZZ-TEST Park');
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000102',true);
SELECT pg_temp.check_home(personal_home()->'events'='[]'::jsonb,'public catalog is not a relationship');
INSERT INTO rsvps(event_id,user_id,status) VALUES('20000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000102','going');
SELECT pg_temp.check_home(jsonb_array_length(personal_home()->'events')=1,'own registration appears');
UPDATE rsvps SET status='cancelled' WHERE user_id='00000000-0000-0000-0000-000000000102';
SELECT pg_temp.check_home(personal_home()->'events'='[]'::jsonb,'cancelled registration disappears');
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000101',true);
SELECT pg_temp.check_home(jsonb_array_length(personal_home()->'events')=1,'owner sees own event');
SELECT pg_temp.check_home(NOT has_function_privilege('anon','public.personal_home()','EXECUTE'),'anonymous Home denied');
ROLLBACK;