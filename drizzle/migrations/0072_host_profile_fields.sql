
-- Host public-profile fields (all optional, host-controlled)
ALTER TABLE public.profiles
  ADD COLUMN host_org text,
  ADD COLUMN host_categories text[],
  ADD COLUMN host_accessibility text,
  ADD COLUMN host_links jsonb,
  ADD COLUMN host_public boolean NOT NULL DEFAULT true,
  ADD COLUMN city_public boolean NOT NULL DEFAULT false;

-- Privacy-safe public host payload: only approved fields, only when published
CREATE OR REPLACE FUNCTION public.get_public_host(_slug text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE p profiles;
BEGIN
  SELECT * INTO p FROM profiles WHERE slug = lower(_slug);
  IF p.id IS NULL OR NOT p.host_public THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'id', p.id, 'name', p.full_name, 'org', p.host_org,
    'avatar_url', p.avatar_url, 'cover_url', p.cover_url,
    'city', CASE WHEN p.city_public THEN p.city ELSE NULL END,
    'bio', p.bio, 'shop_url', p.shop_url,
    'categories', coalesce(p.host_categories, '{}'),
    'languages', coalesce(p.host_languages, '{}'),
    'accessibility', p.host_accessibility,
    'links', coalesce(p.host_links, '[]'::jsonb),
    'followers', (SELECT count(*) FROM follows WHERE target_kind = 'host' AND target_id = p.id),
    'following', auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM follows WHERE target_kind = 'host' AND target_id = p.id AND follower_id = auth.uid()),
    'upcoming', public.public_upcoming(p.id, NULL),
    'offerings', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('kind', o.kind, 'id', o.id, 'title', o.title_en, 'summary', o.summary_en, 'price_cents', o.price_cents) ORDER BY o.created_at DESC), '[]'::jsonb)
      FROM (SELECT * FROM offers WHERE host_id = p.id AND status = 'published' AND visibility = 'public' ORDER BY created_at DESC LIMIT 20) o
    )
  );
END $$;
GRANT EXECUTE ON FUNCTION public.get_public_host(text) TO anon, authenticated;

-- Follow validation: unpublished hosts cannot be followed
CREATE OR REPLACE FUNCTION public.follow_target(_kind text, _target uuid, _email text DEFAULT NULL::text, _lang text DEFAULT 'en'::text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _l text := CASE WHEN _lang = 'es' THEN 'es' ELSE 'en' END;
BEGIN
  IF _kind NOT IN ('host','team','location') THEN RAISE EXCEPTION 'invalid_target'; END IF;
  IF (_kind = 'host' AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = _target AND host_public))
     OR (_kind = 'team' AND NOT EXISTS (SELECT 1 FROM teams WHERE id = _target))
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
END $$;

-- Signed-in Following list: only still-public hosts/teams/locations, no follower identity exposure
CREATE OR REPLACE FUNCTION public.my_following() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  RETURN (
    SELECT coalesce(jsonb_agg(row_to_json(x)), '[]'::jsonb) FROM (
      SELECT f.target_kind AS kind, f.target_id AS id,
        coalesce(p.full_name, tm.name, l.name) AS name,
        coalesce(p.slug, tm.slug, l.slug) AS slug,
        p.avatar_url,
        (SELECT count(*) FROM follows f2 WHERE f2.target_kind = f.target_kind AND f2.target_id = f.target_id) AS followers
      FROM follows f
      LEFT JOIN profiles p ON f.target_kind = 'host' AND p.id = f.target_id AND p.host_public
      LEFT JOIN teams tm ON f.target_kind = 'team' AND tm.id = f.target_id
      LEFT JOIN locations l ON f.target_kind = 'location' AND l.id = f.target_id
      WHERE f.follower_id = auth.uid()
        AND coalesce(p.id, tm.id, l.id) IS NOT NULL
      ORDER BY f.created_at DESC
    ) x
  );
END $$;
GRANT EXECUTE ON FUNCTION public.my_following() TO authenticated;

-- Host profile editor: validates lengths, https, and social-domain allowlist server-side
CREATE OR REPLACE FUNCTION public.save_host_profile(
  _org text, _categories text[], _languages text[], _accessibility text,
  _links jsonb, _host_public boolean, _city_public boolean
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _link jsonb; _url text; _host text;
  _allowed text[] := ARRAY['instagram.com','www.instagram.com','facebook.com','www.facebook.com','youtube.com','www.youtube.com','tiktok.com','www.tiktok.com','linkedin.com','www.linkedin.com','x.com','twitter.com','www.twitter.com','linktr.ee'];
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF _org IS NOT NULL AND length(_org) > 120 THEN RAISE EXCEPTION 'too_long'; END IF;
  IF _accessibility IS NOT NULL AND length(_accessibility) > 500 THEN RAISE EXCEPTION 'too_long'; END IF;
  IF _categories IS NOT NULL AND (array_length(_categories, 1) > 8 OR EXISTS (SELECT 1 FROM unnest(_categories) c WHERE length(c) > 40)) THEN RAISE EXCEPTION 'too_long'; END IF;
  IF _languages IS NOT NULL AND EXISTS (SELECT 1 FROM unnest(_languages) l WHERE l NOT IN ('en','es')) THEN RAISE EXCEPTION 'invalid_language'; END IF;
  IF _links IS NOT NULL AND jsonb_typeof(_links) = 'array' THEN
    IF jsonb_array_length(_links) > 6 THEN RAISE EXCEPTION 'too_many_links'; END IF;
    FOR _link IN SELECT * FROM jsonb_array_elements(_links) LOOP
      _url := _link->>'url';
      IF _url IS NULL OR _url !~ '^https://' OR length(_url) > 300 THEN RAISE EXCEPTION 'invalid_link'; END IF;
      _host := lower(split_part(substring(_url from 9), '/', 1));
      IF coalesce(_link->>'kind','website') = 'social' AND NOT (_host = ANY(_allowed)) THEN RAISE EXCEPTION 'link_not_allowed'; END IF;
      IF length(coalesce(_link->>'label','')) > 40 THEN RAISE EXCEPTION 'too_long'; END IF;
    END LOOP;
  END IF;
  UPDATE profiles SET
    host_org = nullif(trim(_org), ''),
    host_categories = nullif(_categories, '{}'),
    host_languages = nullif(_languages, '{}'),
    host_accessibility = nullif(trim(_accessibility), ''),
    host_links = coalesce(_links, '[]'::jsonb),
    host_public = coalesce(_host_public, true),
    city_public = coalesce(_city_public, false)
  WHERE id = auth.uid();
END $$;
GRANT EXECUTE ON FUNCTION public.save_host_profile(text, text[], text[], text, jsonb, boolean, boolean) TO authenticated;
