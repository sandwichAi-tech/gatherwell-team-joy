-- DISPOSABLE COPY ONLY. Never run against production or preview. Everything rolls back.
-- Run manually: psql "$DISPOSABLE_DB_URL" -v ON_ERROR_STOP=1 -f tests/database/prompt3_identity_disposable.sql
BEGIN;
DO $$
DECLARE u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid(); ev uuid; tm uuid; g1 uuid; g2 uuid; own uuid; res jsonb; tok text; p text;
BEGIN
  INSERT INTO auth.users (id, email, email_confirmed_at, aud, role) VALUES (u1, 'claim-a@example.test', now(), 'authenticated', 'authenticated'), (u2, 'claim-b@example.test', NULL, 'authenticated', 'authenticated');
  INSERT INTO public.profiles (id, full_name) VALUES (u1, 'Fixture A') ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.profiles (id, full_name) VALUES (u2, 'Fixture B') ON CONFLICT (id) DO NOTHING;
  SELECT id INTO tm FROM public.teams LIMIT 1;
  SELECT id INTO ev FROM public.events LIMIT 1;

  -- 18+: unattested signed-in user cannot create a team.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN PERFORM public.create_team('Fixture team'); RAISE EXCEPTION 'expected adult_required';
  EXCEPTION WHEN others THEN IF SQLERRM NOT LIKE '%adult_required%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.confirm_adult(false); RAISE EXCEPTION 'expected attestation failure';
  EXCEPTION WHEN others THEN IF SQLERRM NOT LIKE '%adult_attestation_required%' THEN RAISE; END IF; END;
  PERFORM public.confirm_adult(true);
  ASSERT public.is_adult(u1), 'attestation recorded';
  RESET ROLE;
  ASSERT (SELECT adult_consent_version_id IS NOT NULL FROM public.profiles WHERE id = u1), 'consent version stored';

  -- Guardian: default events reject minors.
  BEGIN INSERT INTO public.rsvps (event_id, guest_name, guest_email, minor_first_name, minor_age_band, guardian_consent_at) VALUES (ev, 'Parent', 'p@example.test', 'Ana', '5_12', now());
    RAISE EXCEPTION 'expected minors_not_allowed';
  EXCEPTION WHEN others THEN IF SQLERRM NOT LIKE '%minors_not_allowed%' THEN RAISE; END IF; END;

  -- Claim: own RSVP + two guest duplicates + another user's row.
  INSERT INTO public.rsvps (event_id, user_id, status, created_at) VALUES (ev, u1, 'going', now() - interval '3 days') RETURNING id INTO own;
  INSERT INTO public.rsvps (event_id, guest_name, guest_email, status) VALUES (ev, 'A', ' CLAIM-A@example.test ', 'going') RETURNING id INTO g1;
  INSERT INTO public.rsvps (event_id, user_id, guest_name, guest_email, status) VALUES (ev, u2, 'B', 'claim-a@example.test', 'going') RETURNING id INTO g2;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  res := public.claim_guest_records();
  ASSERT (res->>'merged')::int = 1 AND (res->>'claimed')::int = 0, 'duplicate merged, not claimed: ' || res;
  res := public.claim_guest_records();
  ASSERT (res->>'merged')::int = 0 AND (res->>'claimed')::int = 0, 'idempotent';
  RESET ROLE;
  ASSERT (SELECT merged_into_rsvp_id = own AND status = 'cancelled' FROM public.rsvps WHERE id = g1), 'duplicate kept and linked';
  ASSERT (SELECT user_id = u2 FROM public.rsvps WHERE id = g2), 'other user row untouched';
  ASSERT EXISTS (SELECT 1 FROM public.rsvps WHERE id = g1), 'never deleted';

  -- Unverified email claims nothing.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  res := public.claim_guest_records();
  ASSERT res->>'reason' = 'unverified', 'unverified blocked';

  -- Auth intents: safe path only, single use.
  BEGIN PERFORM public.create_auth_intent('//evil.com'); RAISE EXCEPTION 'expected unsafe_path';
  EXCEPTION WHEN others THEN IF SQLERRM NOT LIKE '%unsafe_path%' THEN RAISE; END IF; END;
  tok := public.create_auth_intent('/e/abc');
  p := public.consume_auth_intent(tok); ASSERT p = '/e/abc', 'consumed once';
  p := public.consume_auth_intent(tok); ASSERT p IS NULL, 'single use';
  RESET ROLE;
END $$;
ROLLBACK;
