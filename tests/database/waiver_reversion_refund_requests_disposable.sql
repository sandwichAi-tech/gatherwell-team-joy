-- Disposable-only: run against a throwaway local PostgreSQL with stand-in tables. Never against shared/preview/production.
\set ON_ERROR_STOP on
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('t.uid',true),'')::uuid $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT 'authenticated' $$;
CREATE TABLE user_suspensions(user_id uuid);
CREATE TABLE events(id uuid PRIMARY KEY, host_id uuid, title text, status text, starts_at timestamptz, refund_policy text, requires_waiver boolean DEFAULT false);
CREATE TABLE rsvps(id uuid PRIMARY KEY, event_id uuid REFERENCES events, user_id uuid, status text, checkin_code text, checked_in_at timestamptz, merged_into_rsvp_id uuid);
CREATE TABLE payments(id uuid PRIMARY KEY, kind text, event_id uuid, rsvp_id uuid REFERENCES rsvps, host_id uuid, amount_cents int, booking_fee_cents int DEFAULT 0, status text, created_at timestamptz DEFAULT now());
CREATE TABLE waiver_acceptances(rsvp_id uuid, event_id uuid, accepted_at timestamptz, accepted_body_sha256 text);
CREATE TABLE waiver_library(id uuid PRIMARY KEY, owner_id uuid, archived boolean DEFAULT false);
CREATE TABLE waiver_library_versions(waiver_id uuid, version int, name text, body_en text, body_es text, file_path text, file_name text);
CREATE TABLE event_waivers(id uuid PRIMARY KEY, event_id uuid, library_id uuid, library_version int, kind text DEFAULT 'waiver', title_en text, title_es text, body_en text, body_es text, file_path text, file_name text, required boolean DEFAULT true, position int DEFAULT 0, version int DEFAULT 1, content_sha256 text, archived_at timestamptz, created_at timestamptz DEFAULT now());
CREATE TABLE event_waiver_versions(waiver_id uuid, version int, content_sha256 text, PRIMARY KEY(waiver_id,version));
CREATE TABLE event_waiver_acceptances(waiver_id uuid, version int, content_sha256 text, event_id uuid, rsvp_id uuid, user_id uuid, order_ref text, source text, accepted_at timestamptz DEFAULT now(), UNIQUE(waiver_id,version,rsvp_id));
CREATE FUNCTION ew_before() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE s text := md5(concat_ws('|',NEW.title_en,NEW.body_en,NEW.file_path)); BEGIN
  IF TG_OP='INSERT' THEN NEW.version:=1; ELSIF s<>OLD.content_sha256 THEN NEW.version:=OLD.version+1; ELSE NEW.version:=OLD.version; END IF; NEW.content_sha256:=s; RETURN NEW; END $$;
CREATE TRIGGER ew_before BEFORE INSERT OR UPDATE ON event_waivers FOR EACH ROW EXECUTE FUNCTION ew_before();
CREATE FUNCTION ew_after() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN INSERT INTO event_waiver_versions VALUES(NEW.id,NEW.version,NEW.content_sha256) ON CONFLICT DO NOTHING; RETURN NEW; END $$;
CREATE TRIGGER ew_after AFTER INSERT OR UPDATE ON event_waivers FOR EACH ROW EXECUTE FUNCTION ew_after();
CREATE FUNCTION block_history_rewrite() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'history_immutable'; END $$;
CREATE TRIGGER evv_immutable BEFORE UPDATE ON event_waiver_versions FOR EACH ROW EXECUTE FUNCTION block_history_rewrite();
-- Stand-in with the same guard phrase as the real host_waiver_event_guard().
CREATE FUNCTION public.host_waiver_event_guard() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE e events; BEGIN SELECT * INTO e FROM events WHERE id=NEW.event_id; IF e.status<>'draft' THEN IF TG_OP='INSERT' OR (NEW.title_en,NEW.body_en,NEW.file_path) IS DISTINCT FROM (OLD.title_en,OLD.body_en,OLD.file_path) THEN RAISE EXCEPTION 'waiver_pinned'; END IF; END IF; RETURN NEW; END $$;
CREATE TRIGGER ew_pin BEFORE INSERT OR UPDATE ON event_waivers FOR EACH ROW EXECUTE FUNCTION host_waiver_event_guard();
-- Copied from 0116 (check/store).
CREATE FUNCTION public.check_event_waivers(_event uuid, _accepted jsonb) RETURNS void LANGUAGE plpgsql AS $$ DECLARE w record; a jsonb; _list jsonb := coalesce(_accepted,'[]'); BEGIN
  FOR a IN SELECT * FROM jsonb_array_elements(_list) LOOP IF NOT EXISTS(SELECT 1 FROM event_waivers x WHERE x.id=(a->>'id')::uuid AND x.event_id=_event AND x.archived_at IS NULL AND x.version=(a->>'version')::int) THEN RAISE EXCEPTION 'waiver_stale'; END IF; END LOOP;
  FOR w IN SELECT id FROM event_waivers WHERE event_id=_event AND archived_at IS NULL AND required LOOP IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(_list) a2 WHERE (a2->>'id')::uuid=w.id) THEN RAISE EXCEPTION 'waiver_required'; END IF; END LOOP; END $$;
CREATE FUNCTION public.store_event_waivers(_rsvp uuid, _accepted jsonb, _source text, _ref text) RETURNS void LANGUAGE plpgsql AS $$ DECLARE r record; BEGIN SELECT id,event_id,user_id INTO r FROM rsvps WHERE id=_rsvp;
  INSERT INTO event_waiver_acceptances(waiver_id,version,content_sha256,event_id,rsvp_id,user_id,order_ref,source) SELECT v.waiver_id,v.version,v.content_sha256,r.event_id,r.id,r.user_id,_ref,_source FROM jsonb_array_elements(coalesce(_accepted,'[]')) a JOIN event_waiver_versions v ON v.waiver_id=(a->>'id')::uuid AND v.version=(a->>'version')::int JOIN event_waivers w ON w.id=v.waiver_id AND w.event_id=r.event_id ON CONFLICT DO NOTHING; END $$;

\i waiver_reversion_refund_requests.pending.sql

CREATE FUNCTION expect_error(_sql text, _code text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN EXECUTE _sql; RAISE EXCEPTION 'expected % but succeeded: %', _code, _sql; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>_code THEN RAISE EXCEPTION 'expected % got %', _code, SQLERRM; END IF; END $$;
CREATE FUNCTION ok(_b boolean, _m text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF NOT coalesce(_b,false) THEN RAISE EXCEPTION 'FAIL: %', _m; END IF; RAISE NOTICE 'PASS: %', _m; END $$;

-- ZZ-TEST fixtures: host A, host B, attendees.
INSERT INTO events VALUES ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-00000000000a','ZZ-TEST Yoga','draft',now()+interval '10 days','24h');
INSERT INTO waiver_library VALUES ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-00000000000a');
INSERT INTO waiver_library_versions VALUES ('00000000-0000-0000-0000-0000000000b1',1,'ZZ-TEST Release','v1 text','',NULL,NULL),('00000000-0000-0000-0000-0000000000b1',2,'ZZ-TEST Release','v2 text','',NULL,NULL);
INSERT INTO event_waivers(id,event_id,library_id,library_version,title_en,title_es,body_en,body_es) VALUES ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000b1',1,'ZZ-TEST Release','ZZ-TEST Release','v1 text','');
UPDATE events SET status='published';
INSERT INTO events VALUES ('00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-00000000000b','ZZ-TEST Other','published',now()+interval '10 days','none');
-- c1 registered+accepted v1, not checked in; c2 checked in on v1; c3 paid ticket; c4 free on waitlist.
INSERT INTO rsvps VALUES
 ('00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000c1','going','zztestcode0000000001',NULL,NULL),
 ('00000000-0000-0000-0000-000000000102','00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000c2','going','zztestcode0000000002',now(),NULL),
 ('00000000-0000-0000-0000-000000000103','00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000c3','going','zztestcode0000000003',NULL,NULL),
 ('00000000-0000-0000-0000-000000000104','00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000c4','waitlist','zztestcode0000000004',NULL,NULL);
SELECT store_event_waivers(id, jsonb_build_array(jsonb_build_object('id','00000000-0000-0000-0000-0000000000d1','version',1)),'rsvp',NULL) FROM rsvps WHERE event_id='00000000-0000-0000-0000-0000000000e1' AND status='going';
INSERT INTO payments VALUES ('00000000-0000-0000-0000-000000000201','gathering','00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-000000000103','00000000-0000-0000-0000-00000000000a',3500,300,'paid');

SELECT ok(checkin_blocker('00000000-0000-0000-0000-000000000101') IS NULL, 'v1 acceptance passes before a new version');
-- outsider host B cannot count or replace
SELECT set_config('t.uid','00000000-0000-0000-0000-00000000000b',false);
SELECT expect_error($$SELECT waiver_reaccept_count('00000000-0000-0000-0000-0000000000e1')$$,'forbidden');
SELECT expect_error($$SELECT replace_event_waiver_version('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000d1',2,2)$$,'forbidden');
SELECT expect_error($$UPDATE event_waivers SET body_en='hijack' WHERE id='00000000-0000-0000-0000-0000000000d1'$$,'waiver_pinned');
SELECT set_config('t.uid','00000000-0000-0000-0000-00000000000a',false);
SELECT ok(waiver_reaccept_count('00000000-0000-0000-0000-0000000000e1')=2, 'two registered, not-checked-in attendees need re-accept');
SELECT expect_error($$SELECT replace_event_waiver_version('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000d1',2,5)$$,'reaccept_count_changed');
SELECT expect_error($$UPDATE event_waivers SET body_en='direct edit' WHERE id='00000000-0000-0000-0000-0000000000d1'$$,'waiver_pinned');
SELECT ok(replace_event_waiver_version('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000d1',2,2)=2, 'new version 2 pinned');
SELECT ok(replace_event_waiver_version('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000d1',2,99)=2, 'retry with same library version is idempotent');
SELECT ok((SELECT count(*) FROM event_waiver_versions WHERE waiver_id='00000000-0000-0000-0000-0000000000d1')=2, 'v1 snapshot kept, v2 added');
SELECT ok((SELECT count(*) FROM event_waiver_acceptances WHERE version=1)=3, 'prior v1 acceptances unchanged');
SELECT expect_error($$UPDATE event_waiver_versions SET content_sha256='x'$$,'history_immutable');
SELECT ok(checkin_blocker('00000000-0000-0000-0000-000000000101')='waiver_required', 'not-checked-in attendee must re-accept before check-in');
SELECT ok(checkin_blocker('00000000-0000-0000-0000-000000000102') IS NULL, 'already checked-in attendee is not retroactively blocked');
SELECT ok(jsonb_array_length(waivers_needing_reaccept('zztestcode0000000001'))=1, 'attendee sees the waiver to re-accept');
SELECT ok(jsonb_array_length(waivers_needing_reaccept('zztestcode0000000002'))=0, 'checked-in attendee sees nothing');
SELECT expect_error($$SELECT reaccept_event_waivers('zztestcode0000000001', jsonb_build_array(jsonb_build_object('id','00000000-0000-0000-0000-0000000000d1','version',1)))$$,'waiver_stale');
SELECT ok(reaccept_event_waivers('zztestcode0000000001', jsonb_build_array(jsonb_build_object('id','00000000-0000-0000-0000-0000000000d1','version',2))), 're-accept v2');
SELECT ok(reaccept_event_waivers('zztestcode0000000001', jsonb_build_array(jsonb_build_object('id','00000000-0000-0000-0000-0000000000d1','version',2))), 're-accept retry is idempotent');
SELECT ok((SELECT count(*) FROM event_waiver_acceptances WHERE rsvp_id='00000000-0000-0000-0000-000000000101')=2, 'attendee keeps v1 and v2 records, no duplicates');
SELECT ok(checkin_blocker('00000000-0000-0000-0000-000000000101') IS NULL, 'check-in allowed after re-accept');

-- Refunds/cancellation
SELECT ok((cancel_my_registration('zztestcode0000000003')->>'refund')='pending', 'paid attendee before 24h cutoff: refund request pending (not refunded)');
SELECT ok((cancel_my_registration('zztestcode0000000003')->>'refund')='pending', 'repeat cancel is idempotent');
SELECT ok((SELECT count(*) FROM refund_requests)=1, 'exactly one refund request');
SELECT ok((SELECT amount_cents FROM refund_requests)=3200, 'refund excludes non-refundable booking fee (3500-300)');
SELECT ok((SELECT status FROM payments WHERE id='00000000-0000-0000-0000-000000000201')='paid', 'payment not marked refunded by a request');
SELECT ok((cancel_my_registration('zztestcode0000000002')->>'result')='checked_in', 'checked-in attendee cannot self-cancel');
SELECT ok((cancel_my_registration('zztestcode0000000001')->>'refund')='free', 'free cancellation immediate');
SELECT ok((SELECT status FROM rsvps WHERE id='00000000-0000-0000-0000-000000000101')='cancelled', 'free booking cancelled');
SELECT confirm_refund_request('00000000-0000-0000-0000-000000000201','re_zztest_1','failed','card_closed');
SELECT ok((SELECT status FROM refund_requests)='failed', 'provider failure recorded');
SELECT set_config('t.uid','00000000-0000-0000-0000-00000000000b',false);
SELECT expect_error($$SELECT retry_refund_request((SELECT id FROM refund_requests))$$,'forbidden');
SELECT expect_error($$SELECT cancel_event_with_refunds('00000000-0000-0000-0000-0000000000e1','ZZ-TEST Yoga')$$,'forbidden');
SELECT set_config('t.uid','00000000-0000-0000-0000-00000000000a',false);
SELECT ok(retry_refund_request((SELECT id FROM refund_requests WHERE attempt=1)) IS NOT NULL, 'host retries failed refund');
SELECT ok(retry_refund_request((SELECT id FROM refund_requests WHERE attempt=1)) = (SELECT id FROM refund_requests WHERE attempt=2), 'repeat retry returns same open attempt');
SELECT expect_error($$SELECT retry_refund_request((SELECT id FROM refund_requests WHERE attempt=2))$$,'not_retryable');
SELECT confirm_refund_request('00000000-0000-0000-0000-000000000201','re_zztest_2','succeeded');
SELECT ok((SELECT status FROM refund_requests WHERE attempt=2)='succeeded', 'only provider confirmation sets succeeded');
SELECT expect_error($$SELECT cancel_event_with_refunds('00000000-0000-0000-0000-0000000000e1','yes')$$,'confirm_mismatch');
SELECT ok((cancel_event_with_refunds('00000000-0000-0000-0000-0000000000e1',' zz-test yoga ')->>'refund_requests')='0', 'event cancel: already-refunded payment not duplicated');
SELECT ok((SELECT status FROM events WHERE id='00000000-0000-0000-0000-0000000000e1')='cancelled', 'event cancelled; registration stops');
SELECT ok((cancel_event_with_refunds('00000000-0000-0000-0000-0000000000e1','ZZ-TEST Yoga')->>'result')='cancelled', 'event cancel retry idempotent');
-- Policy cutoff: 'none' policy + attendee cancel -> no refund request
INSERT INTO rsvps VALUES ('00000000-0000-0000-0000-000000000105','00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-0000000000c5','going','zztestcode0000000005',NULL,NULL);
INSERT INTO payments VALUES ('00000000-0000-0000-0000-000000000202','gathering','00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-000000000105','00000000-0000-0000-0000-00000000000b',2000,0,'paid');
SELECT ok((cancel_my_registration('zztestcode0000000005')->>'refund')='not_eligible', 'no-refund policy: cancel without refund request');
UPDATE events SET refund_policy='24h', starts_at=now()+interval '2 hours' WHERE id='00000000-0000-0000-0000-0000000000e2';
UPDATE payments SET id=id WHERE false;
INSERT INTO rsvps VALUES ('00000000-0000-0000-0000-000000000106','00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-0000000000c6','going','zztestcode0000000006',NULL,NULL);
INSERT INTO payments VALUES ('00000000-0000-0000-0000-000000000203','gathering','00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-000000000106','00000000-0000-0000-0000-00000000000b',2000,0,'paid');
SELECT ok((cancel_my_registration('zztestcode0000000006')->>'refund')='not_eligible', 'past 24h cutoff: no refund request');
UPDATE events SET refund_policy='custom' WHERE id='00000000-0000-0000-0000-0000000000e2';
INSERT INTO rsvps VALUES ('00000000-0000-0000-0000-000000000107','00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-0000000000c7','going','zztestcode0000000007',NULL,NULL);
INSERT INTO payments VALUES ('00000000-0000-0000-0000-000000000204','gathering','00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-000000000107','00000000-0000-0000-0000-00000000000b',2000,0,'paid');
SELECT ok((cancel_my_registration('zztestcode0000000007')->>'refund')='review', 'custom policy: request waits for host review');
SELECT expect_error($$SELECT approve_refund_request((SELECT id FROM refund_requests WHERE status='review'))$$,'forbidden');
SELECT set_config('t.uid','00000000-0000-0000-0000-00000000000b',false);
SELECT ok(approve_refund_request((SELECT id FROM refund_requests WHERE status='review'))='pending', 'owning host approves review -> pending');
