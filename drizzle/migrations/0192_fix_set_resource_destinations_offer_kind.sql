CREATE OR REPLACE FUNCTION public.set_resource_destinations(_kind text, _id uuid, _team boolean, _coach boolean, _courses jsonb, _price integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r record; o uuid; owner uuid; team uuid; en text; es text; pub boolean; sty smallint; ty text; contained uuid; locked boolean:=false; c jsonb; cid uuid; sec uuid; keep uuid[]:='{}'; lid uuid; ltrack uuid; newp text; standalone boolean; okind text;
BEGIN
 IF auth.uid() IS NULL OR _team IS NULL OR _coach IS NULL OR _price IS NULL OR _price<0 OR _price>100000 OR (_price>0 AND _price<50) OR jsonb_typeof(coalesce(_courses,'[]'::jsonb))<>'array' OR jsonb_array_length(coalesce(_courses,'[]'::jsonb))>20 THEN RAISE EXCEPTION 'invalid_resource_access'; END IF;
 IF _kind='track' THEN SELECT * INTO r FROM tracks WHERE id=_id FOR UPDATE; IF NOT FOUND OR NOT can_edit_track(_id) THEN RAISE EXCEPTION 'not_allowed'; END IF; owner:=coalesce(r.host_id,auth.uid()); team:=r.team_id; en:=r.title_en; es:=r.title_es; pub:=r.is_published; o:=r.commerce_offer_id; sty:=r.cover_style; ty:=CASE r.resource_kind WHEN 'pdf' THEN 'guide' ELSE coalesce(r.resource_kind,'video') END; contained:=r.offer_id; locked:=contained IS NOT NULL;
 ELSIF _kind='recipe' THEN SELECT * INTO r FROM recipes WHERE id=_id FOR UPDATE; IF NOT FOUND OR NOT (r.created_by=auth.uid() OR is_team_member(r.team_id,ARRAY['leader'])) THEN RAISE EXCEPTION 'not_allowed'; END IF; owner:=r.created_by; team:=r.team_id; en:=r.title_en; es:=r.title_es; pub:=r.is_published; o:=r.commerce_offer_id; sty:=r.cover_style; ty:='recipe'; contained:=r.parent_course_id;
 ELSIF _kind='quiz' THEN SELECT * INTO r FROM quizzes WHERE id=_id FOR UPDATE; IF NOT FOUND OR NOT can_edit_quiz(_id) THEN RAISE EXCEPTION 'not_allowed'; END IF; owner:=r.host_id; team:=r.team_id; IF team IS NULL THEN SELECT team_id INTO team FROM offers WHERE id=r.offer_id; END IF; en:=r.title_en; es:=r.title_es; pub:=r.is_published; o:=r.commerce_offer_id; sty:=0; ty:='quiz'; contained:=r.offer_id; locked:=contained IS NOT NULL;
 ELSIF _kind='offer' THEN SELECT * INTO r FROM offers WHERE id=_id FOR UPDATE; IF NOT FOUND OR r.host_id<>auth.uid() THEN RAISE EXCEPTION 'not_allowed'; END IF; owner:=r.host_id; team:=r.team_id; en:=r.title_en; es:=r.title_es; pub:=r.status='published'; o:=r.id; contained:=r.parent_course_id; okind:=r.kind;
 ELSE RAISE EXCEPTION 'invalid_kind'; END IF;
 IF owner IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'not_allowed'; END IF;
 IF locked AND (_team OR _coach) THEN RAISE EXCEPTION 'course_item_locked'; END IF;
 FOR c IN SELECT * FROM jsonb_array_elements(coalesce(_courses,'[]'::jsonb)) LOOP
  BEGIN cid:=(c->>'course')::uuid; sec:=nullif(c->>'section','')::uuid; EXCEPTION WHEN others THEN RAISE EXCEPTION 'invalid_course'; END;
  IF cid IS NULL THEN RAISE EXCEPTION 'invalid_course'; END IF;
  IF cid=ANY(keep) THEN CONTINUE; END IF;
  IF NOT EXISTS(SELECT 1 FROM offers WHERE id=cid AND kind='course' AND host_id=auth.uid() AND team_id=team AND status<>'archived') THEN RAISE EXCEPTION 'invalid_course'; END IF;
  IF _kind='offer' AND (_id=cid OR okind IS DISTINCT FROM 'download') THEN RAISE EXCEPTION 'invalid_course'; END IF;
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
END $function$;
