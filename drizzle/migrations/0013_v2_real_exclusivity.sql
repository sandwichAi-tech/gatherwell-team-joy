ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS founding_seats integer, ADD COLUMN IF NOT EXISTS founding_price_cents integer;
ALTER TABLE public.offers ADD CONSTRAINT offers_founding_check CHECK ((founding_seats IS NULL AND founding_price_cents IS NULL) OR (founding_seats BETWEEN 1 AND 500 AND founding_price_cents >= 0));
ALTER TABLE public.offer_purchases ADD COLUMN IF NOT EXISTS founding boolean NOT NULL DEFAULT false;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS early_offer_id uuid REFERENCES public.offers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS public_rsvp_at timestamptz;

-- Exact founding seat count, enforced at write time
CREATE OR REPLACE FUNCTION public.guard_founding_seat() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _seats int; _taken int;
BEGIN
  IF NOT NEW.founding OR (TG_OP = 'UPDATE' AND OLD.founding) THEN RETURN NEW; END IF;
  SELECT founding_seats INTO _seats FROM public.offers WHERE id = NEW.offer_id FOR UPDATE;
  SELECT count(*) INTO _taken FROM public.offer_purchases WHERE offer_id = NEW.offer_id AND founding AND id <> NEW.id;
  IF _seats IS NULL OR _taken >= _seats THEN NEW.founding := false; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS offer_founding_seat ON public.offer_purchases;
CREATE TRIGGER offer_founding_seat BEFORE INSERT OR UPDATE OF founding ON public.offer_purchases FOR EACH ROW EXECUTE FUNCTION public.guard_founding_seat();

CREATE OR REPLACE FUNCTION public.offer_founding_status(_offer uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN o.founding_seats IS NULL THEN NULL ELSE jsonb_build_object('seats', o.founding_seats, 'price_cents', o.founding_price_cents,
    'taken', (SELECT count(*) FROM public.offer_purchases p WHERE p.offer_id = o.id AND p.founding),
    'left', greatest(0, o.founding_seats - (SELECT count(*) FROM public.offer_purchases p WHERE p.offer_id = o.id AND p.founding))) END
  FROM public.offers o WHERE o.id = _offer AND (o.status = 'published' OR o.host_id = auth.uid())
$$;
GRANT EXECUTE ON FUNCTION public.offer_founding_status(uuid) TO anon, authenticated;

-- Free founding seats (founding price 0) claim directly
CREATE OR REPLACE FUNCTION public.join_free_offer(_offer uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o record; _left int; _founding boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_signed_in'; END IF;
  SELECT * INTO o FROM public.offers WHERE id = _offer AND status = 'published';
  IF NOT FOUND OR NOT public.can_use_team_templates(o.team_id) THEN RAISE EXCEPTION 'not_found'; END IF;
  IF o.founding_seats IS NOT NULL AND o.founding_price_cents = 0 THEN
    _left := ((public.offer_founding_status(_offer))->>'left')::int;
    _founding := _left > 0;
  END IF;
  IF o.price_cents > 0 AND NOT _founding THEN RAISE EXCEPTION 'payment_required'; END IF;
  INSERT INTO public.offer_purchases (offer_id, user_id, status, founding)
  VALUES (_offer, auth.uid(), CASE WHEN o.kind = 'download' THEN 'paid' ELSE 'active' END, _founding)
  ON CONFLICT (offer_id, user_id) DO UPDATE SET status = EXCLUDED.status, cancel_at_period_end = false, renews_at = NULL, founding = public.offer_purchases.founding OR EXCLUDED.founding;
END $$;

-- Early access: members of a membership offer RSVP before the public
CREATE OR REPLACE FUNCTION public.set_early_access(_event uuid, _offer uuid, _hours integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.can_manage_event(_event) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  IF _offer IS NULL THEN UPDATE public.events SET early_offer_id = NULL, public_rsvp_at = NULL WHERE id = _event; RETURN; END IF;
  IF _hours NOT BETWEEN 1 AND 168 THEN RAISE EXCEPTION 'invalid'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.offers o JOIN public.events e ON e.id = _event WHERE o.id = _offer AND o.kind = 'membership' AND o.status = 'published' AND o.host_id = e.host_id) THEN RAISE EXCEPTION 'invalid'; END IF;
  UPDATE public.events SET early_offer_id = _offer, public_rsvp_at = now() + make_interval(hours => _hours) WHERE id = _event;
END $$;
REVOKE ALL ON FUNCTION public.set_early_access(uuid,uuid,integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_early_access(uuid,uuid,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.event_early_access(_event uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN e.public_rsvp_at IS NULL OR e.public_rsvp_at <= now() THEN NULL ELSE jsonb_build_object(
    'public_at', e.public_rsvp_at, 'offer_id', e.early_offer_id,
    'offer_title_en', o.title_en, 'offer_title_es', o.title_es,
    'has_access', auth.uid() IS NOT NULL AND (public.has_offer_access(e.early_offer_id, auth.uid()) OR public.can_manage_event(e.id))) END
  FROM public.events e LEFT JOIN public.offers o ON o.id = e.early_offer_id WHERE e.id = _event AND e.status = 'published'
$$;
GRANT EXECUTE ON FUNCTION public.event_early_access(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.guard_early_access_rsvp() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _e record;
BEGIN
  IF coalesce(auth.jwt()->>'role','') = 'service_role' OR NEW.is_walk_in THEN RETURN NEW; END IF;
  SELECT early_offer_id, public_rsvp_at INTO _e FROM public.events WHERE id = NEW.event_id;
  IF _e.public_rsvp_at IS NULL OR _e.public_rsvp_at <= now() THEN RETURN NEW; END IF;
  IF auth.uid() IS NOT NULL AND (public.has_offer_access(_e.early_offer_id, auth.uid()) OR public.can_manage_event(NEW.event_id)) THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'early_access';
END $$;
DROP TRIGGER IF EXISTS rsvp_early_access ON public.rsvps;
CREATE TRIGGER rsvp_early_access BEFORE INSERT ON public.rsvps FOR EACH ROW EXECUTE FUNCTION public.guard_early_access_rsvp();

-- Honest waitlist position
CREATE OR REPLACE FUNCTION public.waitlist_position(_code text) RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN r.status <> 'waitlist' THEN NULL ELSE
    (SELECT count(*)::int FROM public.rsvps w WHERE w.event_id = r.event_id AND w.status = 'waitlist' AND (w.created_at < r.created_at OR (w.created_at = r.created_at AND w.id <= r.id))) END
  FROM public.rsvps r WHERE r.checkin_code = _code AND length(_code) >= 16
$$;
GRANT EXECUTE ON FUNCTION public.waitlist_position(text) TO anon, authenticated;