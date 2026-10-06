CREATE TABLE public.offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL DEFAULT auth.uid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('membership','course','download')),
  title_en text NOT NULL DEFAULT '', title_es text NOT NULL DEFAULT '',
  description_en text, description_es text,
  includes_en jsonb NOT NULL DEFAULT '[]', includes_es jsonb NOT NULL DEFAULT '[]',
  price_cents integer NOT NULL DEFAULT 0 CHECK (price_cents >= 0 AND price_cents <= 100000),
  cover_style smallint NOT NULL DEFAULT 0,
  file_path text,
  drip_days integer NOT NULL DEFAULT 7 CHECK (drip_days BETWEEN 0 AND 60),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (length(title_en) <= 120 AND length(title_es) <= 120)
);
CREATE TABLE public.offer_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','past_due','canceled','paid','refunded')),
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  renews_at timestamptz,
  stripe_subscription_id text,
  amount_cents integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (offer_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.offers TO authenticated;
GRANT ALL ON public.offers TO service_role;
GRANT SELECT ON public.offer_purchases TO authenticated;
GRANT ALL ON public.offer_purchases TO service_role;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team reads published offers, host reads own" ON public.offers FOR SELECT TO authenticated
  USING (host_id = auth.uid() OR (status = 'published' AND public.can_use_team_templates(team_id)));
CREATE POLICY "Hosts create offers" ON public.offers FOR INSERT TO authenticated
  WITH CHECK (host_id = auth.uid() AND public.is_team_member(team_id, ARRAY['leader','host']));
CREATE POLICY "Hosts edit own offers" ON public.offers FOR UPDATE TO authenticated
  USING (host_id = auth.uid()) WITH CHECK (host_id = auth.uid() AND public.is_team_member(team_id, ARRAY['leader','host']));
CREATE POLICY "Hosts delete own draft offers" ON public.offers FOR DELETE TO authenticated
  USING (host_id = auth.uid() AND status = 'draft' AND NOT EXISTS (SELECT 1 FROM public.offer_purchases p WHERE p.offer_id = id));

CREATE POLICY "Buyer or host reads purchases" ON public.offer_purchases FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.offers o WHERE o.id = offer_id AND o.host_id = auth.uid()));

CREATE TRIGGER offers_touch BEFORE UPDATE ON public.offers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER offer_purchases_touch BEFORE UPDATE ON public.offer_purchases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.events ADD COLUMN offer_id uuid REFERENCES public.offers(id) ON DELETE SET NULL;
ALTER TABLE public.tracks ADD COLUMN offer_id uuid REFERENCES public.offers(id) ON DELETE SET NULL;
ALTER TABLE public.payments ADD COLUMN offer_id uuid REFERENCES public.offers(id) ON DELETE SET NULL;
ALTER TABLE public.payments DROP CONSTRAINT payments_kind_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_kind_check CHECK (kind IN ('gathering','challenge','offer'));

CREATE OR REPLACE FUNCTION public.has_offer_access(_offer uuid, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _uid IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.offers o WHERE o.id = _offer AND o.host_id = _uid)
    OR EXISTS (SELECT 1 FROM public.offer_purchases p WHERE p.offer_id = _offer AND p.user_id = _uid
      AND (p.status = 'paid' OR (p.status IN ('active','past_due') AND (p.renews_at IS NULL OR p.renews_at > now() - interval '3 days')))));
$$;

CREATE OR REPLACE FUNCTION public.can_read_track(_track uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.tracks t WHERE t.id = _track AND (
    (t.is_published AND public.can_use_team_templates(t.team_id) AND (t.offer_id IS NULL OR public.has_offer_access(t.offer_id, auth.uid())))
    OR public.is_team_member(t.team_id, ARRAY['leader'])));
$$;

-- Members-only gatherings: RSVPs need an active membership (hosts/leaders and the payment system are exempt)
CREATE OR REPLACE FUNCTION public.guard_members_only_rsvp()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _offer uuid; _team uuid;
BEGIN
  IF coalesce(auth.jwt()->>'role','') = 'service_role' OR NEW.is_walk_in THEN RETURN NEW; END IF;
  SELECT offer_id, team_id INTO _offer, _team FROM public.events WHERE id = NEW.event_id;
  IF _offer IS NULL THEN RETURN NEW; END IF;
  IF public.has_offer_access(_offer, auth.uid()) OR public.can_manage_event(NEW.event_id) THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'members_only';
END $$;
CREATE TRIGGER rsvps_members_only BEFORE INSERT ON public.rsvps FOR EACH ROW EXECUTE FUNCTION public.guard_members_only_rsvp();

-- Hosts may only attach their own offers to gatherings/tracks
CREATE OR REPLACE FUNCTION public.guard_offer_link()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.offer_id IS NOT DISTINCT FROM (CASE WHEN TG_OP = 'UPDATE' THEN OLD.offer_id END) THEN RETURN NEW; END IF;
  IF NEW.offer_id IS NULL OR coalesce(auth.jwt()->>'role','') = 'service_role' THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.offers o WHERE o.id = NEW.offer_id AND o.team_id = NEW.team_id AND o.host_id = auth.uid() AND o.kind <> 'download') THEN
    RAISE EXCEPTION 'offer_not_yours';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER events_offer_link BEFORE INSERT OR UPDATE OF offer_id ON public.events FOR EACH ROW EXECUTE FUNCTION public.guard_offer_link();
CREATE TRIGGER tracks_offer_link BEFORE INSERT OR UPDATE OF offer_id ON public.tracks FOR EACH ROW EXECUTE FUNCTION public.guard_offer_link();

-- Free offers can be joined instantly (no payment needed)
CREATE OR REPLACE FUNCTION public.join_free_offer(_offer uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_signed_in'; END IF;
  SELECT * INTO o FROM public.offers WHERE id = _offer AND status = 'published';
  IF NOT FOUND OR NOT public.can_use_team_templates(o.team_id) THEN RAISE EXCEPTION 'not_found'; END IF;
  IF o.price_cents > 0 THEN RAISE EXCEPTION 'payment_required'; END IF;
  INSERT INTO public.offer_purchases (offer_id, user_id, status)
  VALUES (_offer, auth.uid(), CASE WHEN o.kind = 'download' THEN 'paid' ELSE 'active' END)
  ON CONFLICT (offer_id, user_id) DO UPDATE SET status = EXCLUDED.status, cancel_at_period_end = false, renews_at = NULL;
END $$;

-- Free memberships are left immediately; paid ones are canceled through payments
CREATE OR REPLACE FUNCTION public.leave_free_offer(_offer uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.offer_purchases SET status = 'canceled'
  WHERE offer_id = _offer AND user_id = auth.uid() AND stripe_subscription_id IS NULL AND status = 'active';
$$;

-- Host overview: offers with member counts (counts only)
CREATE OR REPLACE FUNCTION public.my_offer_stats()
RETURNS TABLE(offer_id uuid, active integer, total integer) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT o.id, count(*) FILTER (WHERE p.status IN ('active','past_due','paid'))::int, count(p.id)::int
  FROM public.offers o LEFT JOIN public.offer_purchases p ON p.offer_id = o.id
  WHERE o.host_id = auth.uid() GROUP BY o.id;
$$;

REVOKE ALL ON FUNCTION public.join_free_offer(uuid), public.leave_free_offer(uuid), public.my_offer_stats(), public.has_offer_access(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_free_offer(uuid), public.leave_free_offer(uuid), public.my_offer_stats(), public.has_offer_access(uuid, uuid) TO authenticated;

-- Private bucket policies for downloadable files: hosts write in their own folder; reads go through signed links from the server
CREATE POLICY "Hosts upload offer files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'offer-files' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Hosts manage own offer files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'offer-files' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Hosts read own offer files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'offer-files' AND (storage.foldername(name))[1] = auth.uid()::text);