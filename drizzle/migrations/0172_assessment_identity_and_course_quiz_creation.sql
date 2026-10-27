CREATE OR REPLACE FUNCTION public.assessment_collection_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_TABLE_NAME='quizzes' THEN
  IF TG_OP='UPDATE' AND OLD.assessment_config IS NOT NULL AND NEW.assessment_config IS NULL THEN RAISE EXCEPTION 'assessment_identity_locked'; END IF;
  IF NEW.assessment_config IS NOT NULL THEN
   IF NEW.is_published THEN RAISE EXCEPTION 'approved_assessment_content_required'; END IF;
   IF TG_OP='UPDATE' AND EXISTS(SELECT 1 FROM quiz_attempts WHERE quiz_id=OLD.id) THEN RAISE EXCEPTION 'assessment_history_locked'; END IF;
   IF jsonb_typeof(NEW.assessment_config)<>'object' OR NEW.assessment_config->>'kind' IS DISTINCT FROM 'wellness_assessment' OR length(NEW.assessment_config::text)>150000 THEN RAISE EXCEPTION 'invalid_assessment'; END IF;
   IF public.has_blocked_claim(NEW.assessment_config::text) THEN RAISE EXCEPTION 'blocked_claim'; END IF;
  END IF;
 ELSE IF EXISTS(SELECT 1 FROM quizzes WHERE id=NEW.quiz_id AND assessment_config IS NOT NULL) THEN RAISE EXCEPTION 'approved_assessment_content_required'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.team_quizzes(_team uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',z.id,'title_en',z.title_en,'title_es',z.title_es,'mode',z.mode,'assessment',z.assessment_config IS NOT NULL,'is_published',z.is_published,'mine',z.host_id=auth.uid(),'cover_path',z.cover_path,'questions',CASE WHEN z.assessment_config IS NOT NULL THEN jsonb_array_length(coalesce(z.assessment_config->'questions','[]'::jsonb)) ELSE (SELECT count(*)::integer FROM quiz_questions WHERE quiz_id=z.id) END,'done',EXISTS(SELECT 1 FROM quiz_attempts WHERE quiz_id=z.id AND user_id=auth.uid() AND submitted_at IS NOT NULL),'updated_at',z.updated_at) ORDER BY z.updated_at DESC),'[]'::jsonb)
 FROM quizzes z WHERE z.offer_id IS NULL AND z.team_id=_team AND auth.uid() IS NOT NULL AND is_team_member(_team,ARRAY['leader','host','member']) AND (z.is_published OR z.host_id=auth.uid());
$$;
CREATE OR REPLACE FUNCTION public.create_course_quiz_item(_track uuid,_title text,_language text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE tr tracks; l uuid; q uuid; pos integer;
BEGIN
 SELECT * INTO tr FROM tracks WHERE id=_track FOR UPDATE;
 IF NOT FOUND OR tr.offer_id IS NULL OR NOT EXISTS(SELECT 1 FROM offers WHERE id=tr.offer_id AND host_id=auth.uid() AND kind='course') OR auth.uid() IS NULL OR length(trim(_title))=0 OR length(_title)>160 OR _language NOT IN('en','es') THEN RAISE EXCEPTION 'not_allowed'; END IF;
 SELECT coalesce(max(sort_order),0)+1 INTO pos FROM lessons WHERE track_id=_track;
 INSERT INTO lessons(track_id,title_en,title_es,type,sort_order,is_published) VALUES(_track,CASE WHEN _language='en' THEN trim(_title) ELSE '' END,CASE WHEN _language='es' THEN trim(_title) ELSE '' END,'text',pos,false) RETURNING id INTO l;
 INSERT INTO quizzes(offer_id,lesson_id,title_en,title_es,mode,is_published,is_required,attempts_allowed,sort_order) VALUES(tr.offer_id,l,CASE WHEN _language='en' THEN trim(_title) ELSE '' END,CASE WHEN _language='es' THEN trim(_title) ELSE '' END,'scored',false,false,1,pos) RETURNING id INTO q;
 RETURN jsonb_build_object('id',q,'lesson_id',l);
END $$;
REVOKE ALL ON FUNCTION public.create_course_quiz_item(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_course_quiz_item(uuid,text,text) TO authenticated;