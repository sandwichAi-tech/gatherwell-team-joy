
-- 1. Host analytics: caller's own hosted/co-hosted events, owned offers, real order ledger only.
CREATE OR REPLACE FUNCTION public.host_analytics() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  RETURN jsonb_build_object(
    'events', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', e.id, 'title', e.title, 'starts_at', e.starts_at, 'status', e.status,
        'going', s.going, 'attended', s.attended, 'waitlist', s.waitlist, 'cancelled', s.cancelled
      ) ORDER BY e.starts_at DESC NULLS LAST)
      FROM events e
      CROSS JOIN LATERAL (
        SELECT
          count(*) FILTER (WHERE r.status IN ('going','maybe')) AS going,
          count(*) FILTER (WHERE r.checked_in_at IS NOT NULL) AS attended,
          count(*) FILTER (WHERE r.status = 'waitlist') AS waitlist,
          count(*) FILTER (WHERE r.status = 'cancelled') AS cancelled
        FROM rsvps r WHERE r.event_id = e.id
      ) s
      WHERE e.host_id = _uid
         OR EXISTS (SELECT 1 FROM event_cohosts ec WHERE ec.event_id = e.id AND ec.user_id = _uid)
    ), '[]'::jsonb),
    'offers', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', o.id, 'title', o.title_en, 'kind', o.kind, 'status', o.status,
        'enrollments', st.enrollments, 'learners_started', st.started, 'certificates', st.certs
      ) ORDER BY o.created_at DESC)
      FROM offers o
      CROSS JOIN LATERAL (
        SELECT
          (SELECT count(DISTINCT en.user_id) FROM entitlements en WHERE en.offer_id = o.id AND en.revoked_at IS NULL) AS enrollments,
          (SELECT count(DISTINCT lp.user_id) FROM lesson_progress lp
             JOIN lessons l ON l.id = lp.lesson_id
             JOIN tracks tr ON tr.id = l.track_id
            WHERE tr.offer_id = o.id) AS started,
          (SELECT count(*) FROM certificates c WHERE c.offer_id = o.id AND c.revoked_at IS NULL) AS certs
      ) st
      WHERE o.host_id = _uid
    ), '[]'::jsonb),
    'sales', (
      SELECT jsonb_build_object(
        'orders', count(*),
        'gross_cents', COALESCE(sum(gross_cents), 0),
        'platform_fee_cents', COALESCE(sum(platform_fee_cents), 0),
        'net_cents', COALESCE(sum(gross_cents - discount_cents - platform_fee_cents), 0)
      ) FROM orders WHERE host_id = _uid AND status IN ('paid','partially_refunded','refunded')
    )
  );
END $$;
GRANT EXECUTE ON FUNCTION public.host_analytics() TO authenticated;

-- 2. Team analytics: aggregate counts only, gated by the central capability check (owner/admin/analyst).
CREATE OR REPLACE FUNCTION public.team_analytics(_team uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.team_capability(_team, 'analytics') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN jsonb_build_object(
    'members', (SELECT count(*) FROM team_members WHERE team_id = _team AND suspended_at IS NULL),
    'events', (SELECT count(*) FROM events WHERE team_id = _team),
    'events_30d', (SELECT count(*) FROM events WHERE team_id = _team AND created_at > now() - interval '30 days'),
    'registrations', (SELECT count(*) FROM rsvps r JOIN events e ON e.id = r.event_id WHERE e.team_id = _team AND r.status IN ('going','maybe')),
    'attended', (SELECT count(*) FROM rsvps r JOIN events e ON e.id = r.event_id WHERE e.team_id = _team AND r.checked_in_at IS NOT NULL),
    'offers', (SELECT count(*) FROM offers WHERE team_id = _team),
    'enrollments', (SELECT count(DISTINCT en.user_id) FROM entitlements en JOIN offers o ON o.id = en.offer_id WHERE o.team_id = _team AND en.revoked_at IS NULL)
  );
END $$;
GRANT EXECUTE ON FUNCTION public.team_analytics(uuid) TO authenticated;

-- 3. Export my data: every row the caller owns, server-scoped to auth.uid(); no other user's data.
CREATE OR REPLACE FUNCTION public.export_my_data() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _email text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT email INTO _email FROM auth.users WHERE id = _uid;
  RETURN jsonb_build_object(
    'exported_at', now(),
    'profile', (SELECT to_jsonb(p) - 'id' FROM profiles p WHERE p.id = _uid),
    'registrations', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'event', e.title, 'starts_at', e.starts_at, 'status', r.status, 'plus_ones', r.plus_ones,
        'checked_in_at', r.checked_in_at, 'language', r.language, 'created_at', r.created_at,
        'minor_first_name', r.minor_first_name, 'minor_age_band', r.minor_age_band,
        'guardian_name', r.guardian_name, 'guardian_relationship', r.guardian_relationship
      ) ORDER BY r.created_at DESC)
      FROM rsvps r JOIN events e ON e.id = r.event_id WHERE r.user_id = _uid), '[]'::jsonb),
    'waiver_acceptances', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'event', e.title, 'version', w.version, 'full_name', w.full_name, 'source', w.source, 'accepted_at', w.accepted_at
      ) ORDER BY w.accepted_at DESC)
      FROM waiver_acceptances w JOIN events e ON e.id = w.event_id
      WHERE w.rsvp_id IN (SELECT id FROM rsvps WHERE user_id = _uid)), '[]'::jsonb),
    'entitlements', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'kind', en.kind, 'source', en.source, 'starts_at', en.starts_at, 'ends_at', en.ends_at, 'revoked_at', en.revoked_at
      )) FROM entitlements en WHERE en.user_id = _uid), '[]'::jsonb),
    'purchases', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'offering_type', o.offering_type, 'status', o.status, 'currency', o.currency,
        'gross_cents', o.gross_cents, 'discount_cents', o.discount_cents, 'platform_fee_cents', o.platform_fee_cents, 'created_at', o.created_at
      ) ORDER BY o.created_at DESC) FROM orders o WHERE o.buyer_user_id = _uid), '[]'::jsonb),
    'lesson_progress', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'lesson', l.title_en, 'started_at', lp.started_at, 'completed_at', lp.completed_at
      )) FROM lesson_progress lp JOIN lessons l ON l.id = lp.lesson_id WHERE lp.user_id = _uid), '[]'::jsonb),
    'quiz_attempts', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'quiz_id', qa.quiz_id, 'attempt_no', qa.attempt_no, 'score_pct', qa.score_pct, 'passed', qa.passed, 'submitted_at', qa.submitted_at
      )) FROM quiz_attempts qa WHERE qa.user_id = _uid), '[]'::jsonb),
    'certificates', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'cert_number', c.cert_number, 'course_title', c.course_title, 'issued_at', c.issued_at, 'revoked_at', c.revoked_at
      )) FROM certificates c WHERE c.user_id = _uid), '[]'::jsonb),
    'follows', COALESCE((SELECT jsonb_agg(jsonb_build_object('target_kind', f.target_kind, 'created_at', f.created_at)) FROM follows f WHERE f.follower_id = _uid), '[]'::jsonb),
    'saved_offerings', COALESCE((SELECT jsonb_agg(jsonb_build_object('kind', s.kind, 'target_id', s.target_id, 'created_at', s.created_at)) FROM saved_offerings s WHERE s.user_id = _uid), '[]'::jsonb),
    'location_alerts', COALESCE((SELECT jsonb_agg(jsonb_build_object('label', a.label, 'city', a.city, 'region', a.region, 'country', a.country, 'radius_km', a.radius_km, 'paused', a.paused, 'created_at', a.created_at)) FROM location_alerts a WHERE a.user_id = _uid), '[]'::jsonb),
    'support_tickets', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'category', t.category, 'subject', t.subject, 'status', t.status, 'created_at', t.created_at,
        'messages', (SELECT jsonb_agg(jsonb_build_object('is_staff', m.is_staff, 'body', m.body, 'created_at', m.created_at) ORDER BY m.created_at) FROM support_messages m WHERE m.ticket_id = t.id)
      ) ORDER BY t.created_at DESC) FROM support_tickets t WHERE t.user_id = _uid), '[]'::jsonb),
    'contact_threads', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'status', ct.status, 'created_at', ct.created_at,
        'messages', (SELECT jsonb_agg(jsonb_build_object('mine', cm.sender_id = _uid, 'body', cm.body, 'created_at', cm.created_at) ORDER BY cm.created_at) FROM contact_messages cm WHERE cm.thread_id = ct.id)
      )) FROM contact_threads ct WHERE ct.user_id = _uid), '[]'::jsonb),
    'email_preferences', (SELECT to_jsonb(ep) - 'token' FROM email_prefs ep WHERE ep.email = _email),
    'notification_preferences', (SELECT to_jsonb(p.notify_prefs) FROM profiles p WHERE p.id = _uid)
  );
END $$;
GRANT EXECUTE ON FUNCTION public.export_my_data() TO authenticated;

-- 4. Consent history: caller's own attestations, waivers, guardian consents, terms, marketing prefs.
CREATE OR REPLACE FUNCTION public.my_consent_history() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _email text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT email INTO _email FROM auth.users WHERE id = _uid;
  RETURN jsonb_build_object(
    'adult_confirmed_at', (SELECT adult_confirmed_at FROM profiles WHERE id = _uid),
    'terms', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'event', e.title, 'accepted_at', r.terms_accepted_at
      ) ORDER BY r.terms_accepted_at DESC) FROM rsvps r JOIN events e ON e.id = r.event_id
      WHERE r.user_id = _uid AND r.terms_accepted_at IS NOT NULL), '[]'::jsonb),
    'waivers', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'event', e.title, 'version', w.version, 'source', w.source, 'accepted_at', w.accepted_at
      ) ORDER BY w.accepted_at DESC) FROM waiver_acceptances w JOIN events e ON e.id = w.event_id
      WHERE w.rsvp_id IN (SELECT id FROM rsvps WHERE user_id = _uid)), '[]'::jsonb),
    'guardian_consents', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'event', e.title, 'minor_first_name', r.minor_first_name, 'minor_age_band', r.minor_age_band,
        'guardian_relationship', r.guardian_relationship, 'consented_at', r.guardian_consent_at
      ) ORDER BY r.guardian_consent_at DESC) FROM rsvps r JOIN events e ON e.id = r.event_id
      WHERE r.user_id = _uid AND r.guardian_consent_at IS NOT NULL), '[]'::jsonb),
    'marketing', (SELECT jsonb_build_object('all_off', ep.all_off, 'reminders', ep.reminders, 'announcements', ep.announcements, 'badges', ep.badges, 'followups', ep.followups, 'updated_at', ep.updated_at) FROM email_prefs ep WHERE ep.email = _email)
  );
END $$;
GRANT EXECUTE ON FUNCTION public.my_consent_history() TO authenticated;
