-- Fix 0057 defects found in live verification:
-- 1) entitlements.kind has a CHECK allowing only event/course/resource/membership/course_subscription/platform_plan;
--    map offer kind (course/download/membership) onto it instead of inserting 'offer'.
-- 2) offer_readiness referenced o.host_id without aliasing the table, so it always raised not_found.

CREATE OR REPLACE FUNCTION public.enroll_free(_offer uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE o public.offers; k text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_signed_in'; END IF;
  SELECT * INTO o FROM public.offers WHERE id = _offer AND status = 'published';
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF o.visibility NOT IN ('public','unlisted') AND NOT public.can_use_team_templates(o.team_id) THEN RAISE EXCEPTION 'not_found'; END IF;
  IF o.enroll_opens_at IS NOT NULL AND now() < o.enroll_opens_at THEN RAISE EXCEPTION 'enrollment_not_open'; END IF;
  IF o.enroll_closes_at IS NOT NULL AND now() > o.enroll_closes_at THEN RAISE EXCEPTION 'enrollment_closed'; END IF;
  IF o.price_cents > 0 THEN RAISE EXCEPTION 'payment_required'; END IF;
  INSERT INTO public.offer_purchases (offer_id, user_id, status, amount_cents)
  VALUES (o.id, auth.uid(), CASE WHEN o.kind = 'download' THEN 'paid' ELSE 'active' END, 0)
  ON CONFLICT (offer_id, user_id) DO NOTHING;
  k := CASE o.kind WHEN 'download' THEN 'resource' WHEN 'membership' THEN 'membership' ELSE 'course' END;
  IF NOT EXISTS (SELECT 1 FROM public.entitlements e WHERE e.offer_id = o.id AND e.user_id = auth.uid() AND e.revoked_at IS NULL) THEN
    INSERT INTO public.entitlements (user_id, kind, offer_id, source) VALUES (auth.uid(), k, o.id, 'free_enrollment');
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.grant_offer_access(_offer uuid, _email text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE o public.offers; uid uuid; k text;
BEGIN
  SELECT * INTO o FROM public.offers WHERE id = _offer AND host_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  SELECT u.id INTO uid FROM auth.users u WHERE lower(u.email) = lower(btrim(_email)) AND u.email_confirmed_at IS NOT NULL;
  IF uid IS NULL THEN RETURN 'no_account'; END IF;
  IF EXISTS (SELECT 1 FROM public.entitlements e WHERE e.offer_id = o.id AND e.user_id = uid AND e.revoked_at IS NULL)
     OR EXISTS (SELECT 1 FROM public.offer_purchases p WHERE p.offer_id = o.id AND p.user_id = uid AND p.status IN ('active','past_due','paid')) THEN
    RETURN 'already';
  END IF;
  k := CASE o.kind WHEN 'download' THEN 'resource' WHEN 'membership' THEN 'membership' ELSE 'course' END;
  INSERT INTO public.entitlements (user_id, kind, offer_id, source) VALUES (uid, k, o.id, 'manual_grant');
  INSERT INTO public.offer_grants (offer_id, granted_by, granted_to) VALUES (o.id, auth.uid(), uid);
  RETURN 'granted';
END; $$;

CREATE OR REPLACE FUNCTION public.offer_readiness(_offer uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE o public.offers; b text[] := '{}'; n_tracks int; n_lessons int;
BEGIN
  SELECT * INTO o FROM public.offers WHERE id = _offer AND host_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF length(trim(coalesce(o.title_en,''))) = 0 AND length(trim(coalesce(o.title_es,''))) = 0 THEN b := b || 'missing_title'; END IF;
  IF length(trim(coalesce(o.summary_en,''))) = 0 AND length(trim(coalesce(o.summary_es,''))) = 0 THEN b := b || 'missing_summary'; END IF;
  IF length(trim(coalesce(o.description_en,''))) = 0 AND length(trim(coalesce(o.description_es,''))) = 0 THEN b := b || 'missing_description'; END IF;
  IF o.kind = 'download' AND o.file_path IS NULL THEN b := b || 'missing_file'; END IF;
  IF o.kind IN ('course','membership') THEN
    SELECT count(*) INTO n_tracks FROM public.tracks t WHERE t.offer_id = o.id AND t.is_published;
    SELECT count(*) INTO n_lessons FROM public.lessons l JOIN public.tracks t ON t.id = l.track_id WHERE t.offer_id = o.id AND t.is_published AND l.is_published;
    IF n_tracks = 0 THEN b := b || 'no_sections'; END IF;
    IF n_lessons = 0 THEN b := b || 'no_lessons'; END IF;
  END IF;
  IF o.price_cents > 0 THEN b := b || 'paid_setup_required'; END IF;
  RETURN jsonb_build_object('blockers', b, 'sections', coalesce(n_tracks,0), 'lessons', coalesce(n_lessons,0));
END; $$;