
-- Custom public-profile slugs: durable alias history + authoritative server-side setter.
-- Old slugs stay reserved forever (per profile) so published links never silently break or get reassigned.

CREATE TABLE public.profile_slug_history (
  slug text PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.profile_slug_history TO service_role;
ALTER TABLE public.profile_slug_history ENABLE ROW LEVEL SECURITY;
-- No policies: table is only read/written by security-definer RPCs (audit + redirect resolution).

-- Accent-insensitive normalization shared by the setter and resolver.
CREATE OR REPLACE FUNCTION public.normalize_profile_slug(_raw text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE _s text;
BEGIN
  _s := lower(translate(coalesce(_raw, ''), 'áéíóúñüÁÉÍÓÚÑÜ', 'aeiounuAEIOUNU'));
  _s := regexp_replace(_s, '[^a-z0-9]+', '-', 'g');
  _s := trim(both '-' from _s);
  RETURN left(_s, 40);
END $$;

-- Reserved route prefixes and platform words that a profile slug may never claim.
CREATE OR REPLACE FUNCTION public.reserved_profile_slugs()
RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT ARRAY[
    'h','t','e','o','l','i','r','s',
    'admin','admin-login','api','app','auth','login','join','me','onboarding',
    'discover','pricing','hosts','studios','events','event','offers','offer',
    'learn','resources','support','settings','terms','privacy','legal','credits',
    'verify','unsubscribe','sitemap','robots','favicon','manifest','push-sw',
    'www','mail','help','about','blog','shop','store','team','teams','host',
    'follow','following','tickets','ticket','notifications','messages','insights',
    'calendar','invite','invites','static','assets','zoheewell','gatherwell',
    'official','null','undefined','root','system','moderator','staff'
  ];
$$;

-- Resolve any current or historical host slug to the canonical current slug (NULL if none).
CREATE OR REPLACE FUNCTION public.resolve_host_slug(_slug text)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _s text := public.normalize_profile_slug(_slug); _cur text;
BEGIN
  SELECT slug INTO _cur FROM profiles WHERE slug = _s;
  IF _cur IS NOT NULL THEN RETURN _cur; END IF;
  SELECT p.slug INTO _cur FROM profile_slug_history h JOIN profiles p ON p.id = h.profile_id WHERE h.slug = _s;
  RETURN _cur;
END $$;
GRANT EXECUTE ON FUNCTION public.resolve_host_slug(text) TO anon, authenticated;

-- Authoritative slug change: normalize, validate, reserve-check, uniqueness across
-- profiles/teams/locations and every other profile's history, rate-limited, audited via history.
CREATE OR REPLACE FUNCTION public.set_profile_slug(_slug text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _me uuid := auth.uid(); _new text; _old text;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  _new := public.normalize_profile_slug(_slug);
  IF _new !~ '^[a-z0-9][a-z0-9-]{2,39}$' THEN RAISE EXCEPTION 'invalid_slug'; END IF;
  IF _new = ANY (public.reserved_profile_slugs()) THEN RAISE EXCEPTION 'reserved_slug'; END IF;
  SELECT slug INTO _old FROM profiles WHERE id = _me FOR UPDATE;
  IF _old = _new THEN RETURN _new; END IF;
  IF (SELECT count(*) FROM profile_slug_history WHERE profile_id = _me AND created_at > now() - interval '24 hours') >= 3 THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;
  IF EXISTS (SELECT 1 FROM profiles WHERE slug = _new AND id <> _me)
     OR EXISTS (SELECT 1 FROM teams WHERE slug = _new)
     OR EXISTS (SELECT 1 FROM locations WHERE slug = _new)
     OR EXISTS (SELECT 1 FROM profile_slug_history WHERE slug = _new AND profile_id <> _me) THEN
    RAISE EXCEPTION 'slug_taken';
  END IF;
  IF _old IS NOT NULL THEN
    INSERT INTO profile_slug_history (slug, profile_id) VALUES (_old, _me) ON CONFLICT (slug) DO NOTHING;
  END IF;
  UPDATE profiles SET slug = _new WHERE id = _me;
  RETURN _new;
END $$;
GRANT EXECUTE ON FUNCTION public.set_profile_slug(text) TO authenticated;

-- Public host payload now includes the canonical slug so links and redirects stay truthful.
CREATE OR REPLACE FUNCTION public.get_public_host(_slug text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE p profiles;
BEGIN
  SELECT * INTO p FROM profiles WHERE slug = lower(_slug);
  IF p.id IS NULL THEN
    SELECT pr.* INTO p FROM profile_slug_history h JOIN profiles pr ON pr.id = h.profile_id WHERE h.slug = lower(_slug);
  END IF;
  IF p.id IS NULL OR NOT p.host_public THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'id', p.id, 'slug', p.slug, 'name', p.full_name, 'org', p.host_org,
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
