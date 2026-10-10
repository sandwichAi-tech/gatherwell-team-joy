CREATE TABLE public.founding_program (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  start_date date,
  free_months integer NOT NULL DEFAULT 6 CHECK (free_months BETWEEN 1 AND 24),
  rate_cents integer NOT NULL DEFAULT 4900 CHECK (rate_cents >= 0),
  max_coaches integer NOT NULL DEFAULT 6 CHECK (max_coaches BETWEEN 1 AND 50),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.founding_program TO anon, authenticated;
GRANT ALL ON public.founding_program TO service_role;
ALTER TABLE public.founding_program ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read founding program" ON public.founding_program FOR SELECT TO anon, authenticated USING (true);
INSERT INTO public.founding_program (id) VALUES (true);

CREATE TABLE public.founding_coaches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  user_id uuid UNIQUE,
  full_name text NOT NULL DEFAULT '',
  language text NOT NULL DEFAULT 'en' CHECK (language IN ('en','es')),
  city text NOT NULL DEFAULT '',
  small_town boolean NOT NULL DEFAULT false,
  has_space boolean NOT NULL DEFAULT false,
  coach_type text NOT NULL DEFAULT 'independent' CHECK (coach_type IN ('distributor','independent')),
  audience text NOT NULL DEFAULT '' CHECK (char_length(audience) <= 280),
  launch_date date,
  council_months date[] NOT NULL DEFAULT '{}',
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX founding_coaches_email_key ON public.founding_coaches (lower(email));
GRANT SELECT ON public.founding_coaches TO authenticated;
GRANT ALL ON public.founding_coaches TO service_role;
ALTER TABLE public.founding_coaches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Coach reads own founding row" ON public.founding_coaches FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR lower(email) = lower(coalesce(auth.jwt()->>'email','')) OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.founding_limit() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF (SELECT count(*) FROM founding_coaches) >= (SELECT max_coaches FROM founding_program) THEN RAISE EXCEPTION 'founding_full'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER founding_limit BEFORE INSERT ON public.founding_coaches FOR EACH ROW EXECUTE FUNCTION public.founding_limit();

-- Founding status for one coach: in free window, on the locked rate after, or not founding.
CREATE OR REPLACE FUNCTION public.founding_status(_uid uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT CASE WHEN fc.id IS NULL THEN NULL ELSE jsonb_build_object(
    'start_date', fp.start_date,
    'free_until', CASE WHEN fp.start_date IS NULL THEN NULL ELSE (fp.start_date + make_interval(months => fp.free_months))::date END,
    'rate_cents', fp.rate_cents,
    'in_window', fp.start_date IS NOT NULL AND current_date >= fp.start_date AND current_date < (fp.start_date + make_interval(months => fp.free_months))::date,
    'pending_start', fp.start_date IS NULL OR current_date < fp.start_date) END
  FROM founding_program fp LEFT JOIN founding_coaches fc ON fc.user_id = _uid AND fc.accepted_at IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.is_founding_coach(_uid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM founding_coaches WHERE user_id = _uid AND accepted_at IS NOT NULL);
$$;
GRANT EXECUTE ON FUNCTION public.is_founding_coach(uuid) TO anon, authenticated;

-- Coach accepts the founding commitments; links the invite to their account by email.
CREATE OR REPLACE FUNCTION public.accept_founding() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _uid uuid := auth.uid(); _email text := lower(coalesce(auth.jwt()->>'email',''));
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_signed_in'; END IF;
  UPDATE founding_coaches SET user_id = _uid, accepted_at = coalesce(accepted_at, now())
   WHERE (user_id = _uid OR (user_id IS NULL AND lower(email) = _email));
  IF NOT FOUND THEN RAISE EXCEPTION 'not_invited'; END IF;
END; $$;
REVOKE EXECUTE ON FUNCTION public.accept_founding() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_founding() TO authenticated;

-- Founding coaches get Pro during the free window.
CREATE OR REPLACE FUNCTION public.effective_plan(_uid uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE b record; s record; f jsonb;
BEGIN
  SELECT * INTO b FROM billing_accounts WHERE user_id = _uid;
  IF FOUND AND b.plan <> 'free' AND (b.status IN ('active','past_due') OR (b.status = 'trialing' AND (b.renews_at IS NULL OR b.renews_at > now()))) THEN
    RETURN jsonb_build_object('plan', b.plan, 'source', 'own');
  END IF;
  f := founding_status(_uid);
  IF f IS NOT NULL AND (f->>'in_window')::boolean THEN RETURN jsonb_build_object('plan', 'pro', 'source', 'founding'); END IF;
  SELECT l.team_id, t.name AS team_name, p.full_name AS leader_name INTO s
  FROM license_seats ls JOIN team_licenses l ON l.team_id = ls.team_id AND l.status IN ('active','past_due')
  JOIN teams t ON t.id = l.team_id LEFT JOIN profiles p ON p.id = l.leader_id
  WHERE ls.user_id = _uid LIMIT 1;
  IF FOUND THEN RETURN jsonb_build_object('plan', 'growth', 'source', 'license', 'leader', s.leader_name, 'team', s.team_name); END IF;
  RETURN jsonb_build_object('plan', 'free', 'source', 'own');
END; $$;

CREATE OR REPLACE FUNCTION public.my_plan_status() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _uid uuid := auth.uid(); ep jsonb; lim jsonb; b record; _largest int; _ai int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_signed_in'; END IF;
  ep := effective_plan(_uid); lim := plan_limits(ep->>'plan');
  SELECT * INTO b FROM billing_accounts WHERE user_id = _uid;
  SELECT coalesce(max(event_seats_used(id)), 0) INTO _largest FROM events
    WHERE host_id = _uid AND status = 'published' AND coalesce(ends_at, starts_at) >= now();
  SELECT count(*)::int INTO _ai FROM ai_usage WHERE user_id = _uid AND created_at >= date_trunc('month', now());
  RETURN ep || jsonb_build_object('limits', lim,
    'own_plan', coalesce(b.plan, 'free'), 'billing_period', b.billing_period, 'status', coalesce(b.status, 'active'),
    'renews_at', b.renews_at, 'has_customer', b.stripe_customer_id IS NOT NULL,
    'connect_status', coalesce(b.connect_status, 'not_started'), 'pass_fee', coalesce(b.pass_fee, false),
    'legacy_price_cents', b.legacy_price_cents, 'fees_month', host_fees_this_month(_uid),
    'founding', founding_status(_uid),
    'usage', jsonb_build_object('gatherings', gatherings_this_month(_uid), 'largest_guests', _largest,
      'storage_bytes', storage_used_bytes(_uid), 'assistant', _ai));
END; $$;

-- Admin progress view: commitments vs. activity.
CREATE OR REPLACE FUNCTION public.admin_founding() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN jsonb_build_object('program', (SELECT to_jsonb(fp) FROM founding_program fp),
    'coaches', coalesce((SELECT jsonb_agg(to_jsonb(fc) || jsonb_build_object(
      'gatherings_month', CASE WHEN fc.user_id IS NULL THEN 0 ELSE (SELECT count(*) FROM events e WHERE e.host_id = fc.user_id AND e.status = 'published'
        AND e.starts_at >= date_trunc('month', now()) AND e.starts_at < date_trunc('month', now()) + interval '1 month') END,
      'council_this_month', date_trunc('month', now())::date = ANY(fc.council_months)) ORDER BY fc.created_at) FROM founding_coaches fc), '[]'::jsonb));
END; $$;
REVOKE EXECUTE ON FUNCTION public.admin_founding() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_founding() TO authenticated;

-- Featured placement in Discover during the free window.
CREATE OR REPLACE FUNCTION public.list_public_gatherings(_include_samples boolean DEFAULT false, _days integer DEFAULT 14, _limit integer DEFAULT 48)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _real jsonb; _samples jsonb := '[]'::jsonb;
BEGIN
  SELECT coalesce(jsonb_agg(x ORDER BY (x->>'featured')::boolean DESC, (x->>'starts_at')), '[]'::jsonb) INTO _real FROM (
    SELECT jsonb_build_object(
      'id', e.id, 'is_sample', false, 'title', e.title, 'starts_at', e.starts_at, 'timezone', e.timezone,
      'category', public.infer_gathering_category(e.title, e.category), 'category_label', e.category_label,
      'location_name', coalesce(e.location_name, CASE WHEN e.online_url IS NOT NULL THEN NULL END),
      'is_online', e.online_url IS NOT NULL AND e.location_name IS NULL AND e.address IS NULL,
      'lat', e.lat, 'lng', e.lng, 'capacity', e.capacity,
      'going', coalesce(c.going, 0),
      'featured', coalesce((public.founding_status(e.host_id)->>'in_window')::boolean, false),
      'host_name', trim(split_part(coalesce(p.full_name,''),' ',1) || ' ' || coalesce(nullif(left(split_part(trim(coalesce(p.full_name,'')),' ',2),1),'') || '.', '')),
      'initials', CASE WHEN e.hide_guest_list THEN '[]'::jsonb ELSE (
        SELECT coalesce(jsonb_agg(i), '[]'::jsonb) FROM (
          SELECT upper(left(coalesce(r.guest_name, rp.full_name, '?'),1)) AS i
          FROM public.rsvps r LEFT JOIN public.profiles rp ON rp.id = r.user_id
          WHERE r.event_id = e.id AND r.status = 'going' ORDER BY r.created_at LIMIT 3) s) END
    ) AS x
    FROM public.events e
    LEFT JOIN public.event_live_counts c ON c.event_id = e.id
    LEFT JOIN public.profiles p ON p.id = e.host_id
    WHERE e.visibility = 'public' AND e.status = 'published'
      AND e.starts_at >= now() - interval '2 hours'
      AND e.starts_at < now() + make_interval(days => greatest(1, least(_days, 60)))
    ORDER BY e.starts_at LIMIT greatest(1, least(_limit, 100))
  ) q;
  IF _include_samples THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id, 'is_sample', true, 'hero', s.hero, 'slot_order', s.slot_order, 'title_en', s.title_en, 'title_es', s.title_es,
      'category', s.category, 'dow', s.dow, 'local_time', to_char(s.local_time, 'HH24:MI'), 'location_name', s.location_name,
      'lat', s.lat, 'lng', s.lng, 'capacity', s.capacity, 'going', s.going, 'going_names', to_jsonb(s.going_names),
      'host_name', s.host_name) ORDER BY s.slot_order), '[]'::jsonb) INTO _samples
    FROM public.sample_gatherings s WHERE s.is_sample;
  END IF;
  RETURN jsonb_build_object('real', _real, 'samples', _samples);
END $function$;