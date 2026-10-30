ALTER TABLE public.challenges DROP CONSTRAINT IF EXISTS challenges_enrollment_check;
ALTER TABLE public.challenges ADD CONSTRAINT challenges_enrollment_check CHECK (enrollment = ANY (ARRAY['open','invite','public']));

CREATE OR REPLACE FUNCTION public.challenge_can_enroll(_c uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT auth.uid() IS NOT NULL AND public.is_adult() AND EXISTS(SELECT 1 FROM challenges c WHERE c.id=_c AND c.status='published' AND (now() AT TIME ZONE coalesce(c.timezone,'UTC'))::date<=c.ends_on
   AND NOT EXISTS(SELECT 1 FROM team_suspensions s WHERE s.team_id=c.team_id)
   AND (c.enrollment='public'
        OR (public.team_channel_access(c.team_id) AND (c.enrollment='open' OR EXISTS(SELECT 1 FROM challenge_invites i WHERE i.challenge_id=c.id AND i.user_id=auth.uid() AND i.revoked_at IS NULL)))));
$$;

CREATE OR REPLACE FUNCTION public.public_host_challenges(_host uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',c.id,'title_en',c.title_en,'title_es',c.title_es,'description_en',c.description_en,'description_es',c.description_es,'starts_on',c.starts_on,'ends_on',c.ends_on,'is_paid',c.is_paid,'price_cents',coalesce(c.price_cents,0),'currency',c.currency,'cover_url',c.cover_url,'cover_style',c.cover_style,
   'full', c.capacity IS NOT NULL AND (SELECT count(*) FROM challenge_members m WHERE m.challenge_id=c.id AND m.access_status='active')>=c.capacity) ORDER BY c.starts_on),'[]'::jsonb)
 FROM challenges c WHERE c.created_by=_host AND c.status='published' AND c.enrollment='public' AND (now() AT TIME ZONE coalesce(c.timezone,'UTC'))::date<=c.ends_on
   AND NOT EXISTS(SELECT 1 FROM team_suspensions s WHERE s.team_id=c.team_id);
$$;
REVOKE ALL ON FUNCTION public.public_host_challenges(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.public_host_challenges(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_public_host(_slug text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE p profiles;
BEGIN
 SELECT * INTO p FROM profiles WHERE slug=lower(_slug);
 IF p.id IS NULL THEN SELECT pr.* INTO p FROM profile_slug_history h JOIN profiles pr ON pr.id=h.profile_id WHERE h.slug=lower(_slug); END IF;
 IF p.id IS NULL OR NOT p.host_public OR EXISTS(SELECT 1 FROM public.user_suspensions s WHERE s.user_id=p.id) THEN RETURN NULL; END IF;
 RETURN jsonb_build_object('id',p.id,'slug',p.slug,'name',p.full_name,'org',p.host_org,'avatar_url',p.avatar_url,'cover_url',p.cover_url,'city',CASE WHEN p.city_public THEN p.city ELSE NULL END,'bio',p.bio,'shop_url',p.shop_url,'categories',coalesce(p.host_categories,'{}'),'languages',coalesce(p.host_languages,'{}'),'accessibility',p.host_accessibility,'links',coalesce(p.host_links,'[]'::jsonb),'followers',(SELECT count(*) FROM follows WHERE target_kind='host' AND target_id=p.id),'following',auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM follows WHERE target_kind='host' AND target_id=p.id AND follower_id=auth.uid()),'upcoming',public_upcoming(p.id,NULL),'offerings',coach_resource_cards(p.id),'challenges',public_host_challenges(p.id));
END $$;

CREATE OR REPLACE FUNCTION public.get_public_challenge(_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT jsonb_build_object('id',c.id,'title_en',c.title_en,'title_es',c.title_es,'description_en',c.description_en,'description_es',c.description_es,'starts_on',c.starts_on,'ends_on',c.ends_on,'is_paid',c.is_paid,'price_cents',coalesce(c.price_cents,0),'currency',c.currency,'enrollment',c.enrollment,
  'host_name',p.full_name,'host_slug',p.slug,
  'ended',(now() AT TIME ZONE coalesce(c.timezone,'UTC'))::date>c.ends_on,
  'full', c.capacity IS NOT NULL AND (SELECT count(*) FROM challenge_members m WHERE m.challenge_id=c.id AND m.access_status='active')>=c.capacity,
  'addons',coalesce((SELECT jsonb_agg(jsonb_build_object('id',a->>'id','name',a->>'name','description',a->>'description','description_en',a->>'description_en','description_es',a->>'description_es','price_cents',(a->>'price_cents')::int,'max_quantity',coalesce((a->>'max_quantity')::int,1),'inventory',a->'inventory','available',coalesce((a->>'available')::boolean,true))) FROM jsonb_array_elements(c.addons) a),'[]'::jsonb))
 FROM challenges c JOIN profiles p ON p.id=c.created_by WHERE c.id=_id AND c.status='published' AND c.enrollment='public' AND p.host_public AND NOT EXISTS(SELECT 1 FROM user_suspensions WHERE user_id=p.id) AND NOT EXISTS(SELECT 1 FROM team_suspensions WHERE team_id=c.team_id);
$$;

CREATE OR REPLACE FUNCTION public.is_safe_return_path(_p text) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT _p IS NOT NULL
    AND length(_p) BETWEEN 1 AND 512
    AND _p !~ '[%\\\s]'
    AND _p ~ '^/[^/]'
    AND _p !~ ':|[.][.]|[#]'
    AND _p ~ '^/(c|e|l|t|h|i|r|join|offer|event|learn|learn/track|learn/lesson|learn/recipe|learn/quiz|challenge)/[A-Za-z0-9_-]{1,80}([?][A-Za-z0-9=&_-]{0,200})?$|^/(home|discover|gathering/new|events|learn|me|start|communications)$|^/support([?][A-Za-z0-9=&_-]{0,200})?$'
$$;