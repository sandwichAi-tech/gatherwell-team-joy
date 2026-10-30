CREATE OR REPLACE FUNCTION public.flag_on(_key text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT enabled FROM public.feature_flags WHERE key = _key), false) $$;
GRANT EXECUTE ON FUNCTION public.flag_on(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.host_publicly_listed(_host uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _host AND p.host_public)
     AND NOT EXISTS (SELECT 1 FROM public.user_suspensions s WHERE s.user_id = _host) $$;
GRANT EXECUTE ON FUNCTION public.host_publicly_listed(uuid) TO anon, authenticated;

-- Challenges: listed host only, free unless selling is on, no raw private cover path.
CREATE OR REPLACE FUNCTION public.public_host_challenges(_host uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',c.id,'title_en',c.title_en,'title_es',c.title_es,'description_en',c.description_en,'description_es',c.description_es,'starts_on',c.starts_on,'ends_on',c.ends_on,'is_paid',c.is_paid,'price_cents',coalesce(c.price_cents,0),'currency',c.currency,'cover_style',c.cover_style,
   'full', c.capacity IS NOT NULL AND (SELECT count(*) FROM challenge_members m WHERE m.challenge_id=c.id AND m.access_status='active')>=c.capacity) ORDER BY c.starts_on),'[]'::jsonb)
 FROM challenges c WHERE public.host_publicly_listed(_host) AND c.created_by=_host AND c.status='published' AND c.enrollment='public'
   AND (now() AT TIME ZONE coalesce(c.timezone,'UTC'))::date<=c.ends_on
   AND (NOT c.is_paid OR public.flag_on('feature_selling'))
   AND NOT EXISTS(SELECT 1 FROM team_suspensions s WHERE s.team_id=c.team_id);
$$;

-- Resources: launch menu = simple free resources; courses, assessments/quizzes, live, memberships and paid items follow their switches.
CREATE OR REPLACE FUNCTION public.coach_resource_cards(_host uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'entity',entity,'kind',kind,'title_en',title_en,'title_es',title_es,'price_cents',price,'cover_style',style,'card_layout','preview','accent','plum') ORDER BY created_at DESC),'[]') FROM (
 SELECT t.id,'track'::text entity,CASE t.resource_kind WHEN 'pdf' THEN 'guide' ELSE coalesce(t.resource_kind,'video') END kind,t.title_en,t.title_es,coalesce(o.price_cents,0) price,t.cover_style style,t.created_at FROM tracks t LEFT JOIN offers o ON o.id=t.commerce_offer_id WHERE t.host_id=_host AND t.is_published AND t.offer_id IS NULL AND coalesce(t.on_coach,coalesce(t.placement,CASE WHEN t.visibility='public' THEN 'coach' ELSE 'team' END)='coach')
 UNION ALL SELECT r.id,'recipe','recipe',r.title_en,r.title_es,coalesce(o.price_cents,0),r.cover_style,r.created_at FROM recipes r LEFT JOIN offers o ON o.id=r.commerce_offer_id WHERE r.created_by=_host AND r.is_published AND coalesce(r.on_coach,r.placement='coach' AND r.parent_course_id IS NULL)
 UNION ALL SELECT q.id,'quiz','quiz',q.title_en,q.title_es,coalesce(o.price_cents,0),0,q.created_at FROM quizzes q LEFT JOIN offers o ON o.id=q.commerce_offer_id WHERE q.host_id=_host AND q.is_published AND q.offer_id IS NULL AND coalesce(q.on_coach,q.placement='coach') AND public.flag_on('feature_assessment')
 UNION ALL SELECT o.id,'offer',coalesce(o.resource_type,o.kind),o.title_en,o.title_es,o.price_cents,o.cover_style,o.created_at FROM offers o WHERE o.host_id=_host AND o.status='published' AND o.visibility='public' AND o.parent_course_id IS NULL AND coalesce(o.on_coach,coalesce(o.placement,'coach')='coach') AND NOT EXISTS(SELECT 1 FROM tracks WHERE commerce_offer_id=o.id) AND NOT EXISTS(SELECT 1 FROM recipes WHERE commerce_offer_id=o.id) AND NOT EXISTS(SELECT 1 FROM quizzes WHERE commerce_offer_id=o.id)
   AND (o.kind NOT IN ('course','bundle') OR public.flag_on('feature_courses'))
   AND (o.kind NOT IN ('membership','circle') OR public.flag_on('feature_selling'))
 ) x WHERE public.host_publicly_listed(_host)
   AND (price = 0 OR public.flag_on('feature_selling'))
   AND (kind <> 'live' OR public.flag_on('feature_courses'));
$$;

-- Upcoming events: retreats and multi-event formats stay hidden while switched off.
CREATE OR REPLACE FUNCTION public.public_upcoming(_host uuid, _team uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'title', e.title, 'starts_at', e.starts_at, 'timezone', e.timezone, 'location_name', e.location_name, 'category', e.category, 'online', e.online_url IS NOT NULL, 'cover_style', e.cover_style) ORDER BY e.starts_at), '[]'::jsonb)
  FROM (SELECT * FROM events WHERE status = 'published' AND visibility = 'public' AND starts_at > now() - interval '2 hours'
    AND ((_host IS NOT NULL AND host_id = _host AND public.host_publicly_listed(_host)) OR (_team IS NOT NULL AND team_id = _team))
    AND ((retreat IS NULL AND coalesce(jsonb_array_length(CASE WHEN jsonb_typeof(experience_sessions)='array' THEN experience_sessions END),0) = 0) OR public.flag_on('feature_retreats'))
    ORDER BY starts_at LIMIT 20) e
$$;