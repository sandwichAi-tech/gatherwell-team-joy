ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cover_url text;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS cover_url text;
ALTER TABLE public.profiles ADD CONSTRAINT profile_cover_owner CHECK (cover_url IS NULL OR cover_url LIKE id::text || '/cover-%');
ALTER TABLE public.offers ADD CONSTRAINT offer_cover_owner CHECK (cover_url IS NULL OR cover_url LIKE host_id::text || '/cover-%');
CREATE OR REPLACE FUNCTION public.get_public_host(_slug text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE p profiles;
BEGIN
 SELECT * INTO p FROM profiles WHERE slug = lower(_slug);
 IF p.id IS NULL THEN RETURN NULL; END IF;
 RETURN jsonb_build_object('id', p.id, 'name', p.full_name, 'avatar_url', p.avatar_url, 'cover_url', p.cover_url, 'city', p.city, 'bio', p.bio, 'shop_url', p.shop_url,
 'followers', (SELECT count(*) FROM follows WHERE target_kind = 'host' AND target_id = p.id),
 'following', auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM follows WHERE target_kind = 'host' AND target_id = p.id AND follower_id = auth.uid()),
 'upcoming', public.public_upcoming(p.id, NULL));
END $$;
GRANT EXECUTE ON FUNCTION public.get_public_host(text) TO anon, authenticated;