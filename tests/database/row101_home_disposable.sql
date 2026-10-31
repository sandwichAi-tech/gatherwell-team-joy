-- Opt-in disposable schema only; this pass ran on stand-in app tables/helpers.
BEGIN;
DO $$ BEGIN IF current_setting('app.disposable_database',true) IS DISTINCT FROM 'YES' THEN RAISE EXCEPTION 'disposable_copy_required'; END IF; END $$;
CREATE FUNCTION pg_temp.check_home(ok boolean,label text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL %',label; END IF; END $$;
INSERT INTO profiles(id,full_name,view_mode) VALUES
('00000000-0000-0000-0000-000000000101','ZZ-TEST coach A','hosting'),
('00000000-0000-0000-0000-000000000102','ZZ-TEST coach B','hosting'),
('00000000-0000-0000-0000-000000000103','ZZ-TEST customer A','attending'),
('00000000-0000-0000-0000-000000000104','ZZ-TEST customer B','attending'),
('00000000-0000-0000-0000-000000000105','ZZ-TEST empty','attending');
INSERT INTO events(id,host_id,title,starts_at,status,format) VALUES
('00000000-0000-0000-0000-000000000111','00000000-0000-0000-0000-000000000101','ZZ-TEST event A',now()+interval '1 day','published','person'),
('00000000-0000-0000-0000-000000000112','00000000-0000-0000-0000-000000000102','ZZ-TEST event B',now()+interval '1 day','published','person'),
('00000000-0000-0000-0000-000000000113','00000000-0000-0000-0000-000000000101','ZZ-TEST private draft',now()+interval '1 day','draft','person');
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000105',true);
SELECT pg_temp.check_home(personal_home()->'events'='[]','empty account never gets catalog');
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000101',true);
SELECT pg_temp.check_home(jsonb_array_length(personal_home()->'events')=1 AND (personal_home()->>'drafts')::integer=1,'coach A owns only A');
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000102',true);
SELECT pg_temp.check_home(jsonb_array_length(personal_home()->'events')=1 AND (personal_home()->>'drafts')::integer=0,'coach B no A drafts');
INSERT INTO rsvps(id,event_id,user_id,status) VALUES('00000000-0000-0000-0000-000000000120','00000000-0000-0000-0000-000000000111','00000000-0000-0000-0000-000000000103','going');
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000103',true);
SELECT pg_temp.check_home(jsonb_array_length(personal_home()->'events')=1,'valid RSVP');
UPDATE rsvps SET status='cancelled';
SELECT pg_temp.check_home(personal_home()->'events'='[]','cancelled RSVP removed');
INSERT INTO offers(id,host_id,kind,title_en,price_cents,status) VALUES('00000000-0000-0000-0000-000000000130','00000000-0000-0000-0000-000000000101','download','ZZ-TEST paid',1000,'published');
INSERT INTO entitlements(offer_id,user_id,starts_at,ends_at) VALUES('00000000-0000-0000-0000-000000000130','00000000-0000-0000-0000-000000000103',now()-interval '1 day',now()+interval '1 day');
SELECT pg_temp.check_home(home_offer_relationship('00000000-0000-0000-0000-000000000130'),'active grant');
UPDATE entitlements SET starts_at=now()+interval '1 day';
SELECT pg_temp.check_home(NOT home_offer_relationship('00000000-0000-0000-0000-000000000130'),'future grant');
UPDATE entitlements SET starts_at=now()-interval '2 days',ends_at=now()-interval '1 day';
SELECT pg_temp.check_home(NOT home_offer_relationship('00000000-0000-0000-0000-000000000130'),'expired grant');
UPDATE entitlements SET ends_at=NULL,revoked_at=now();
SELECT pg_temp.check_home(NOT home_offer_relationship('00000000-0000-0000-0000-000000000130'),'revoked grant');
INSERT INTO offer_purchases(offer_id,user_id,status,paused_until) VALUES('00000000-0000-0000-0000-000000000130','00000000-0000-0000-0000-000000000103','paid',now()+interval '1 day');
SELECT pg_temp.check_home(NOT home_offer_relationship('00000000-0000-0000-0000-000000000130'),'paused purchase');
UPDATE offer_purchases SET paused_until=NULL,status='refunded';
SELECT pg_temp.check_home(NOT home_offer_relationship('00000000-0000-0000-0000-000000000130'),'refunded purchase');
UPDATE offer_purchases SET status='cancelled';
SELECT pg_temp.check_home(NOT home_offer_relationship('00000000-0000-0000-0000-000000000130'),'cancelled purchase');
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000104',true);
SELECT pg_temp.check_home(personal_home()->'events'='[]' AND personal_home()->'resources'='[]','unrelated customer isolation');
SELECT set_config('request.jwt.claim.sub','',true);
DO $$ BEGIN BEGIN PERFORM personal_home(); RAISE EXCEPTION 'anonymous_home'; EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'not_authenticated' THEN RAISE; END IF; END; END $$;
SELECT pg_temp.check_home(NOT has_function_privilege('anon','personal_home()','EXECUTE'),'anon execute denied');
ROLLBACK;
SELECT 'ZZ-TEST fixtures rolled back' AS cleanup;