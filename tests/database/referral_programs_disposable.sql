-- Rollback-only disposable validation for referral programs (rows 56-58).
-- Run explicitly against a disposable copy: psql -v ON_ERROR_STOP=1 -f tests/database/referral_programs_disposable.sql
-- Every fixture is named ZZ-TEST and the transaction always rolls back.
BEGIN;
CREATE TEMP TABLE zz_ids AS SELECT
  (SELECT id FROM profiles ORDER BY created_at LIMIT 1) AS host,
  gen_random_uuid() AS referrer, gen_random_uuid() AS buyer, gen_random_uuid() AS teammate, gen_random_uuid() AS team_ref,
  gen_random_uuid() AS team, gen_random_uuid() AS ev, gen_random_uuid() AS team_ev;
DO $$
DECLARE z record; pid uuid; c1 text; c2 text; rid uuid; n int; o1 uuid := gen_random_uuid(); o2 uuid := gen_random_uuid(); o3 uuid := gen_random_uuid(); res jsonb; ok boolean;
BEGIN
  SELECT * INTO z FROM zz_ids;
  -- Fixtures (bypassing app triggers is not needed: inserts run as table owner in this transaction).
  INSERT INTO teams(id, name, owner_id) VALUES (z.team, 'ZZ-TEST team', z.host);
  INSERT INTO team_members(team_id, user_id, role) VALUES (z.team, z.teammate, 'member'), (z.team, z.team_ref, 'member');
  INSERT INTO events(id, team_id, host_id, title, starts_at, price_cents, visibility, status) VALUES
    (z.ev, z.team, z.host, 'ZZ-TEST paid', now() + interval '10 days', 4000, 'public', 'published'),
    (z.team_ev, z.team, z.host, 'ZZ-TEST team-only', now() + interval '10 days', 4000, 'team', 'published');

  PERFORM set_config('request.jwt.claims', json_build_object('sub', z.host, 'role', 'authenticated')::text, true);
  -- 1 validation
  BEGIN PERFORM save_referral_program('event', z.ev, true, 'flat', 4000); RAISE EXCEPTION 'FAIL flat>=price accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF; END;
  BEGIN PERFORM save_referral_program('event', z.ev, true, 'percent', 95); RAISE EXCEPTION 'FAIL percent>90 accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF; END;
  -- 2 team-only ineligible
  BEGIN PERFORM save_referral_program('event', z.team_ev, true, 'percent', 10); RAISE EXCEPTION 'FAIL team-only accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF; END;
  pid := save_referral_program('event', z.ev, true, 'percent', 10);
  RAISE NOTICE 'ok 1-3 validation + team-only exclusion';
  -- 4 host cannot create own link
  BEGIN PERFORM get_referral_link(pid); RAISE EXCEPTION 'FAIL host link'; EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF; END;
  -- 5 referrer link durable
  PERFORM set_config('request.jwt.claims', json_build_object('sub', z.referrer, 'role', 'authenticated')::text, true);
  c1 := get_referral_link(pid); c2 := get_referral_link(pid);
  IF c1 <> c2 OR c1 !~ '^[A-HJ-NP-Z2-9]{8}$' THEN RAISE EXCEPTION 'FAIL code not durable'; END IF;
  -- 6 referrer cannot read coach dashboard of others' programs
  res := coach_referral_dashboard();
  IF jsonb_array_length(res->'programs') <> 0 THEN RAISE EXCEPTION 'FAIL referrer sees programs'; END IF;
  -- 7 anonymous click + rate limit + claim after login
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM record_referral_click(c1, '00000000-0000-4000-8000-000000000001');
  PERFORM record_referral_click(c1, '00000000-0000-4000-8000-000000000001');
  SELECT count(*) INTO n FROM referral_clicks c JOIN referral_links l ON l.id=c.link_id WHERE l.code=c1;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL click not idempotent %', n; END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', z.buyer, 'role', 'authenticated')::text, true);
  IF claim_referral_visitor('00000000-0000-4000-8000-000000000001') <> 1 THEN RAISE EXCEPTION 'FAIL claim'; END IF;
  RAISE NOTICE 'ok 4-7 links, privacy, idempotent clicks, login persistence';
  -- 8 paid order → one reward, server-computed
  PERFORM set_config('request.jwt.claims', '', true);
  INSERT INTO orders(id, idempotency_key, offering_type, event_id, host_id, buyer_user_id, status, gross_cents, platform_fee_cents, fee_rule_id, environment)
  VALUES (o1, 'zz-test-1', 'event', z.ev, z.host, z.buyer, 'pending', 4000, 200, 'zz', 'sandbox');
  UPDATE orders SET status='paid' WHERE id=o1; UPDATE orders SET status='paid', updated_at=now() WHERE id=o1;
  PERFORM referral_attribute_order(o1);
  SELECT count(*) INTO n FROM referral_rewards WHERE order_id=o1;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL reward count %', n; END IF;
  IF (SELECT reward_cents FROM referral_rewards WHERE order_id=o1) <> 400 THEN RAISE EXCEPTION 'FAIL reward amount'; END IF;
  RAISE NOTICE 'ok 8 one reward per order, 10%% of 4000 = 400';
  -- 9 refund reverses
  UPDATE orders SET status='refunded' WHERE id=o1;
  IF (SELECT status FROM referral_rewards WHERE order_id=o1) <> 'reversed' THEN RAISE EXCEPTION 'FAIL refund reversal'; END IF;
  RAISE NOTICE 'ok 9 refund reversal';
  -- 10 self-referral: referrer buys via own link
  INSERT INTO referral_clicks(link_id, visitor_key, user_id) SELECT id, gen_random_uuid(), z.referrer FROM referral_links WHERE code=c1;
  INSERT INTO orders(id, idempotency_key, offering_type, event_id, host_id, buyer_user_id, status, gross_cents, platform_fee_cents, fee_rule_id, environment)
  VALUES (o2, 'zz-test-2', 'event', z.ev, z.host, z.referrer, 'paid', 4000, 200, 'zz', 'sandbox');
  IF EXISTS (SELECT 1 FROM referral_rewards WHERE order_id=o2) THEN RAISE EXCEPTION 'FAIL self-referral rewarded'; END IF;
  -- 11 same-team: teammate-referrer refers teammate-buyer
  PERFORM set_config('request.jwt.claims', json_build_object('sub', z.team_ref, 'role', 'authenticated')::text, true);
  c2 := get_referral_link(pid);
  PERFORM set_config('request.jwt.claims', '', true);
  INSERT INTO referral_clicks(link_id, visitor_key, user_id) SELECT id, gen_random_uuid(), z.teammate FROM referral_links WHERE code=c2;
  INSERT INTO orders(id, idempotency_key, offering_type, event_id, host_id, buyer_user_id, status, gross_cents, platform_fee_cents, fee_rule_id, environment)
  VALUES (o3, 'zz-test-3', 'event', z.ev, z.host, z.teammate, 'paid', 4000, 200, 'zz', 'sandbox');
  IF EXISTS (SELECT 1 FROM referral_rewards WHERE order_id=o3) THEN RAISE EXCEPTION 'FAIL same-team rewarded'; END IF;
  RAISE NOTICE 'ok 10-11 self and same-team blocked';
  -- 12 manual payout: only available rewards, server-summed
  UPDATE orders SET status='paid' WHERE id=o1; -- re-paid order keeps its reversed reward (no resurrection)
  IF (SELECT status FROM referral_rewards WHERE order_id=o1) <> 'reversed' THEN RAISE EXCEPTION 'FAIL reversed reward resurrected'; END IF;
  INSERT INTO orders(id, idempotency_key, offering_type, event_id, host_id, buyer_user_id, status, gross_cents, platform_fee_cents, fee_rule_id, environment, created_at)
  VALUES (gen_random_uuid(), 'zz-test-4', 'event', z.ev, z.host, z.buyer, 'paid', 4000, 200, 'zz', 'sandbox', now());
  SELECT id INTO rid FROM referral_rewards WHERE status='pending' AND referrer_id=z.referrer;
  IF rid IS NULL THEN RAISE EXCEPTION 'FAIL second reward'; END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', z.host, 'role', 'authenticated')::text, true);
  BEGIN PERFORM record_referral_payout(z.referrer, ARRAY[rid], current_date, 'zz', 'ZZ-TEST'); RAISE EXCEPTION 'FAIL paid a pending reward'; EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF; END;
  UPDATE referral_rewards SET available_at = now() - interval '1 minute' WHERE id = rid;
  PERFORM record_referral_payout(z.referrer, ARRAY[rid], current_date, 'zz', 'ZZ-TEST');
  IF (SELECT status FROM referral_rewards WHERE id=rid) <> 'paid' OR (SELECT amount_cents FROM referral_payouts WHERE referrer_id=z.referrer) <> 400 THEN RAISE EXCEPTION 'FAIL payout'; END IF;
  res := coach_referral_dashboard(NULL, NULL, 'paid');
  IF (res->'totals'->>'paid_cents')::int <> 400 OR (res->'rewards'->0) ? 'buyer_user_id' THEN RAISE EXCEPTION 'FAIL coach totals/privacy'; END IF;
  RAISE NOTICE 'ok 12-13 manual payout ledger, filters, no buyer identity';
  -- 14 referrer view: own only, no buyer
  PERFORM set_config('request.jwt.claims', json_build_object('sub', z.referrer, 'role', 'authenticated')::text, true);
  res := my_referral_dashboard();
  IF (res->'totals'->>'paid_cents')::int <> 400 OR (res->'totals'->>'reversed_cents')::int <> 400 OR res::text LIKE '%' || z.buyer::text || '%' THEN RAISE EXCEPTION 'FAIL referrer view %', res; END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', z.team_ref, 'role', 'authenticated')::text, true);
  res := my_referral_dashboard();
  IF (res->'totals'->>'paid_cents')::int <> 0 THEN RAISE EXCEPTION 'FAIL cross-referrer leak'; END IF;
  RAISE NOTICE 'ok 14-15 referrer isolation';
  RAISE NOTICE 'ALL REFERRAL CHECKS PASSED';
END $$;
ROLLBACK;
