CREATE OR REPLACE FUNCTION public.get_resource_page(_kind text, _id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r record; owner uuid; pub boolean; placement text; coach boolean; parent uuid; commerce uuid; payload jsonb; price integer:=0; allowed boolean; team uuid; via_course boolean:=false;
BEGIN
 IF _kind='track' THEN SELECT * INTO r FROM tracks WHERE id=_id; IF NOT FOUND THEN RETURN NULL; END IF; owner:=r.host_id; pub:=r.is_published; placement:=coalesce(r.placement,CASE WHEN r.offer_id IS NOT NULL THEN 'course' WHEN r.visibility='public' THEN 'coach' ELSE 'team' END); coach:=coalesce(r.on_coach,r.offer_id IS NULL AND placement='coach'); parent:=r.offer_id; commerce:=r.commerce_offer_id; team:=r.team_id;
 ELSIF _kind='recipe' THEN SELECT * INTO r FROM recipes WHERE id=_id; IF NOT FOUND THEN RETURN NULL; END IF; owner:=r.created_by; pub:=r.is_published; placement:=coalesce(r.placement,'team'); coach:=coalesce(r.on_coach,placement='coach'); parent:=r.parent_course_id; commerce:=r.commerce_offer_id; team:=r.team_id;
 ELSIF _kind='quiz' THEN SELECT * INTO r FROM quizzes WHERE id=_id; IF NOT FOUND THEN RETURN NULL; END IF; owner:=r.host_id; pub:=r.is_published; placement:=coalesce(r.placement,CASE WHEN r.offer_id IS NOT NULL THEN 'course' ELSE 'team' END); coach:=coalesce(r.on_coach,placement='coach'); parent:=r.offer_id; commerce:=r.commerce_offer_id; team:=r.team_id;
 ELSIF _kind='offer' THEN SELECT * INTO r FROM offers WHERE id=_id; IF NOT FOUND THEN RETURN NULL; END IF; owner:=r.host_id; pub:=r.status='published'; placement:=coalesce(r.placement,CASE WHEN r.visibility='public' THEN 'coach' ELSE 'team' END); coach:=coalesce(r.on_coach,placement='coach'); parent:=r.parent_course_id; commerce:=r.id; team:=r.team_id;
 ELSE RETURN NULL; END IF;
 IF auth.uid() IS NOT NULL AND owner IS DISTINCT FROM auth.uid() AND pub THEN via_course:=public.resource_course_included(_kind,_id); END IF;
 IF owner IS DISTINCT FROM auth.uid() AND (NOT pub OR NOT ((coach AND EXISTS(SELECT 1 FROM profiles WHERE id=owner AND host_public)) OR (NOT coach AND placement<>'coach' AND coalesce(r.on_team,true) AND can_use_team_templates(team)) OR (parent IS NOT NULL AND can_access_offer(parent)) OR via_course)) THEN RETURN NULL; END IF;
 IF commerce IS NOT NULL THEN SELECT price_cents INTO price FROM offers WHERE id=commerce; END IF;
 allowed:=pub AND (commerce IS NULL OR resource_commerce_access(commerce)) AND (parent IS NULL OR can_access_offer(parent));
 IF NOT coach AND NOT coalesce(r.on_team,true) AND parent IS NULL AND NOT via_course THEN allowed:=false; END IF;
 IF _kind IN ('track','recipe') THEN allowed:=allowed AND resource_is_live(r.available_from); END IF;
 IF owner=auth.uid() THEN allowed:=true; END IF;
 payload:=jsonb_build_object('id',_id,'entity',_kind,'title_en',r.title_en,'title_es',r.title_es,'host_id',owner,'host_name',(SELECT full_name FROM profiles WHERE id=owner),'placement',placement,'price_cents',coalesce(price,0),'offer_id',commerce,'parent_course_id',parent,'access',allowed,'published',pub,'course_access',via_course);
 IF _kind='track' THEN payload:=payload||jsonb_build_object('type',coalesce(r.resource_kind,'video'),'cover_path',r.cover_url,'cover_style',r.cover_style,'content',CASE WHEN allowed THEN (SELECT coalesce(jsonb_agg(jsonb_build_object('id',l.id,'type',l.type,'title_en',l.title_en,'title_es',l.title_es,'url',l.url,'storage_path',l.storage_path,'replay_url',l.replay_url,'description_en',l.description_en,'description_es',l.description_es) ORDER BY l.sort_order),'[]') FROM lessons l WHERE l.track_id=_id AND l.is_published AND lesson_is_unlocked(l.id)) ELSE '[]'::jsonb END);
 ELSIF _kind='recipe' THEN payload:=payload||jsonb_build_object('type','recipe','cover_path',r.cover_url,'cover_style',r.cover_style,'ingredients',CASE WHEN allowed THEN r.ingredients ELSE NULL END,'steps',CASE WHEN allowed THEN r.steps ELSE NULL END);
 ELSIF _kind='quiz' THEN payload:=payload||jsonb_build_object('type','quiz','cover_path',r.cover_path,'cover_style',0);
 ELSE payload:=payload||jsonb_build_object('type',coalesce(r.resource_type,r.kind),'cover_path',r.cover_url,'cover_style',r.cover_style,'file_path',CASE WHEN allowed THEN r.file_path ELSE NULL END); END IF;
 RETURN payload;
END $function$;
