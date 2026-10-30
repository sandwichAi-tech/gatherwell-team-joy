-- Rows 89/90 affiliate approval + terms state machine and attribution. DISPOSABLE DATABASE ONLY; everything rolls back.
-- Run per tests/database/README.md (opt-in guard below). Never against production or shared preview.
\set ON_ERROR_STOP on
DO $$ BEGIN IF current_setting('app.disposable_database', true) IS DISTINCT FROM 'YES' THEN RAISE EXCEPTION 'refusing: set app.disposable_database=YES on a disposable copy'; END IF; END $$;
BEGIN;
CREATE TEMP TABLE ids(k text PRIMARY KEY, v uuid);
INSERT INTO ids VALUES ('host', gen_random_uuid()), ('ref', gen_random_uuid()), ('req', gen_random_uuid()), ('out', gen_random_uuid()), ('rej', gen_random_uuid()), ('buyer', gen_random_uuid()), ('event', gen_random_uuid());
GRANT SELECT ON ids TO authenticated;
CREATE FUNCTION pg_temp.id(_k text) RETURNS uuid LANGUAGE sql AS $$ SELECT v FROM ids WHERE k = _k $$;
CREATE FUNCTION pg_temp.as_user(_k text) RETURNS void LANGUAGE sql AS $$ SELECT set_config('test.uid', (SELECT v::text FROM ids WHERE k=_k), true) $$;
CREATE FUNCTION pg_temp.expect_error(_sql text, _msg text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE _sql; EXCEPTION WHEN others THEN
    IF position(_msg IN SQLERRM) = 0 THEN RAISE EXCEPTION 'expected % got %', _msg, SQLERRM; END IF; RETURN; END;
  RAISE EXCEPTION 'expected error % from %', _msg, _sql;
END $$;

INSERT INTO auth.users(id, email) SELECT v, 'zz-test-' || k || '@example.invalid' FROM ids WHERE k <> 'event';
INSERT INTO events(id, host_id, price_cents, title) VALUES (pg_temp.id('event'), pg_temp.id('host'), 5000, 'ZZ-TEST paid event');

-- Owner creates program.
SELECT pg_temp.as_user('host');
CREATE TEMP TABLE prog AS SELECT public.save_referral_program('event', pg_temp.id('event'), true, 'percent', 10) AS id;
GRANT SELECT ON prog TO authenticated;

-- Outsider cannot invite, decide or list.
SELECT pg_temp.as_user('out');
SELECT pg_temp.expect_error(format('SELECT public.invite_referrer(%L, %L)', (SELECT id FROM prog), 'zz-test-ref@example.invalid'), 'forbidden');
SELECT pg_temp.expect_error(format('SELECT public.program_referrers(%L)', (SELECT id FROM prog)), 'forbidden');
-- Outsider without membership gets no link.
SELECT pg_temp.expect_error(format('SELECT public.get_referral_link(%L)', (SELECT id FROM prog)), 'referral_not_approved');

-- Owner invites ref and rej; unknown email gives the same answer and creates nothing.
SELECT pg_temp.as_user('host');
DO $$ BEGIN
  IF NOT public.invite_referrer((SELECT id FROM prog), 'zz-test-ref@example.invalid') THEN RAISE EXCEPTION 'invite failed'; END IF;
  IF NOT public.invite_referrer((SELECT id FROM prog), 'zz-test-rej@example.invalid') THEN RAISE EXCEPTION 'invite failed'; END IF;
  IF NOT public.invite_referrer((SELECT id FROM prog), 'nobody-zz@example.invalid') THEN RAISE EXCEPTION 'unknown email should look the same'; END IF;
  IF (SELECT count(*) FROM referral_memberships WHERE program_id = (SELECT id FROM prog)) <> 2 THEN RAISE EXCEPTION 'unexpected memberships'; END IF;
END $$;
SELECT pg_temp.expect_error(format('SELECT public.decide_referrer(%L, %L, %L)', (SELECT id FROM prog), pg_temp.id('ref'), 'approve'), 'referral_invalid_transition');

-- Invited but no approved terms: no link, accepting fails closed.
SELECT pg_temp.as_user('ref');
SELECT pg_temp.expect_error(format('SELECT public.get_referral_link(%L)', (SELECT id FROM prog)), 'referral_not_approved');
SELECT pg_temp.expect_error(format('SELECT public.accept_referral_terms(%L, %L)', (SELECT id FROM prog), 'en'), 'referral_terms_unavailable');
DO $$ BEGIN IF (public.referral_program_for('event', pg_temp.id('event'))->>'code') IS NOT NULL THEN RAISE EXCEPTION 'code leaked before active'; END IF; END $$;

-- Fixture-only approved terms (ZZ-TEST text, rolled back).
SELECT set_config('test.uid', '', true);
INSERT INTO consent_text_versions(kind, version, locale, body, body_sha256, approved_at, approval_reference, document_url)
VALUES ('affiliate_terms', 1, 'en', 'ZZ-TEST', md5('en'), now(), 'ZZ-TEST', 'https://example.invalid/t'),
       ('affiliate_terms', 1, 'es', 'ZZ-TEST', md5('es'), now(), 'ZZ-TEST', 'https://example.invalid/t');

SELECT pg_temp.as_user('ref');
SELECT public.accept_referral_terms((SELECT id FROM prog), 'es');
CREATE TEMP TABLE refcode AS SELECT public.get_referral_link((SELECT id FROM prog)) AS code;
DO $$ BEGIN
  IF (SELECT count(*) FROM referral_terms_acceptances WHERE referrer_id = pg_temp.id('ref') AND locale = 'es') <> 1 THEN RAISE EXCEPTION 'acceptance not recorded'; END IF;
END $$;

-- Rejected invitee cannot accept or re-request.
SELECT pg_temp.as_user('host'); SELECT public.decide_referrer((SELECT id FROM prog), pg_temp.id('rej'), 'reject');
SELECT pg_temp.as_user('rej');
SELECT pg_temp.expect_error(format('SELECT public.accept_referral_terms(%L, %L)', (SELECT id FROM prog), 'en'), 'referral_not_invited');
DO $$ BEGIN IF public.request_referral_membership((SELECT id FROM prog)) <> 'rejected' THEN RAISE EXCEPTION 'rejected re-request changed state'; END IF; END $$;

-- Requester: requested -> no link; approved -> still no link until terms; accepted -> link.
SELECT pg_temp.as_user('req');
DO $$ BEGIN IF public.request_referral_membership((SELECT id FROM prog)) <> 'requested' THEN RAISE EXCEPTION 'request'; END IF; END $$;
SELECT pg_temp.expect_error(format('SELECT public.get_referral_link(%L)', (SELECT id FROM prog)), 'referral_not_approved');
SELECT pg_temp.as_user('host'); SELECT public.decide_referrer((SELECT id FROM prog), pg_temp.id('req'), 'approve');
SELECT pg_temp.as_user('req');
SELECT pg_temp.expect_error(format('SELECT public.get_referral_link(%L)', (SELECT id FROM prog)), 'referral_not_approved');
SELECT public.accept_referral_terms((SELECT id FROM prog), 'en');
SELECT public.get_referral_link((SELECT id FROM prog));

-- Buyer clicks ref's link and pays: one reward to ref.
SELECT pg_temp.as_user('buyer');
DO $$ BEGIN IF NOT public.record_referral_click((SELECT code FROM refcode), gen_random_uuid()) THEN RAISE EXCEPTION 'click ignored'; END IF; END $$;
SELECT set_config('test.uid', '', true);
INSERT INTO orders(id, status, buyer_user_id, offering_type, event_id, gross_cents, created_at) VALUES (gen_random_uuid(), 'paid', pg_temp.id('buyer'), 'event', pg_temp.id('event'), 5000, now() + interval '1 second');
DO $$ BEGIN IF (SELECT count(*) FROM referral_rewards WHERE referrer_id = pg_temp.id('ref')) <> 1 THEN RAISE EXCEPTION 'reward missing'; END IF; END $$;

-- Owner revokes ref: no new clicks or rewards; earned reward kept untouched.
SELECT pg_temp.as_user('host'); SELECT public.decide_referrer((SELECT id FROM prog), pg_temp.id('ref'), 'revoke');
SELECT pg_temp.as_user('buyer');
DO $$ BEGIN IF public.record_referral_click((SELECT code FROM refcode), gen_random_uuid()) THEN RAISE EXCEPTION 'revoked link counted'; END IF; END $$;
SELECT set_config('test.uid', '', true);
INSERT INTO orders(id, status, buyer_user_id, offering_type, event_id, gross_cents, created_at) VALUES (gen_random_uuid(), 'paid', pg_temp.id('buyer'), 'event', pg_temp.id('event'), 5000, now() + interval '2 seconds');
DO $$ BEGIN
  IF (SELECT count(*) FROM referral_rewards WHERE referrer_id = pg_temp.id('ref')) <> 1 THEN RAISE EXCEPTION 'revoked referrer earned again'; END IF;
  IF (SELECT status FROM referral_rewards WHERE referrer_id = pg_temp.id('ref')) <> 'pending' THEN RAISE EXCEPTION 'history changed'; END IF;
END $$;
SELECT pg_temp.as_user('ref');
SELECT pg_temp.expect_error(format('SELECT public.get_referral_link(%L)', (SELECT id FROM prog)), 'referral_not_approved');
DO $$ BEGIN IF (public.my_referral_dashboard()->'links'->0->>'enabled')::boolean THEN RAISE EXCEPTION 'revoked link shown active'; END IF; END $$;

-- Referrer cannot read another referrer's membership rows directly.
SET LOCAL ROLE authenticated;
SELECT pg_temp.as_user('req');
DO $$ BEGIN IF (SELECT count(*) FROM referral_memberships) <> 1 THEN RAISE EXCEPTION 'membership rows leaked'; END IF; END $$;
RESET ROLE;

\echo 'referral_membership_disposable: all assertions passed; rolling back'
ROLLBACK;
