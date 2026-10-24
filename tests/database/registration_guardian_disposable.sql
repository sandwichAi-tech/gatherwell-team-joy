-- DISPOSABLE COPY ONLY. Never run against production or preview. Everything rolls back.
-- Run manually: PGOPTIONS='-c app.disposable_database=YES' psql "$DISPOSABLE_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f tests/database/registration_guardian_disposable.sql
-- Regression coverage for the live verification pass of 2026-10-24:
--   * rsvp_event_minor ambiguous `status` column fix (migration 0056)
--   * capacity/waitlist ordering, promotion, position recalculation
--   * waitlist-disabled full event, terms gate, paid-tier gate
BEGIN;
DO $$
DECLARE
  ev_cap uuid := gen_random_uuid(); ev_nowl uuid := gen_random_uuid();
  ev_min uuid := gen_random_uuid(); ev_adult uuid := gen_random_uuid();
  team uuid := gen_random_uuid(); host uuid := gen_random_uuid();
  c1 text; c2 text; c3 text; s1 text; s2 text;
BEGIN
  IF current_setting('app.disposable_database', true) IS DISTINCT FROM 'YES' THEN
    RAISE EXCEPTION 'Run only on a disposable database copy with app.disposable_database=YES';
  END IF;

  INSERT INTO auth.users (id, email, email_confirmed_at, aud, role) VALUES (host, 'reg-host@example.test', now(), 'authenticated', 'authenticated');
  INSERT INTO public.profiles (id, full_name) VALUES (host, 'Reg Host') ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.teams (id, name, slug, owner_id) VALUES (team, 'Reg fixture team', 'reg-' || team, host);
  INSERT INTO public.team_members (team_id, user_id, role) VALUES (team, host, 'leader') ON CONFLICT DO NOTHING;
  INSERT INTO public.events (id, team_id, host_id, title, starts_at, status, visibility, capacity, waitlist_enabled) VALUES
    (ev_cap, team, host, 'Fixture cap1', now() + interval '2 days', 'published', 'public', 1, true),
    (ev_nowl, team, host, 'Fixture nowl', now() + interval '2 days', 'published', 'public', 1, false),
    (ev_min, team, host, 'Fixture minors', now() + interval '2 days', 'published', 'public', null, true),
    (ev_adult, team, host, 'Fixture adults', now() + interval '2 days', 'published', 'public', null, true);
  UPDATE public.events SET allows_minors = true, min_age = 13 WHERE id = ev_min;

  -- Terms gate: registration without terms consent is rejected.
  BEGIN
    PERFORM public.register_attendance(ev_cap, 'A', 'One', '', 'a1@example.test', 'en', 0, 'going', false, false, '', '{}', '', false, false, '');
    RAISE EXCEPTION 'expected terms_required';
  EXCEPTION WHEN others THEN IF SQLERRM NOT LIKE '%terms_required%' THEN RAISE; END IF; END;

  -- Capacity: first guest confirmed, second waitlisted.
  SELECT code, status INTO c1, s1 FROM public.register_attendance(ev_cap, 'A', 'One', '', 'a1@example.test', 'en', 0, 'going', false, false, '', '{}', '', true, false, '');
  ASSERT s1 = 'going', 'first registration confirmed, got ' || s1;
  SELECT code, status INTO c2, s2 FROM public.register_attendance(ev_cap, 'B', 'Two', '', 'b2@example.test', 'en', 0, 'going', false, false, '', '{}', '', true, false, '');
  ASSERT s2 = 'waitlist', 'second registration waitlisted, got ' || s2;
  ASSERT public.waitlist_position(c2) = 1, 'waitlist position 1';
  SELECT code, status INTO c3, s1 FROM public.register_attendance(ev_cap, 'C', 'Three', '', 'c3@example.test', 'en', 0, 'going', false, false, '', '{}', '', true, false, '');
  ASSERT s1 = 'waitlist' AND public.waitlist_position(c3) = 2, 'third registration waitlisted at position 2';

  -- Promotion: cancelling the confirmed seat promotes in order and recalculates positions.
  ASSERT public.cancel_rsvp_by_code(c1), 'cancel by code';
  PERFORM public.promote_waitlist(ev_cap);
  ASSERT public.waitlist_position(c2) IS NULL, 'promoted guest leaves waitlist';
  ASSERT (SELECT status FROM public.rsvps WHERE checkin_code = c2) = 'going', 'first waitlisted promoted';
  ASSERT public.waitlist_position(c3) = 1, 'position recalculated to 1';
  ASSERT public.cancel_rsvp_by_code(c3), 'leaving the waitlist works';

  -- Waitlist disabled: full event blocks clearly.
  SELECT code, status INTO c1, s1 FROM public.register_attendance(ev_nowl, 'D', 'Four', '', 'd4@example.test', 'en', 0, 'going', false, false, '', '{}', '', true, false, '');
  ASSERT s1 = 'going', 'no-waitlist first seat confirmed';
  BEGIN
    PERFORM public.register_attendance(ev_nowl, 'E', 'Five', '', 'e5@example.test', 'en', 0, 'going', false, false, '', '{}', '', true, false, '');
    RAISE EXCEPTION 'expected event_full';
  EXCEPTION WHEN others THEN IF SQLERRM NOT LIKE '%event_full%' THEN RAISE; END IF; END;

  -- Guardian / minors (regression: ambiguous `status` column made every call fail).
  BEGIN
    PERFORM public.rsvp_event_minor(ev_adult, 'Kid', '13_17', 'Guardian', 'parent', 'g@example.test', '', 'en', false, false, '');
    RAISE EXCEPTION 'expected minors_not_allowed';
  EXCEPTION WHEN others THEN IF SQLERRM NOT LIKE '%minors_not_allowed%' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.rsvp_event_minor(ev_min, 'Kid', '5_12', 'Guardian', 'parent', 'g@example.test', '', 'en', false, false, '');
    RAISE EXCEPTION 'expected min_age_not_met';
  EXCEPTION WHEN others THEN IF SQLERRM NOT LIKE '%min_age_not_met%' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.rsvp_event_minor(ev_min, 'Kid', '13_17', '', 'parent', '', '', 'en', false, false, '');
    RAISE EXCEPTION 'expected guardian_details_incomplete';
  EXCEPTION WHEN others THEN IF SQLERRM NOT LIKE '%guardian_details_incomplete%' THEN RAISE; END IF; END;
  SELECT code, status INTO c1, s1 FROM public.rsvp_event_minor(ev_min, 'Kid', '13_17', 'Guardian', 'parent', 'g@example.test', '', 'en', false, false, '');
  ASSERT s1 = 'going', 'valid minor registration succeeds, got ' || s1;
  ASSERT (SELECT guardian_consent_version_id IS NOT NULL AND guardian_consent_at IS NOT NULL FROM public.rsvps WHERE checkin_code = c1), 'guardian consent version stored server-side';

  -- Paid tier gate: a priced tier can never confirm without payment.
  UPDATE public.events SET ticket_tiers = jsonb_build_array(jsonb_build_object('id', 't1', 'name', 'General', 'price_cents', 2500, 'quantity', 10)) WHERE id = ev_adult;
  BEGIN
    PERFORM public.register_attendance(ev_adult, 'F', 'Six', '', 'f6@example.test', 'en', 0, 'going', false, false, '', '{}', '', true, false, 't1');
    RAISE EXCEPTION 'expected payment_required';
  EXCEPTION WHEN others THEN IF SQLERRM NOT LIKE '%payment_required%' THEN RAISE; END IF; END;

  RAISE NOTICE 'registration_guardian_disposable: all assertions passed';
END $$;
ROLLBACK;
