ALTER TABLE public.tracks ADD COLUMN placement text, ADD COLUMN commerce_offer_id uuid REFERENCES public.offers(id);
ALTER TABLE public.recipes ADD COLUMN placement text, ADD COLUMN commerce_offer_id uuid REFERENCES public.offers(id), ADD COLUMN parent_course_id uuid REFERENCES public.offers(id);
ALTER TABLE public.quizzes ADD COLUMN placement text, ADD COLUMN commerce_offer_id uuid REFERENCES public.offers(id);
ALTER TABLE public.offers ADD COLUMN placement text, ADD COLUMN parent_course_id uuid REFERENCES public.offers(id), ADD COLUMN resource_type text;
ALTER TABLE public.tracks ADD CONSTRAINT track_placement CHECK (placement IS NULL OR placement IN ('team','course','coach'));
ALTER TABLE public.recipes ADD CONSTRAINT recipe_placement CHECK (placement IS NULL OR placement IN ('team','course','coach'));
ALTER TABLE public.quizzes ADD CONSTRAINT quiz_placement CHECK (placement IS NULL OR placement IN ('team','course','coach'));
ALTER TABLE public.offers ADD CONSTRAINT offer_placement CHECK (placement IS NULL OR placement IN ('team','course','coach'));
CREATE OR REPLACE FUNCTION public.resource_commerce_access(_offer uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM offers o WHERE o.id=_offer AND (o.host_id=auth.uid() OR (resource_is_live(o.available_from) AND (o.price_cents=0 OR EXISTS(SELECT 1 FROM offer_purchases p WHERE p.offer_id=o.id AND p.user_id=auth.uid() AND (p.paused_until IS NULL OR p.paused_until<=now()) AND (p.status='paid' OR (p.status IN ('active','past_due') AND (p.renews_at IS NULL OR p.renews_at>now()-interval '3 days')))) OR EXISTS(SELECT 1 FROM entitlements e WHERE e.offer_id=o.id AND e.user_id=auth.uid() AND e.revoked_at IS NULL AND e.starts_at<=now() AND (e.ends_at IS NULL OR e.ends_at>now()))))));
$$;
CREATE OR REPLACE FUNCTION public.can_read_track(_track uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM tracks t WHERE t.id=_track AND (can_edit_track(t.id) OR (t.is_published AND resource_is_live(t.available_from) AND (t.commerce_offer_id IS NULL OR resource_commerce_access(t.commerce_offer_id)) AND CASE WHEN t.offer_id IS NOT NULL THEN can_access_offer(t.offer_id) ELSE can_use_team_templates(t.team_id) OR t.visibility IN ('public','unlisted') END)));
$$;
CREATE POLICY "Resource payment gate tracks" ON public.tracks AS RESTRICTIVE FOR SELECT TO authenticated USING (can_edit_track(id) OR (commerce_offer_id IS NULL OR resource_commerce_access(commerce_offer_id)));
CREATE POLICY "Resource payment gate lessons" ON public.lessons AS RESTRICTIVE FOR SELECT TO authenticated USING (can_edit_track(track_id) OR can_read_track(track_id));
CREATE POLICY "Resource payment gate recipes" ON public.recipes AS RESTRICTIVE FOR SELECT TO authenticated USING (created_by=auth.uid() OR is_team_member(team_id,ARRAY['leader']) OR (is_published AND resource_is_live(available_from) AND (commerce_offer_id IS NULL OR resource_commerce_access(commerce_offer_id)) AND (parent_course_id IS NULL OR can_access_offer(parent_course_id))));
CREATE POLICY "Resource owners read tracks" ON public.tracks FOR SELECT TO authenticated USING (can_edit_track(id));
CREATE POLICY "Resource owners read recipes" ON public.recipes FOR SELECT TO authenticated USING (created_by=auth.uid());
CREATE POLICY "Public coach recipes signed in" ON public.recipes FOR SELECT TO authenticated USING (placement='coach' AND is_published);
CREATE OR REPLACE FUNCTION public.configure_resource_access(_kind text,_id uuid,_placement text,_course uuid,_price integer) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r record; o uuid; owner uuid; team uuid; en text; es text; pub boolean; sty smallint; ty text;
BEGIN
 IF auth.uid() IS NULL OR _placement IS NULL OR _price IS NULL OR _placement NOT IN ('team','course','coach') OR _price<0 OR _price>100000 OR (_price>0 AND _price<50) THEN RAISE EXCEPTION 'invalid_resource_access'; END IF;
 IF _kind='track' THEN SELECT * INTO r FROM tracks WHERE id=_id FOR UPDATE; IF NOT FOUND OR NOT can_edit_track(_id) THEN RAISE EXCEPTION 'not_allowed'; END IF; owner:=coalesce(r.host_id,auth.uid()); team:=r.team_id; en:=r.title_en; es:=r.title_es; pub:=r.is_published; o:=r.commerce_offer_id; sty:=r.cover_style; ty:=CASE r.resource_kind WHEN 'pdf' THEN 'guide' ELSE coalesce(r.resource_kind,'video') END;
 ELSIF _kind='recipe' THEN SELECT * INTO r FROM recipes WHERE id=_id FOR UPDATE; IF NOT FOUND OR NOT (r.created_by=auth.uid() OR is_team_member(r.team_id,ARRAY['leader'])) THEN RAISE EXCEPTION 'not_allowed'; END IF; owner:=r.created_by; team:=r.team_id; en:=r.title_en; es:=r.title_es; pub:=r.is_published; o:=r.commerce_offer_id; sty:=r.cover_style; ty:='recipe';
 ELSIF _kind='quiz' THEN SELECT * INTO r FROM quizzes WHERE id=_id FOR UPDATE; IF NOT FOUND OR NOT can_edit_quiz(_id) THEN RAISE EXCEPTION 'not_allowed'; END IF; owner:=r.host_id; team:=r.team_id; IF team IS NULL THEN SELECT team_id INTO team FROM offers WHERE id=r.offer_id; END IF; en:=r.title_en; es:=r.title_es; pub:=r.is_published; o:=r.commerce_offer_id; sty:=0; ty:='quiz'; IF r.offer_id IS NOT NULL AND (_placement<>'course' OR _course IS DISTINCT FROM r.offer_id) THEN RAISE EXCEPTION 'course_quiz_locked'; END IF;
 ELSIF _kind='offer' THEN SELECT * INTO r FROM offers WHERE id=_id FOR UPDATE; IF NOT FOUND OR r.host_id<>auth.uid() THEN RAISE EXCEPTION 'not_allowed'; END IF; owner:=r.host_id; team:=r.team_id; en:=r.title_en; es:=r.title_es; pub:=r.status='published'; o:=r.id; sty:=r.cover_style; ty:=coalesce(r.resource_type,CASE r.kind WHEN 'course' THEN 'course' ELSE 'file' END);
 ELSE RAISE EXCEPTION 'invalid_kind'; END IF;
 IF _placement='course' THEN
  IF _course IS NULL OR NOT EXISTS(SELECT 1 FROM offers WHERE id=_course AND kind='course' AND host_id=auth.uid() AND team_id=team AND status<>'archived') THEN RAISE EXCEPTION 'invalid_course'; END IF;
  IF _kind='offer' THEN IF r.kind='course' OR _id=_course THEN RAISE EXCEPTION 'invalid_course'; END IF; END IF;
  _price:=0;
 ELSE _course:=NULL; END IF;
 IF o IS NULL AND _placement<>'course' THEN
  INSERT INTO offers(host_id,team_id,kind,title_en,title_es,price_cents,status,visibility,placement,resource_type,cover_style,includes_en,includes_es)
   VALUES(owner,team,'download',en,es,_price,CASE WHEN pub THEN 'published' ELSE 'draft' END,CASE WHEN _placement='coach' THEN 'public' ELSE 'team' END,_placement,ty,sty,'[]','[]') RETURNING id INTO o;
 ELSIF o IS NOT NULL THEN
  UPDATE offers SET title_en=en,title_es=es,price_cents=_price,placement=_placement,parent_course_id=_course,visibility=CASE WHEN _placement='coach' THEN 'public' ELSE 'team' END,billing_interval=CASE WHEN kind='download' THEN NULL ELSE billing_interval END,status=CASE WHEN pub THEN 'published' ELSE 'draft' END WHERE id=o;
 END IF;
 IF _kind='track' THEN UPDATE tracks SET placement=_placement,offer_id=_course,commerce_offer_id=o,visibility=CASE WHEN _placement='coach' THEN 'public' ELSE 'team' END,host_id=owner WHERE id=_id;
 ELSIF _kind='recipe' THEN UPDATE recipes SET placement=_placement,parent_course_id=_course,commerce_offer_id=o WHERE id=_id;
 ELSIF _kind='quiz' THEN UPDATE quizzes SET placement=_placement,commerce_offer_id=o WHERE id=_id; END IF;
 RETURN o;
END $$;
REVOKE ALL ON FUNCTION public.configure_resource_access(text,uuid,text,uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.configure_resource_access(text,uuid,text,uuid,integer) TO authenticated;
CREATE OR REPLACE FUNCTION public.resource_access_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o offers; team uuid; owner uuid; pub boolean; parent uuid;
BEGIN
 IF TG_TABLE_NAME='tracks' THEN team:=NEW.team_id; owner:=NEW.host_id; pub:=NEW.is_published; parent:=NEW.offer_id;
 ELSIF TG_TABLE_NAME='recipes' THEN team:=NEW.team_id; owner:=NEW.created_by; pub:=NEW.is_published; parent:=NEW.parent_course_id;
 ELSE team:=NEW.team_id; owner:=NEW.host_id; pub:=NEW.is_published; parent:=NEW.offer_id; END IF;
 IF NEW.commerce_offer_id IS NOT NULL THEN
  SELECT * INTO o FROM offers WHERE id=NEW.commerce_offer_id;
  IF o.id IS NULL OR o.host_id IS DISTINCT FROM owner OR (team IS NOT NULL AND o.team_id IS DISTINCT FROM team) THEN RAISE EXCEPTION 'invalid_commerce_binding'; END IF;
  IF pub AND o.price_cents>0 AND NOT payouts_live(o.host_id) THEN RAISE EXCEPTION 'payouts_required'; END IF;
  IF TG_OP='UPDATE' AND NEW.commerce_offer_id IS DISTINCT FROM OLD.commerce_offer_id AND coalesce(auth.jwt()->>'role','')<>'service_role' AND o.host_id<>auth.uid() THEN RAISE EXCEPTION 'not_allowed'; END IF;
  UPDATE offers SET status=CASE WHEN pub THEN 'published' ELSE 'draft' END,title_en=NEW.title_en,title_es=NEW.title_es,visibility=CASE WHEN NEW.placement='coach' THEN 'public' ELSE 'team' END WHERE id=o.id;
 END IF;
 IF NEW.placement='course' AND (parent IS NULL OR NOT EXISTS(SELECT 1 FROM offers WHERE id=parent AND kind='course' AND host_id=owner)) THEN RAISE EXCEPTION 'invalid_course'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER resource_access_guard BEFORE INSERT OR UPDATE ON public.tracks FOR EACH ROW EXECUTE FUNCTION public.resource_access_guard();
CREATE TRIGGER resource_access_guard BEFORE INSERT OR UPDATE ON public.recipes FOR EACH ROW EXECUTE FUNCTION public.resource_access_guard();
CREATE TRIGGER resource_access_guard BEFORE INSERT OR UPDATE ON public.quizzes FOR EACH ROW EXECUTE FUNCTION public.resource_access_guard();
CREATE OR REPLACE FUNCTION public.get_resource_page(_kind text,_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE r record; owner uuid; pub boolean; placement text; parent uuid; commerce uuid; payload jsonb; price integer:=0; allowed boolean; team uuid;
BEGIN
 IF _kind='track' THEN SELECT * INTO r FROM tracks WHERE id=_id; IF NOT FOUND THEN RETURN NULL; END IF; owner:=r.host_id; pub:=r.is_published; placement:=coalesce(r.placement,CASE WHEN r.offer_id IS NOT NULL THEN 'course' WHEN r.visibility='public' THEN 'coach' ELSE 'team' END); parent:=r.offer_id; commerce:=r.commerce_offer_id; team:=r.team_id;
 ELSIF _kind='recipe' THEN SELECT * INTO r FROM recipes WHERE id=_id; IF NOT FOUND THEN RETURN NULL; END IF; owner:=r.created_by; pub:=r.is_published; placement:=coalesce(r.placement,'team'); parent:=r.parent_course_id; commerce:=r.commerce_offer_id; team:=r.team_id;
 ELSIF _kind='quiz' THEN SELECT * INTO r FROM quizzes WHERE id=_id; IF NOT FOUND THEN RETURN NULL; END IF; owner:=r.host_id; pub:=r.is_published; placement:=coalesce(r.placement,CASE WHEN r.offer_id IS NOT NULL THEN 'course' ELSE 'team' END); parent:=r.offer_id; commerce:=r.commerce_offer_id; team:=r.team_id;
 ELSIF _kind='offer' THEN SELECT * INTO r FROM offers WHERE id=_id; IF NOT FOUND THEN RETURN NULL; END IF; owner:=r.host_id; pub:=r.status='published'; placement:=coalesce(r.placement,CASE WHEN r.visibility='public' THEN 'coach' ELSE 'team' END); parent:=r.parent_course_id; commerce:=r.id; team:=r.team_id;
 ELSE RETURN NULL; END IF;
 IF owner IS DISTINCT FROM auth.uid() AND (NOT pub OR (placement='coach' AND NOT EXISTS(SELECT 1 FROM profiles WHERE id=owner AND host_public)) OR (placement<>'coach' AND NOT can_use_team_templates(team) AND NOT (parent IS NOT NULL AND can_access_offer(parent)))) THEN RETURN NULL; END IF;
 IF commerce IS NOT NULL THEN SELECT price_cents INTO price FROM offers WHERE id=commerce; END IF;
 allowed:=pub AND (commerce IS NULL OR resource_commerce_access(commerce)) AND (parent IS NULL OR can_access_offer(parent));
 IF _kind IN ('track','recipe') THEN allowed:=allowed AND resource_is_live(r.available_from); END IF;
 IF owner=auth.uid() THEN allowed:=true; END IF;
 payload:=jsonb_build_object('id',_id,'entity',_kind,'title_en',r.title_en,'title_es',r.title_es,'host_id',owner,'host_name',(SELECT full_name FROM profiles WHERE id=owner),'placement',placement,'price_cents',coalesce(price,0),'offer_id',commerce,'parent_course_id',parent,'access',allowed,'published',pub);
 IF _kind='track' THEN payload:=payload||jsonb_build_object('type',coalesce(r.resource_kind,'video'),'cover_path',r.cover_url,'cover_style',r.cover_style,'content',CASE WHEN allowed THEN (SELECT coalesce(jsonb_agg(jsonb_build_object('id',l.id,'type',l.type,'title_en',l.title_en,'title_es',l.title_es,'url',l.url,'storage_path',l.storage_path,'replay_url',l.replay_url,'description_en',l.description_en,'description_es',l.description_es) ORDER BY l.sort_order),'[]') FROM lessons l WHERE l.track_id=_id AND l.is_published AND lesson_is_unlocked(l.id)) ELSE '[]'::jsonb END);
 ELSIF _kind='recipe' THEN payload:=payload||jsonb_build_object('type','recipe','cover_path',r.cover_url,'cover_style',r.cover_style,'ingredients',CASE WHEN allowed THEN r.ingredients ELSE NULL END,'steps',CASE WHEN allowed THEN r.steps ELSE NULL END);
 ELSIF _kind='quiz' THEN payload:=payload||jsonb_build_object('type','quiz','cover_path',r.cover_path,'cover_style',0);
 ELSE payload:=payload||jsonb_build_object('type',coalesce(r.resource_type,r.kind),'cover_path',r.cover_url,'cover_style',r.cover_style,'file_path',CASE WHEN allowed THEN r.file_path ELSE NULL END); END IF;
 RETURN payload;
END $$;
REVOKE ALL ON FUNCTION public.get_resource_page(text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_resource_page(text,uuid) TO anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.coach_resource_cards(_host uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'entity',entity,'kind',kind,'title_en',title_en,'title_es',title_es,'price_cents',price,'cover_style',style,'card_layout','preview','accent','plum') ORDER BY created_at DESC),'[]') FROM (
 SELECT t.id,'track'::text entity,CASE t.resource_kind WHEN 'pdf' THEN 'guide' ELSE coalesce(t.resource_kind,'video') END kind,t.title_en,t.title_es,coalesce(o.price_cents,0) price,t.cover_style style,t.created_at FROM tracks t LEFT JOIN offers o ON o.id=t.commerce_offer_id WHERE t.host_id=_host AND t.is_published AND t.offer_id IS NULL AND coalesce(t.placement,CASE WHEN t.visibility='public' THEN 'coach' ELSE 'team' END)='coach'
 UNION ALL SELECT r.id,'recipe','recipe',r.title_en,r.title_es,coalesce(o.price_cents,0),r.cover_style,r.created_at FROM recipes r LEFT JOIN offers o ON o.id=r.commerce_offer_id WHERE r.created_by=_host AND r.is_published AND r.placement='coach' AND r.parent_course_id IS NULL
 UNION ALL SELECT q.id,'quiz','quiz',q.title_en,q.title_es,coalesce(o.price_cents,0),0,q.created_at FROM quizzes q LEFT JOIN offers o ON o.id=q.commerce_offer_id WHERE q.host_id=_host AND q.is_published AND q.placement='coach' AND q.offer_id IS NULL
 UNION ALL SELECT o.id,'offer',coalesce(o.resource_type,o.kind),o.title_en,o.title_es,o.price_cents,o.cover_style,o.created_at FROM offers o WHERE o.host_id=_host AND o.status='published' AND o.visibility='public' AND o.parent_course_id IS NULL AND coalesce(o.placement,'coach')='coach' AND NOT EXISTS(SELECT 1 FROM tracks WHERE commerce_offer_id=o.id) AND NOT EXISTS(SELECT 1 FROM recipes WHERE commerce_offer_id=o.id) AND NOT EXISTS(SELECT 1 FROM quizzes WHERE commerce_offer_id=o.id)
 ) x WHERE EXISTS(SELECT 1 FROM profiles WHERE id=_host AND host_public);
$$;
REVOKE ALL ON FUNCTION public.coach_resource_cards(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.coach_resource_cards(uuid) TO anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.my_resource_coaches() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',p.id,'slug',p.slug,'name',p.full_name,'resources',coach_resource_cards(p.id))),'[]') FROM profiles p WHERE auth.uid() IS NOT NULL AND p.host_public AND p.slug IS NOT NULL AND (EXISTS(SELECT 1 FROM follows f WHERE f.target_kind='host' AND f.target_id=p.id AND f.follower_id=auth.uid()) OR EXISTS(SELECT 1 FROM offer_purchases b JOIN offers o ON o.id=b.offer_id WHERE o.host_id=p.id AND b.user_id=auth.uid()) OR EXISTS(SELECT 1 FROM rsvps r JOIN events e ON e.id=r.event_id WHERE e.host_id=p.id AND r.user_id=auth.uid() AND r.status='going'));
$$;
REVOKE ALL ON FUNCTION public.my_resource_coaches() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.my_resource_coaches() TO authenticated;
CREATE OR REPLACE FUNCTION public.get_public_host(_slug text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE p profiles;
BEGIN
 SELECT * INTO p FROM profiles WHERE slug=lower(_slug);
 IF p.id IS NULL THEN SELECT pr.* INTO p FROM profile_slug_history h JOIN profiles pr ON pr.id=h.profile_id WHERE h.slug=lower(_slug); END IF;
 IF p.id IS NULL OR NOT p.host_public THEN RETURN NULL; END IF;
 RETURN jsonb_build_object('id',p.id,'slug',p.slug,'name',p.full_name,'org',p.host_org,'avatar_url',p.avatar_url,'cover_url',p.cover_url,'city',CASE WHEN p.city_public THEN p.city ELSE NULL END,'bio',p.bio,'shop_url',p.shop_url,'categories',coalesce(p.host_categories,'{}'),'languages',coalesce(p.host_languages,'{}'),'accessibility',p.host_accessibility,'links',coalesce(p.host_links,'[]'::jsonb),'followers',(SELECT count(*) FROM follows WHERE target_kind='host' AND target_id=p.id),'following',auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM follows WHERE target_kind='host' AND target_id=p.id AND follower_id=auth.uid()),'upcoming',public_upcoming(p.id,NULL),'offerings',coach_resource_cards(p.id));
END $$;
CREATE OR REPLACE FUNCTION public.quiz_access_error(_quiz uuid) RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE z quizzes; o offers; l lessons;
BEGIN
 IF auth.uid() IS NULL THEN RETURN 'not_found'; END IF;
 SELECT * INTO z FROM quizzes WHERE id=_quiz AND is_published;
 IF NOT FOUND THEN RETURN 'not_found'; END IF;
 IF z.offer_id IS NULL THEN
  IF z.host_id=auth.uid() THEN RETURN NULL; END IF;
  IF z.commerce_offer_id IS NOT NULL AND NOT resource_commerce_access(z.commerce_offer_id) THEN RETURN 'no_access'; END IF;
  IF z.placement='coach' THEN RETURN NULL; END IF;
  IF NOT is_team_member(z.team_id,ARRAY['leader','host','member']) THEN RETURN 'not_found'; END IF; RETURN NULL;
 END IF;
 SELECT * INTO o FROM offers WHERE id=z.offer_id;
 IF o.status<>'published' AND o.host_id<>auth.uid() THEN RETURN 'not_found'; END IF;
 IF o.host_id<>auth.uid() AND NOT can_access_offer(o.id) THEN RETURN 'no_access'; END IF;
 IF z.lesson_id IS NOT NULL THEN
  SELECT * INTO l FROM lessons WHERE id=z.lesson_id;
  IF l IS NULL OR NOT l.is_published THEN RETURN 'not_found'; END IF;
  IF NOT lesson_is_unlocked(l.id) THEN RETURN 'locked'; END IF;
  IF l.prerequisite_lesson_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM lesson_progress WHERE lesson_id=l.prerequisite_lesson_id AND user_id=auth.uid() AND completed_at IS NOT NULL) THEN RETURN 'prerequisite'; END IF;
 ELSIF o.host_id<>auth.uid() AND EXISTS(SELECT 1 FROM lessons l2 JOIN tracks t ON t.id=l2.track_id WHERE t.offer_id=z.offer_id AND t.is_published AND l2.is_published AND NOT EXISTS(SELECT 1 FROM lesson_progress lp WHERE lp.lesson_id=l2.id AND lp.user_id=auth.uid() AND lp.completed_at IS NOT NULL)) THEN RETURN 'prerequisite'; END IF;
 RETURN NULL;
END $$;