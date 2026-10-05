-- Category for gatherings (nullable; inferred from title when missing)
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_category_check;
ALTER TABLE public.events ADD CONSTRAINT events_category_check CHECK (category IS NULL OR category IN ('run','fitcamp','yoga','soundbath','hike','walk','pickleball','more'));

CREATE OR REPLACE FUNCTION public.infer_gathering_category(_title text, _category text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT coalesce(_category, CASE
    WHEN _title ~* '(run|jog|corr)' THEN 'run'
    WHEN _title ~* '(yoga)' THEN 'yoga'
    WHEN _title ~* '(sound|gong|sonido)' THEN 'soundbath'
    WHEN _title ~* '(hike|trail|sender|caminata de monta)' THEN 'hike'
    WHEN _title ~* '(walk|camin|paseo)' THEN 'walk'
    WHEN _title ~* '(pickleball)' THEN 'pickleball'
    WHEN _title ~* '(camp|boot|fit|hiit|entren)' THEN 'fitcamp'
    ELSE 'more' END)
$$;

-- Preview-only sample gatherings (the app only requests them on preview hosts)
CREATE TABLE public.sample_gatherings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_sample boolean NOT NULL DEFAULT true,
  slot_order smallint NOT NULL,
  hero boolean NOT NULL DEFAULT false,
  category text NOT NULL,
  title_en text NOT NULL, title_es text NOT NULL,
  dow smallint NOT NULL, local_time time NOT NULL,
  location_name text NOT NULL, lat double precision, lng double precision,
  capacity int, going int NOT NULL, going_names text[] NOT NULL DEFAULT '{}',
  host_name text NOT NULL
);
GRANT SELECT ON public.sample_gatherings TO anon, authenticated;
GRANT ALL ON public.sample_gatherings TO service_role;
ALTER TABLE public.sample_gatherings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads sample gatherings" ON public.sample_gatherings FOR SELECT TO anon, authenticated USING (is_sample);

INSERT INTO public.sample_gatherings (slot_order, hero, category, title_en, title_es, dow, local_time, location_name, lat, lng, capacity, going, going_names, host_name) VALUES
(1, true, 'run', 'Sunrise run club', 'Club de corredores al amanecer', 6, '07:00', 'Riverside Park', 30.2640, -97.7470, NULL, 16, ARRAY['Maya','Jordan'], 'Nick C.'),
(2, true, 'fitcamp', 'Fit camp in the park', 'Fit camp en el parque', 2, '06:00', 'Oak Hill Green', 30.2710, -97.7600, 20, 17, ARRAY['Sofía','Andre'], 'Lena M.'),
(3, true, 'soundbath', 'Sound bath under the oaks', 'Baño de sonido bajo los robles', 0, '17:00', 'Willow Grove', 30.2580, -97.7350, 24, 12, ARRAY['Priya','Sam'], 'Ana R.'),
(4, true, 'pickleball', 'Pickleball and smoothies', 'Pickleball y licuados', 3, '18:00', 'Eastside Courts', 30.2690, -97.7200, 16, 9, ARRAY['Leo','Grace'], 'Marcus T.'),
(5, false, 'yoga', 'Sunset yoga on the lawn', 'Yoga al atardecer en el pasto', 4, '18:30', 'Lakeshore Lawn', 30.2620, -97.7520, 30, 21, ARRAY['Camila','Ben'], 'Isabel G.'),
(6, false, 'hike', 'Saturday trail hike', 'Caminata por el sendero del sábado', 6, '08:30', 'Ridge Trailhead', 30.2900, -97.7800, NULL, 11, ARRAY['Noah','Elena'], 'Chris P.'),
(7, false, 'walk', 'Morning walk and talk', 'Caminata y charla matutina', 1, '07:30', 'Greenbelt Loop', 30.2550, -97.7650, NULL, 8, ARRAY['Rosa','Dev'], 'Hannah K.'),
(8, false, 'run', 'Thursday 5K social', 'Social de 5K del jueves', 4, '06:30', 'Harbor Boardwalk', 30.2600, -97.7410, NULL, 14, ARRAY['Luis','Kara'], 'Omar S.');

-- Testimonials from real early users; only approved ones are public
CREATE TABLE public.testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, city text, quote_en text NOT NULL, quote_es text,
  avatar_url text, photo_url text,
  approved boolean NOT NULL DEFAULT false, sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.testimonials TO anon, authenticated;
GRANT ALL ON public.testimonials TO service_role;
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads approved testimonials" ON public.testimonials FOR SELECT TO anon, authenticated USING (approved);
CREATE POLICY "Admins manage testimonials" ON public.testimonials FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
GRANT INSERT, UPDATE, DELETE ON public.testimonials TO authenticated;

-- Public feed: upcoming public, published gatherings (+ samples when asked). Initials only, never guest names.
CREATE OR REPLACE FUNCTION public.list_public_gatherings(_include_samples boolean DEFAULT false, _days int DEFAULT 14, _limit int DEFAULT 48)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _real jsonb; _samples jsonb := '[]'::jsonb;
BEGIN
  SELECT coalesce(jsonb_agg(x ORDER BY (x->>'starts_at')), '[]'::jsonb) INTO _real FROM (
    SELECT jsonb_build_object(
      'id', e.id, 'is_sample', false, 'title', e.title, 'starts_at', e.starts_at, 'timezone', e.timezone,
      'category', public.infer_gathering_category(e.title, e.category),
      'location_name', coalesce(e.location_name, CASE WHEN e.online_url IS NOT NULL THEN NULL END),
      'is_online', e.online_url IS NOT NULL AND e.location_name IS NULL AND e.address IS NULL,
      'lat', e.lat, 'lng', e.lng, 'capacity', e.capacity,
      'going', coalesce(c.going, 0),
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
END $$;

-- Social proof: check-ins in the last 30 days across public gatherings (count only)
CREATE OR REPLACE FUNCTION public.landing_social_proof()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('showed_up', coalesce(sum(c.checked_in + c.walk_ins), 0))
  FROM public.events e JOIN public.event_live_counts c ON c.event_id = e.id
  WHERE e.visibility = 'public' AND e.status = 'published'
    AND e.starts_at >= now() - interval '30 days' AND e.starts_at <= now()
$$;

REVOKE ALL ON FUNCTION public.list_public_gatherings(boolean, int, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.landing_social_proof() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_public_gatherings(boolean, int, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.landing_social_proof() TO anon, authenticated;