ALTER TABLE public.tracks
  ADD COLUMN visibility text NOT NULL DEFAULT 'team',
  ADD COLUMN host_id uuid,
  ADD COLUMN resource_kind text;

ALTER TABLE public.tracks ADD CONSTRAINT tracks_visibility_check CHECK (visibility IN ('team','public','unlisted'));
ALTER TABLE public.tracks ADD CONSTRAINT tracks_resource_kind_check CHECK (resource_kind IS NULL OR resource_kind IN ('video','audio','link','live','text','pdf','file'));

COMMENT ON COLUMN public.tracks.visibility IS 'team = members only; public = listed on the coach public page; unlisted = anyone signed in with the link';
COMMENT ON COLUMN public.tracks.host_id IS 'Owning host for public attribution; NULL keeps the track team-only';
COMMENT ON COLUMN public.tracks.resource_kind IS 'Resource builder type for standalone tracks (video/audio/link/live); NULL for course curricula';

CREATE POLICY "Public read published public tracks"
ON public.tracks FOR SELECT TO authenticated
USING (visibility IN ('public','unlisted') AND is_published);

CREATE POLICY "Public read lessons of public tracks"
ON public.lessons FOR SELECT TO authenticated
USING (is_published AND EXISTS (
  SELECT 1 FROM public.tracks t
  WHERE t.id = lessons.track_id AND t.visibility IN ('public','unlisted') AND t.is_published
));

CREATE OR REPLACE FUNCTION public.get_public_host(_slug text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      SELECT coalesce(jsonb_agg(x.card ORDER BY x.created_at DESC), '[]'::jsonb) FROM (
        SELECT o.created_at, jsonb_build_object(
          'entity', 'offer', 'kind', o.kind, 'id', o.id, 'title', o.title_en, 'title_es', o.title_es,
          'summary', o.summary_en, 'summary_es', o.summary_es,
          'subtitle_en', o.subtitle_en, 'subtitle_es', o.subtitle_es,
          'cta_en', o.cta_en, 'cta_es', o.cta_es,
          'card_layout', o.card_layout, 'accent', o.accent,
          'cover_url', o.cover_url, 'cover_style', o.cover_style,
          'price_cents', o.price_cents
        ) AS card
        FROM (SELECT * FROM offers WHERE host_id = p.id AND status = 'published' AND visibility = 'public' ORDER BY created_at DESC LIMIT 20) o
        UNION ALL
        SELECT tr.created_at, jsonb_build_object(
          'entity', 'track', 'kind', coalesce(tr.resource_kind, 'video'), 'id', tr.id,
          'title', tr.title_en, 'title_es', tr.title_es,
          'summary', tr.description_en, 'summary_es', tr.description_es,
          'subtitle_en', tr.subtitle_en, 'subtitle_es', tr.subtitle_es,
          'cta_en', tr.cta_en, 'cta_es', tr.cta_es,
          'card_layout', tr.card_layout, 'accent', tr.accent,
          'cover_url', tr.cover_url, 'cover_style', tr.cover_style,
          'price_cents', 0
        ) AS card
        FROM (SELECT * FROM tracks WHERE host_id = p.id AND offer_id IS NULL AND is_published AND visibility = 'public' ORDER BY created_at DESC LIMIT 20) tr
      ) x
    )
  );
END $function$;