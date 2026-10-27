-- Multi-destination resources: one canonical resource with independent Team / Coach page flags and course placements stored as course reference lessons.
ALTER TABLE public.tracks ADD COLUMN on_team boolean, ADD COLUMN on_coach boolean;
ALTER TABLE public.recipes ADD COLUMN on_team boolean, ADD COLUMN on_coach boolean;
ALTER TABLE public.quizzes ADD COLUMN on_team boolean, ADD COLUMN on_coach boolean;
ALTER TABLE public.offers ADD COLUMN on_team boolean, ADD COLUMN on_coach boolean;
ALTER TABLE public.lessons ADD COLUMN resource_track_id uuid REFERENCES public.tracks(id) ON DELETE RESTRICT;
COMMENT ON COLUMN public.tracks.on_team IS 'Listed in Team Resources. NULL = legacy row; derive from placement.';
COMMENT ON COLUMN public.tracks.on_coach IS 'Listed on the coach public page. NULL = legacy row; derive from placement/visibility.';
COMMENT ON COLUMN public.lessons.resource_track_id IS 'Course placement reference to a standalone track resource (never a course section).';
CREATE INDEX IF NOT EXISTS lessons_resource_track_idx ON public.lessons(resource_track_id) WHERE resource_track_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS lessons_resource_quiz_idx ON public.lessons(resource_quiz_id) WHERE resource_quiz_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS lessons_resource_offer_idx ON public.lessons(resource_offer_id) WHERE resource_offer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS lessons_resource_recipe_idx ON public.lessons(resource_recipe_id) WHERE resource_recipe_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.resource_course_included(_kind text, _id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM lessons l JOIN tracks t ON t.id=l.track_id WHERE t.offer_id IS NOT NULL AND t.is_published AND l.is_published AND l.detached_at IS NULL
  AND CASE _kind WHEN 'track' THEN l.resource_track_id=_id WHEN 'recipe' THEN l.resource_recipe_id=_id WHEN 'quiz' THEN l.resource_quiz_id=_id WHEN 'offer' THEN l.resource_offer_id=_id ELSE false END
  AND public.can_read_track(t.id) AND public.lesson_is_unlocked(l.id));
$$;
REVOKE ALL ON FUNCTION public.resource_course_included(text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.resource_course_included(text,uuid) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.can_read_track(_track uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM tracks t WHERE t.id=_track AND (can_edit_track(t.id) OR (t.is_published AND resource_is_live(t.available_from) AND (t.commerce_offer_id IS NULL OR resource_commerce_access(t.commerce_offer_id)) AND CASE WHEN t.offer_id IS NOT NULL THEN can_access_offer(t.offer_id) ELSE can_use_team_templates(t.team_id) OR t.visibility IN ('public','unlisted') OR public.resource_course_included('track',t.id) END)));
$$;

CREATE POLICY "Tracks via course placement" ON public.tracks FOR SELECT TO authenticated USING (is_published AND offer_id IS NULL AND public.resource_course_included('track',id));
CREATE POLICY "Recipes via course placement" ON public.recipes FOR SELECT TO authenticated USING (is_published AND public.resource_course_included('recipe',id));
CREATE POLICY "Coach page recipes" ON public.recipes FOR SELECT TO authenticated USING (is_published AND coalesce(on_coach,false));
CREATE POLICY "Offers via course placement" ON public.offers FOR SELECT TO authenticated USING (status='published' AND kind='download' AND public.resource_course_included('offer',id));

CREATE OR REPLACE FUNCTION public.guard_course_reference() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE owner uuid; BEGIN
 SELECT o.host_id INTO owner FROM tracks t JOIN offers o ON o.id=t.offer_id WHERE t.id=NEW.track_id;
 IF num_nonnulls(NEW.resource_quiz_id,NEW.resource_offer_id,NEW.resource_recipe_id,NEW.resource_track_id)>1 THEN RAISE EXCEPTION 'invalid_resource'; END IF;
 IF NEW.resource_quiz_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM quizzes WHERE id=NEW.resource_quiz_id AND host_id=owner) THEN RAISE EXCEPTION 'not_allowed'; END IF;
 IF NEW.resource_offer_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM offers WHERE id=NEW.resource_offer_id AND host_id=owner AND kind='download') THEN RAISE EXCEPTION 'not_allowed'; END IF;
 IF NEW.resource_recipe_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM recipes WHERE id=NEW.resource_recipe_id AND created_by=owner) THEN RAISE EXCEPTION 'not_allowed'; END IF;
 IF NEW.resource_track_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM tracks WHERE id=NEW.resource_track_id AND host_id=owner AND offer_id IS NULL AND id<>NEW.track_id) THEN RAISE EXCEPTION 'not_allowed'; END IF;
 IF NEW.detached_at IS NOT NULL AND NEW.is_published THEN RAISE EXCEPTION 'detached_item'; END IF;
 RETURN NEW; END $$;

CREATE OR REPLACE FUNCTION public.course_resource_destination(_lesson uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ DECLARE l lessons; BEGIN
 SELECT * INTO l FROM lessons WHERE id=_lesson AND is_published AND detached_at IS NULL;
 IF NOT FOUND OR NOT can_read_track(l.track_id) OR NOT lesson_is_unlocked(l.id) THEN RETURN NULL; END IF;
 IF l.resource_quiz_id IS NOT NULL AND quiz_access_error(l.resource_quiz_id) IS NULL THEN RETURN jsonb_build_object('kind','quiz','id',l.resource_quiz_id); END IF;
 IF l.resource_offer_id IS NOT NULL AND can_access_offer(l.resource_offer_id) THEN RETURN jsonb_build_object('kind','offer','id',l.resource_offer_id); END IF;
 IF l.resource_track_id IS NOT NULL AND can_read_track(l.resource_track_id) THEN RETURN jsonb_build_object('kind','track','id',l.resource_track_id); END IF;
 IF l.resource_recipe_id IS NOT NULL AND EXISTS(SELECT 1 FROM recipes r WHERE r.id=l.resource_recipe_id AND r.is_published AND r.created_by=(SELECT o.host_id FROM tracks t JOIN offers o ON o.id=t.offer_id WHERE t.id=l.track_id) AND (r.commerce_offer_id IS NULL OR resource_commerce_access(r.commerce_offer_id))) THEN RETURN jsonb_build_object('kind','recipe','id',l.resource_recipe_id); END IF;
 RETURN NULL; END $$;

CREATE OR REPLACE FUNCTION public.quiz_access_error(_quiz uuid) RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE z quizzes; o offers; l lessons;
BEGIN
 IF auth.uid() IS NULL THEN RETURN 'not_found'; END IF;
 SELECT * INTO z FROM quizzes WHERE id=_quiz AND is_published;
 IF NOT FOUND THEN RETURN 'not_found'; END IF;
 IF z.offer_id IS NULL THEN
  IF z.host_id=auth.uid() THEN RETURN NULL; END IF;
  IF z.commerce_offer_id IS NOT NULL AND NOT resource_commerce_access(z.commerce_offer_id) THEN RETURN 'no_access'; END IF;
  IF coalesce(z.on_coach,z.placement='coach') OR public.resource_course_included('quiz',z.id) THEN RETURN NULL; END IF;
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
  UPDATE offers SET status=CASE WHEN pub THEN 'published' ELSE 'draft' END,title_en=NEW.title_en,title_es=NEW.title_es,visibility=CASE WHEN coalesce(NEW.on_coach,NEW.placement='coach') THEN 'public' ELSE 'team' END,on_team=NEW.on_team,on_coach=NEW.on_coach WHERE id=o.id;
 END IF;
 IF NEW.placement='course' AND (parent IS NULL OR NOT EXISTS(SELECT 1 FROM offers WHERE id=parent AND kind='course' AND host_id=owner)) THEN RAISE EXCEPTION 'invalid_course'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.coach_resource_cards(_host uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'entity',entity,'kind',kind,'title_en',title_en,'title_es',title_es,'price_cents',price,'cover_style',style,'card_layout','preview','accent','plum') ORDER BY created_at DESC),'[]') FROM (
 SELECT t.id,'track'::text entity,CASE t.resource_kind WHEN 'pdf' THEN 'guide' ELSE coalesce(t.resource_kind,'video') END kind,t.title_en,t.title_es,coalesce(o.price_cents,0) price,t.cover_style style,t.created_at FROM tracks t LEFT JOIN offers o ON o.id=t.commerce_offer_id WHERE t.host_id=_host AND t.is_published AND t.offer_id IS NULL AND coalesce(t.on_coach,coalesce(t.placement,CASE WHEN t.visibility='public' THEN 'coach' ELSE 'team' END)='coach')
 UNION ALL SELECT r.id,'recipe','recipe',r.title_en,r.title_es,coalesce(o.price_cents,0),r.cover_style,r.created_at FROM recipes r LEFT JOIN offers o ON o.id=r.commerce_offer_id WHERE r.created_by=_host AND r.is_published AND coalesce(r.on_coach,r.placement='coach' AND r.parent_course_id IS NULL)
 UNION ALL SELECT q.id,'quiz','quiz',q.title_en,q.title_es,coalesce(o.price_cents,0),0,q.created_at FROM quizzes q LEFT JOIN offers o ON o.id=q.commerce_offer_id WHERE q.host_id=_host AND q.is_published AND q.offer_id IS NULL AND coalesce(q.on_coach,q.placement='coach')
 UNION ALL SELECT o.id,'offer',coalesce(o.resource_type,o.kind),o.title_en,o.title_es,o.price_cents,o.cover_style,o.created_at FROM offers o WHERE o.host_id=_host AND o.status='published' AND o.visibility='public' AND o.parent_course_id IS NULL AND coalesce(o.on_coach,coalesce(o.placement,'coach')='coach') AND NOT EXISTS(SELECT 1 FROM tracks WHERE commerce_offer_id=o.id) AND NOT EXISTS(SELECT 1 FROM recipes WHERE commerce_offer_id=o.id) AND NOT EXISTS(SELECT 1 FROM quizzes WHERE commerce_offer_id=o.id)
 ) x WHERE EXISTS(SELECT 1 FROM profiles WHERE id=_host AND host_public);
$$;

CREATE OR REPLACE FUNCTION public.get_resource_page(_kind text,_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE r record; owner uuid; pub boolean; placement text; coach boolean; parent uuid; commerce uuid; payload jsonb; price integer:=0; allowed boolean; team uuid; via_course boolean:=false;
BEGIN
 IF _kind='track' THEN SELECT * INTO r FROM tracks WHERE id=_id; IF NOT FOUND THEN RETURN NULL; END IF; owner:=r.host_id; pub:=r.is_published; placement:=coalesce(r.placement,CASE WHEN r.offer_id IS NOT NULL THEN 'course' WHEN r.visibility='public' THEN 'coach' ELSE 'team' END); coach:=coalesce(r.on_coach,r.offer_id IS NULL AND placement='coach'); parent:=r.offer_id; commerce:=r.commerce_offer_id; team:=r.team_id;
 ELSIF _kind='recipe' THEN SELECT * INTO r FROM recipes WHERE id=_id; IF NOT FOUND THEN RETURN NULL; END IF; owner:=r.created_by; pub:=r.is_published; placement:=coalesce(r.placement,'team'); coach:=coalesce(r.on_coach,placement='coach'); parent:=r.parent_course_id; commerce:=r.commerce_offer_id; team:=r.team_id;
 ELSIF _kind='quiz' THEN SELECT * INTO r FROM quizzes WHERE id=_id; IF NOT FOUND THEN RETURN NULL; END IF; owner:=r.host_id; pub:=r.is_published; placement:=coalesce(r.placement,CASE WHEN r.offer_id IS NOT NULL THEN 'course' ELSE 'team' END); coach:=coalesce(r.on_coach,placement='coach'); parent:=r.offer_id; commerce:=r.commerce_offer_id; team:=r.team_id;
 ELSIF _kind='offer' THEN SELECT * INTO r FROM offers WHERE id=_id; IF NOT FOUND THEN RETURN NULL; END IF; owner:=r.host_id; pub:=r.status='published'; placement:=coalesce(r.placement,CASE WHEN r.visibility='public' THEN 'coach' ELSE 'team' END); coach:=coalesce(r.on_coach,placement='coach'); parent:=r.parent_course_id; commerce:=r.id; team:=r.team_id;
 ELSE RETURN NULL; END IF;
 IF auth.uid() IS NOT NULL AND owner IS DISTINCT FROM auth.uid() AND pub THEN via_course:=public.resource_course_included(_kind,_id); END IF;
 IF owner IS DISTINCT FROM auth.uid() AND (NOT pub OR NOT ((coach AND EXISTS(SELECT 1 FROM profiles WHERE id=owner AND host_public)) OR (NOT coach AND placement<>'coach' AND can_use_team_templates(team)) OR (parent IS NOT NULL AND can_access_offer(parent)) OR via_course)) THEN RETURN NULL; END IF;
 IF commerce IS NOT NULL THEN SELECT price_cents INTO price FROM offers WHERE id=commerce; END IF;
 allowed:=pub AND (commerce IS NULL OR resource_commerce_access(commerce)) AND (parent IS NULL OR can_access_offer(parent));
 IF _kind IN ('track','recipe') THEN allowed:=allowed AND resource_is_live(r.available_from); END IF;
 IF owner=auth.uid() THEN allowed:=true; END IF;
 payload:=jsonb_build_object('id',_id,'entity',_kind,'title_en',r.title_en,'title_es',r.title_es,'host_id',owner,'host_name',(SELECT full_name FROM profiles WHERE id=owner),'placement',placement,'price_cents',coalesce(price,0),'offer_id',commerce,'parent_course_id',parent,'access',allowed,'published',pub,'course_access',via_course);
 IF _kind='track' THEN payload:=payload||jsonb_build_object('type',coalesce(r.resource_kind,'video'),'cover_path',r.cover_url,'cover_style',r.cover_style,'content',CASE WHEN allowed THEN (SELECT coalesce(jsonb_agg(jsonb_build_object('id',l.id,'type',l.type,'title_en',l.title_en,'title_es',l.title_es,'url',l.url,'storage_path',l.storage_path,'replay_url',l.replay_url,'description_en',l.description_en,'description_es',l.description_es) ORDER BY l.sort_order),'[]') FROM lessons l WHERE l.track_id=_id AND l.is_published AND lesson_is_unlocked(l.id)) ELSE '[]'::jsonb END);
 ELSIF _kind='recipe' THEN payload:=payload||jsonb_build_object('type','recipe','cover_path',r.cover_url,'cover_style',r.cover_style,'ingredients',CASE WHEN allowed THEN r.ingredients ELSE NULL END,'steps',CASE WHEN allowed THEN r.steps ELSE NULL END);
 ELSIF _kind='quiz' THEN payload:=payload||jsonb_build_object('type','quiz','cover_path',r.cover_path,'cover_style',0);
 ELSE payload:=payload||jsonb_build_object('type',coalesce(r.resource_type,r.kind),'cover_path',r.cover_url,'cover_style',r.cover_style,'file_path',CASE WHEN allowed THEN r.file_path ELSE NULL END); END IF;
 RETURN payload;
END $$;

CREATE OR REPLACE FUNCTION public.resource_destinations(_kind text,_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE r record; placement text; contained uuid; locked boolean:=false; team boolean; coach boolean; courses jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RETURN NULL; END IF;
 IF _kind='track' THEN SELECT * INTO r FROM tracks WHERE id=_id; IF NOT FOUND OR NOT can_edit_track(_id) THEN RETURN NULL; END IF; contained:=r.offer_id; locked:=contained IS NOT NULL; placement:=coalesce(r.placement,CASE WHEN r.offer_id IS NOT NULL THEN 'course' WHEN r.visibility='public' THEN 'coach' ELSE 'team' END);
 ELSIF _kind='recipe' THEN SELECT * INTO r FROM recipes WHERE id=_id; IF NOT FOUND OR NOT (r.created_by=auth.uid() OR is_team_member(r.team_id,ARRAY['leader'])) THEN RETURN NULL; END IF; contained:=r.parent_course_id; placement:=coalesce(r.placement,CASE WHEN contained IS NOT NULL THEN 'course' ELSE 'team' END);
 ELSIF _kind='quiz' THEN SELECT * INTO r FROM quizzes WHERE id=_id; IF NOT FOUND OR NOT can_edit_quiz(_id) THEN RETURN NULL; END IF; contained:=r.offer_id; locked:=contained IS NOT NULL; placement:=coalesce(r.placement,CASE WHEN contained IS NOT NULL THEN 'course' ELSE 'team' END);
 ELSIF _kind='offer' THEN SELECT * INTO r FROM offers WHERE id=_id; IF NOT FOUND OR r.host_id<>auth.uid() THEN RETURN NULL; END IF; contained:=r.parent_course_id; placement:=coalesce(r.placement,CASE WHEN contained IS NOT NULL THEN 'course' WHEN r.visibility='public' THEN 'coach' ELSE 'team' END);
 ELSE RETURN NULL; END IF;
 team:=coalesce(r.on_team,placement='team' AND contained IS NULL); coach:=coalesce(r.on_coach,placement='coach' AND contained IS NULL);
 SELECT coalesce(jsonb_agg(s.x ORDER BY s.x->>'title_en'),'[]') INTO courses FROM (
  SELECT jsonb_build_object('course_id',o.id,'section_id',NULL,'locked',locked,'contained',true,'title_en',o.title_en,'title_es',o.title_es,'available',o.kind='course' AND o.host_id=auth.uid() AND o.status<>'archived') x FROM offers o WHERE o.id=contained
  UNION ALL SELECT * FROM (SELECT DISTINCT ON (t.offer_id) jsonb_build_object('course_id',o.id,'section_id',t.id,'locked',false,'contained',false,'title_en',o.title_en,'title_es',o.title_es,'available',o.host_id=auth.uid() AND o.status<>'archived') x FROM lessons l JOIN tracks t ON t.id=l.track_id JOIN offers o ON o.id=t.offer_id
   WHERE l.detached_at IS NULL AND (contained IS NULL OR o.id<>contained) AND CASE _kind WHEN 'track' THEN l.resource_track_id=_id WHEN 'recipe' THEN l.resource_recipe_id=_id WHEN 'quiz' THEN l.resource_quiz_id=_id ELSE l.resource_offer_id=_id END ORDER BY t.offer_id,l.created_at) d
 ) s;
 RETURN jsonb_build_object('team',team,'coach',coach,'locked',locked,'courses',courses);
END $$;
REVOKE ALL ON FUNCTION public.resource_destinations(text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.resource_destinations(text,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_resource_destinations(_kind text,_id uuid,_team boolean,_coach boolean,_courses jsonb,_price integer) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r record; o uuid; owner uuid; team uuid; en text; es text; pub boolean; sty smallint; ty text; contained uuid; locked boolean:=false; c jsonb; cid uuid; sec uuid; keep uuid[]:='{}'; lid uuid; ltrack uuid; newp text; standalone boolean;
BEGIN
 IF auth.uid() IS NULL OR _team IS NULL OR _coach IS NULL OR _price IS NULL OR _price<0 OR _price>100000 OR (_price>0 AND _price<50) OR jsonb_typeof(coalesce(_courses,'[]'::jsonb))<>'array' OR jsonb_array_length(coalesce(_courses,'[]'::jsonb))>20 THEN RAISE EXCEPTION 'invalid_resource_access'; END IF;
 IF _kind='track' THEN SELECT * INTO r FROM tracks WHERE id=_id FOR UPDATE; IF NOT FOUND OR NOT can_edit_track(_id) THEN RAISE EXCEPTION 'not_allowed'; END IF; owner:=coalesce(r.host_id,auth.uid()); team:=r.team_id; en:=r.title_en; es:=r.title_es; pub:=r.is_published; o:=r.commerce_offer_id; sty:=r.cover_style; ty:=CASE r.resource_kind WHEN 'pdf' THEN 'guide' ELSE coalesce(r.resource_kind,'video') END; contained:=r.offer_id; locked:=contained IS NOT NULL;
 ELSIF _kind='recipe' THEN SELECT * INTO r FROM recipes WHERE id=_id FOR UPDATE; IF NOT FOUND OR NOT (r.created_by=auth.uid() OR is_team_member(r.team_id,ARRAY['leader'])) THEN RAISE EXCEPTION 'not_allowed'; END IF; owner:=r.created_by; team:=r.team_id; en:=r.title_en; es:=r.title_es; pub:=r.is_published; o:=r.commerce_offer_id; sty:=r.cover_style; ty:='recipe'; contained:=r.parent_course_id;
 ELSIF _kind='quiz' THEN SELECT * INTO r FROM quizzes WHERE id=_id FOR UPDATE; IF NOT FOUND OR NOT can_edit_quiz(_id) THEN RAISE EXCEPTION 'not_allowed'; END IF; owner:=r.host_id; team:=r.team_id; IF team IS NULL THEN SELECT team_id INTO team FROM offers WHERE id=r.offer_id; END IF; en:=r.title_en; es:=r.title_es; pub:=r.is_published; o:=r.commerce_offer_id; sty:=0; ty:='quiz'; contained:=r.offer_id; locked:=contained IS NOT NULL;
 ELSIF _kind='offer' THEN SELECT * INTO r FROM offers WHERE id=_id FOR UPDATE; IF NOT FOUND OR r.host_id<>auth.uid() THEN RAISE EXCEPTION 'not_allowed'; END IF; owner:=r.host_id; team:=r.team_id; en:=r.title_en; es:=r.title_es; pub:=r.status='published'; o:=r.id; contained:=r.parent_course_id;
 ELSE RAISE EXCEPTION 'invalid_kind'; END IF;
 IF owner IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'not_allowed'; END IF;
 IF locked AND (_team OR _coach) THEN RAISE EXCEPTION 'course_item_locked'; END IF;
 FOR c IN SELECT * FROM jsonb_array_elements(coalesce(_courses,'[]'::jsonb)) LOOP
  BEGIN cid:=(c->>'course')::uuid; sec:=nullif(c->>'section','')::uuid; EXCEPTION WHEN others THEN RAISE EXCEPTION 'invalid_course'; END;
  IF cid IS NULL THEN RAISE EXCEPTION 'invalid_course'; END IF;
  IF cid=ANY(keep) THEN CONTINUE; END IF;
  IF NOT EXISTS(SELECT 1 FROM offers WHERE id=cid AND kind='course' AND host_id=auth.uid() AND team_id=team AND status<>'archived') THEN RAISE EXCEPTION 'invalid_course'; END IF;
  IF _kind='offer' AND (_id=cid OR r.kind<>'download') THEN RAISE EXCEPTION 'invalid_course'; END IF;
  IF locked THEN IF cid<>contained THEN RAISE EXCEPTION 'course_item_locked'; END IF; keep:=keep||cid; CONTINUE; END IF;
  IF sec IS NOT NULL AND NOT EXISTS(SELECT 1 FROM tracks WHERE id=sec AND offer_id=cid) THEN RAISE EXCEPTION 'invalid_section'; END IF;
  lid:=NULL; ltrack:=NULL;
  SELECT l.id,l.track_id INTO lid,ltrack FROM lessons l JOIN tracks t ON t.id=l.track_id WHERE t.offer_id=cid AND CASE _kind WHEN 'track' THEN l.resource_track_id=_id WHEN 'recipe' THEN l.resource_recipe_id=_id WHEN 'quiz' THEN l.resource_quiz_id=_id ELSE l.resource_offer_id=_id END ORDER BY (l.detached_at IS NULL) DESC,l.created_at LIMIT 1;
  IF sec IS NULL THEN sec:=coalesce(ltrack,(SELECT id FROM tracks WHERE offer_id=cid ORDER BY sort_order,created_at LIMIT 1)); END IF;
  IF sec IS NULL THEN RAISE EXCEPTION 'course_section_required'; END IF;
  IF lid IS NULL THEN
   INSERT INTO lessons(track_id,type,title_en,title_es,is_published,sort_order,resource_quiz_id,resource_offer_id,resource_recipe_id,resource_track_id)
    VALUES(sec,'text',en,es,pub,coalesce((SELECT max(sort_order)+1 FROM lessons WHERE track_id=sec),1),CASE WHEN _kind='quiz' THEN _id END,CASE WHEN _kind='offer' THEN _id END,CASE WHEN _kind='recipe' THEN _id END,CASE WHEN _kind='track' THEN _id END);
  ELSE
   UPDATE lessons SET detached_at=NULL,is_published=pub,title_en=en,title_es=es,sort_order=CASE WHEN track_id=sec THEN sort_order ELSE coalesce((SELECT max(sort_order)+1 FROM lessons WHERE track_id=sec),1) END,track_id=sec WHERE id=lid;
  END IF;
  keep:=keep||cid;
 END LOOP;
 IF locked AND NOT (contained=ANY(keep)) THEN RAISE EXCEPTION 'course_item_locked'; END IF;
 IF pub AND NOT (_team OR _coach OR cardinality(keep)>0) THEN RAISE EXCEPTION 'destination_required'; END IF;
 UPDATE lessons l SET detached_at=now(),is_published=false FROM tracks t WHERE t.id=l.track_id AND t.offer_id IS NOT NULL AND NOT (t.offer_id=ANY(keep)) AND l.detached_at IS NULL AND CASE _kind WHEN 'track' THEN l.resource_track_id=_id WHEN 'recipe' THEN l.resource_recipe_id=_id WHEN 'quiz' THEN l.resource_quiz_id=_id ELSE l.resource_offer_id=_id END;
 standalone:=_team OR _coach;
 IF NOT standalone THEN _price:=0; END IF;
 newp:=CASE WHEN _team THEN 'team' WHEN _coach THEN 'coach' WHEN locked THEN 'course' ELSE NULL END;
 IF _kind='offer' THEN
  UPDATE offers SET price_cents=_price,placement=newp,parent_course_id=NULL,on_team=_team,on_coach=_coach,visibility=CASE WHEN _coach THEN 'public' ELSE 'team' END,billing_interval=CASE WHEN kind='download' THEN NULL ELSE billing_interval END WHERE id=_id;
  RETURN _id;
 END IF;
 IF o IS NULL AND standalone THEN
  INSERT INTO offers(host_id,team_id,kind,title_en,title_es,price_cents,status,visibility,placement,resource_type,cover_style,includes_en,includes_es,on_team,on_coach)
   VALUES(owner,team,'download',en,es,_price,CASE WHEN pub THEN 'published' ELSE 'draft' END,CASE WHEN _coach THEN 'public' ELSE 'team' END,newp,ty,sty,'[]','[]',_team,_coach) RETURNING id INTO o;
 ELSIF o IS NOT NULL THEN
  UPDATE offers SET title_en=en,title_es=es,price_cents=_price,placement=newp,parent_course_id=NULL,on_team=_team,on_coach=_coach,visibility=CASE WHEN _coach THEN 'public' ELSE 'team' END,billing_interval=NULL WHERE id=o;
 END IF;
 IF _kind='track' THEN UPDATE tracks SET placement=newp,on_team=_team,on_coach=_coach,commerce_offer_id=o,visibility=CASE WHEN _coach THEN 'public' ELSE 'team' END,host_id=owner WHERE id=_id;
 ELSIF _kind='recipe' THEN UPDATE recipes SET placement=newp,parent_course_id=NULL,on_team=_team,on_coach=_coach,commerce_offer_id=o WHERE id=_id;
 ELSE UPDATE quizzes SET placement=newp,on_team=_team,on_coach=_coach,commerce_offer_id=o WHERE id=_id; END IF;
 RETURN o;
END $$;
REVOKE ALL ON FUNCTION public.set_resource_destinations(text,uuid,boolean,boolean,jsonb,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_resource_destinations(text,uuid,boolean,boolean,jsonb,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_access_offer(_offer uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM offers o WHERE o.id=_offer AND (o.host_id=auth.uid() OR (o.kind='download' AND o.status='published' AND public.resource_course_included('offer',o.id)) OR (o.placement IS NULL AND is_team_member(o.team_id,ARRAY['leader'])) OR (resource_is_live(o.available_from) AND (o.placement IS NULL OR o.status='published') AND (o.parent_course_id IS NULL OR public.can_access_offer(o.parent_course_id)) AND ((o.price_cents=0 AND can_use_team_templates(o.team_id)) OR EXISTS(SELECT 1 FROM offer_purchases p WHERE p.offer_id=o.id AND p.user_id=auth.uid() AND (p.paused_until IS NULL OR p.paused_until<=now()) AND (p.status='paid' OR (p.status IN ('active','past_due') AND (p.renews_at IS NULL OR p.renews_at>now()-interval '3 days')))) OR EXISTS(SELECT 1 FROM entitlements e WHERE e.offer_id=o.id AND e.user_id=auth.uid() AND e.revoked_at IS NULL AND e.starts_at<=now() AND (e.ends_at IS NULL OR e.ends_at>now()))))));
$$;

CREATE OR REPLACE FUNCTION public.resource_commerce_access(_offer uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM tracks x WHERE x.commerce_offer_id=_offer AND x.is_published AND public.resource_course_included('track',x.id)) OR EXISTS(SELECT 1 FROM recipes x WHERE x.commerce_offer_id=_offer AND x.is_published AND public.resource_course_included('recipe',x.id)) OR EXISTS(SELECT 1 FROM quizzes x WHERE x.commerce_offer_id=_offer AND x.is_published AND public.resource_course_included('quiz',x.id)) OR EXISTS(SELECT 1 FROM offers o WHERE o.id=_offer AND (o.host_id=auth.uid() OR (o.status='published' AND resource_is_live(o.available_from) AND (o.parent_course_id IS NULL OR public.can_access_offer(o.parent_course_id)) AND (o.price_cents=0 OR EXISTS(SELECT 1 FROM offer_purchases p WHERE p.offer_id=o.id AND p.user_id=auth.uid() AND (p.paused_until IS NULL OR p.paused_until<=now()) AND (p.status='paid' OR (p.status IN ('active','past_due') AND (p.renews_at IS NULL OR p.renews_at>now()-interval '3 days')))) OR EXISTS(SELECT 1 FROM entitlements e WHERE e.offer_id=o.id AND e.user_id=auth.uid() AND e.revoked_at IS NULL AND e.starts_at<=now() AND (e.ends_at IS NULL OR e.ends_at>now()))))));
$$;
