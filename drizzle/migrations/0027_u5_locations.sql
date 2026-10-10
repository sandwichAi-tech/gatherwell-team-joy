CREATE TABLE public.locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL,
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{2,80}$'),
  mode text NOT NULL CHECK (mode IN ('linked','simple')),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 80),
  address text NOT NULL DEFAULT '' CHECK (length(address) <= 200),
  lat double precision, lng double precision,
  photos text[] NOT NULL DEFAULT '{}' CHECK (cardinality(photos) <= 6),
  booking_url text CHECK (booking_url IS NULL OR booking_url ~* '^https://'),
  store_url text CHECK (store_url IS NULL OR store_url ~* '^https://'),
  opening_notes text NOT NULL DEFAULT '' CHECK (length(opening_notes) <= 500),
  schedule jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(schedule) = 'array' AND jsonb_array_length(schedule) <= 30),
  capacity int CHECK (capacity IS NULL OR capacity BETWEEN 1 AND 1000),
  dropin_cents int CHECK (dropin_cents IS NULL OR dropin_cents BETWEEN 0 AND 100000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.locations TO authenticated;
GRANT ALL ON public.locations TO service_role;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their locations" ON public.locations FOR ALL TO authenticated
  USING (host_id = auth.uid()) WITH CHECK (host_id = auth.uid());
CREATE INDEX locations_host_idx ON public.locations(host_id);

ALTER TABLE public.events ADD COLUMN location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL;
CREATE INDEX events_location_idx ON public.events(location_id) WHERE location_id IS NOT NULL;

ALTER TABLE public.follows DROP CONSTRAINT IF EXISTS follows_target_kind_check;
ALTER TABLE public.follows ADD CONSTRAINT follows_target_kind_check CHECK (target_kind = ANY (ARRAY['host','team','location']));

CREATE OR REPLACE FUNCTION public.follow_target(_kind text, _target uuid, _email text DEFAULT NULL::text, _lang text DEFAULT 'en'::text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _l text := CASE WHEN _lang = 'es' THEN 'es' ELSE 'en' END;
BEGIN
  IF _kind NOT IN ('host','team','location') THEN RAISE EXCEPTION 'invalid_target'; END IF;
  IF (_kind = 'host' AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = _target)) OR (_kind = 'team' AND NOT EXISTS (SELECT 1 FROM teams WHERE id = _target))
     OR (_kind = 'location' AND NOT EXISTS (SELECT 1 FROM locations WHERE id = _target)) THEN RAISE EXCEPTION 'invalid_target'; END IF;
  IF auth.uid() IS NOT NULL THEN
    IF _kind = 'host' AND _target = auth.uid() THEN RAISE EXCEPTION 'self_follow'; END IF;
    IF _kind = 'location' AND EXISTS (SELECT 1 FROM locations WHERE id = _target AND host_id = auth.uid()) THEN RAISE EXCEPTION 'self_follow'; END IF;
    INSERT INTO follows (target_kind, target_id, follower_id, language) VALUES (_kind, _target, auth.uid(), _l) ON CONFLICT DO NOTHING;
  ELSE
    IF _email IS NULL OR _email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR length(_email) > 254 THEN RAISE EXCEPTION 'invalid_email'; END IF;
    IF (SELECT count(*) FROM follows WHERE lower(email) = lower(trim(_email)) AND created_at > now() - interval '1 hour') >= 20 THEN RAISE EXCEPTION 'rate_limited'; END IF;
    INSERT INTO follows (target_kind, target_id, email, language) VALUES (_kind, _target, lower(trim(_email)), _l) ON CONFLICT DO NOTHING;
  END IF;
END $function$;

CREATE OR REPLACE FUNCTION public.get_public_location(_slug text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE l locations;
BEGIN
  SELECT * INTO l FROM locations WHERE slug = lower(_slug);
  IF l.id IS NULL THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('id', l.id, 'slug', l.slug, 'mode', l.mode, 'name', l.name, 'address', l.address, 'lat', l.lat, 'lng', l.lng,
    'host_id', l.host_id, 'photo_count', cardinality(l.photos), 'booking_url', CASE WHEN l.mode='linked' THEN l.booking_url END,
    'store_url', CASE WHEN l.mode='simple' THEN l.store_url END, 'opening_notes', CASE WHEN l.mode='simple' THEN l.opening_notes ELSE '' END,
    'schedule', CASE WHEN l.mode='simple' THEN l.schedule ELSE '[]'::jsonb END, 'capacity', CASE WHEN l.mode='simple' THEN l.capacity END,
    'dropin_cents', CASE WHEN l.mode='simple' THEN l.dropin_cents END,
    'coaches', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'name', p.full_name, 'slug', p.slug, 'avatar_url', p.avatar_url)), '[]'::jsonb) FROM profiles p
       WHERE p.id = l.host_id OR p.id IN (SELECT e.host_id FROM events e WHERE e.location_id = l.id AND e.starts_at > now() AND e.status = 'published')),
    'followers', (SELECT count(*) FROM follows WHERE target_kind = 'location' AND target_id = l.id),
    'following', auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM follows WHERE target_kind = 'location' AND target_id = l.id AND follower_id = auth.uid()),
    'upcoming', (SELECT coalesce(jsonb_agg(x ORDER BY x->>'starts_at'), '[]'::jsonb) FROM (
       SELECT jsonb_build_object('id', e.id, 'title', e.title, 'starts_at', e.starts_at, 'timezone', e.timezone, 'location_name', e.location_name, 'online', e.online_url IS NOT NULL,
         'cover_style', e.cover_style, 'capacity', e.capacity, 'members_only', e.early_offer_id IS NOT NULL AND coalesce(e.public_rsvp_at, now()) > now(), 'price_cents', e.price_cents) x
       FROM events e WHERE e.location_id = l.id AND e.starts_at > now() AND e.status = 'published' AND e.visibility = 'public' ORDER BY e.starts_at LIMIT 12) s));
END $$;
REVOKE ALL ON FUNCTION public.get_public_location(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_location(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.list_public_locations()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', l.id, 'slug', l.slug, 'mode', l.mode, 'name', l.name, 'address', l.address, 'lat', l.lat, 'lng', l.lng,
    'host_name', p.full_name, 'upcoming', (SELECT count(*) FROM events e WHERE e.location_id = l.id AND e.starts_at > now() AND e.status='published' AND e.visibility='public')) ORDER BY l.created_at DESC), '[]'::jsonb)
  FROM locations l LEFT JOIN profiles p ON p.id = l.host_id;
$$;
REVOKE ALL ON FUNCTION public.list_public_locations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_public_locations() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.set_event_location(_event uuid, _location uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT can_manage_event(_event) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  IF _location IS NOT NULL AND NOT EXISTS (SELECT 1 FROM locations WHERE id = _location AND host_id = auth.uid()) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  UPDATE events SET location_id = _location WHERE id = _event;
END $$;
REVOKE ALL ON FUNCTION public.set_event_location(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_event_location(uuid, uuid) TO authenticated;