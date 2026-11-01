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
INSERT INTO rsvps VALUES
 ('00000000-0000-0000-0000-0000000000r1'::text::uuid,'00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000c1','going','zztestcode000000001',NULL,NULL);
