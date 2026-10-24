-- Second fix from live verification: entitlements has kind/target and source CHECK constraints.
-- kind 'course' requires track_id, so offer-linked course entitlements must use 'course_subscription';
-- source must be one of order/subscription/free/founding/admin/legacy.

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
  k := CASE o.kind WHEN 'download' THEN 'resource' WHEN 'membership' THEN 'membership' ELSE 'course_subscription' END;
  IF NOT EXISTS (SELECT 1 FROM public.entitlements e WHERE e.offer_id = o.id AND e.user_id = auth.uid() AND e.revoked_at IS NULL) THEN
    INSERT INTO public.entitlements (user_id, kind, offer_id, source) VALUES (auth.uid(), k, o.id, 'free');
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
  k := CASE o.kind WHEN 'download' THEN 'resource' WHEN 'membership' THEN 'membership' ELSE 'course_subscription' END;
  INSERT INTO public.entitlements (user_id, kind, offer_id, source) VALUES (uid, k, o.id, 'admin');
  INSERT INTO public.offer_grants (offer_id, granted_by, granted_to) VALUES (o.id, auth.uid(), uid);
  RETURN 'granted';
END; $$;