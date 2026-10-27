ALTER TABLE public.quizzes ADD COLUMN assessment_config jsonb, ADD COLUMN assessment_revision integer NOT NULL DEFAULT 0;
COMMENT ON COLUMN public.quizzes.assessment_config IS 'Dedicated non-diagnostic wellness assessment draft; existing quiz grading/certificates never interpret this configuration. Participant collection requires approved scope content and a separately verified completion path.';
CREATE OR REPLACE FUNCTION public.save_wellness_assessment(_id uuid, _team uuid, _config jsonb, _placement text, _course uuid, _price integer, _revision integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE z quizzes; target uuid; rev integer;
BEGIN
 IF auth.uid() IS NULL OR jsonb_typeof(_config)<>'object' OR length(_config::text)>150000 OR _config->>'kind' IS DISTINCT FROM 'wellness_assessment' THEN RAISE EXCEPTION 'invalid_assessment'; END IF;
 IF _id IS NOT NULL THEN SELECT * INTO z FROM quizzes WHERE id=_id FOR UPDATE; IF NOT FOUND OR z.assessment_config IS NULL OR NOT can_edit_quiz(_id) OR z.host_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'not_allowed'; END IF; IF z.assessment_revision<>_revision THEN RAISE EXCEPTION 'assessment_changed'; END IF; IF z.is_published OR EXISTS(SELECT 1 FROM quiz_attempts WHERE quiz_id=z.id) THEN RAISE EXCEPTION 'assessment_history_locked'; END IF; target:=z.id;
 ELSE
  IF NOT can_build_resources(_team) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  IF _placement='course' AND NOT EXISTS(SELECT 1 FROM offers WHERE id=_course AND host_id=auth.uid() AND team_id=_team AND kind='course' AND status<>'archived') THEN RAISE EXCEPTION 'invalid_course'; END IF;
  INSERT INTO quizzes(team_id,offer_id,title_en,title_es,mode,is_published,attempts_allowed,assessment_config) VALUES(CASE WHEN _placement='course' THEN NULL ELSE _team END,CASE WHEN _placement='course' THEN _course ELSE NULL END,coalesce(_config->>'title_en',''),coalesce(_config->>'title_es',''),'poll',false,1,_config) RETURNING id INTO target;
 END IF;
 UPDATE quizzes SET title_en=coalesce(_config->>'title_en',''),title_es=coalesce(_config->>'title_es',''),instructions_en=_config->>'description_en',instructions_es=_config->>'description_es',assessment_config=_config,assessment_revision=assessment_revision+1,attempts_allowed=CASE WHEN coalesce((_config->>'allow_retake')::boolean,false) THEN NULL ELSE 1 END WHERE id=target RETURNING assessment_revision INTO rev;
 PERFORM configure_resource_access('quiz',target,_placement,_course,_price);
 RETURN jsonb_build_object('id',target,'revision',rev);
END $$;
REVOKE ALL ON FUNCTION public.save_wellness_assessment(uuid,uuid,jsonb,text,uuid,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_wellness_assessment(uuid,uuid,jsonb,text,uuid,integer,integer) TO authenticated;
CREATE OR REPLACE FUNCTION public.assessment_collection_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_TABLE_NAME='quizzes' THEN
  IF NEW.assessment_config IS NOT NULL THEN
   IF NEW.is_published THEN RAISE EXCEPTION 'approved_assessment_content_required'; END IF;
   IF TG_OP='UPDATE' AND OLD.assessment_config IS NOT NULL AND (NEW.assessment_config IS DISTINCT FROM OLD.assessment_config OR NEW.assessment_config IS NULL) AND EXISTS(SELECT 1 FROM quiz_attempts WHERE quiz_id=OLD.id) THEN RAISE EXCEPTION 'assessment_history_locked'; END IF;
  END IF;
 ELSE IF EXISTS(SELECT 1 FROM quizzes WHERE id=NEW.quiz_id AND assessment_config IS NOT NULL) THEN RAISE EXCEPTION 'approved_assessment_content_required'; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.assessment_collection_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER assessment_collection_guard BEFORE INSERT OR UPDATE ON public.quizzes FOR EACH ROW EXECUTE FUNCTION public.assessment_collection_guard();
CREATE TRIGGER assessment_attempt_guard BEFORE INSERT OR UPDATE ON public.quiz_attempts FOR EACH ROW EXECUTE FUNCTION public.assessment_collection_guard();
CREATE OR REPLACE FUNCTION public.reorder_course_curriculum(_course uuid,_track uuid,_ids uuid[]) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n integer;
BEGIN
 PERFORM 1 FROM offers WHERE id=_course AND kind='course' AND host_id=auth.uid() FOR UPDATE;
 IF NOT FOUND OR auth.uid() IS NULL THEN RAISE EXCEPTION 'not_allowed'; END IF;
 IF _ids IS NULL OR cardinality(_ids)<>(SELECT count(DISTINCT v) FROM unnest(_ids) v) THEN RAISE EXCEPTION 'invalid_order'; END IF;
 IF _track IS NULL THEN
  SELECT count(*) INTO n FROM tracks WHERE offer_id=_course;
  IF n<>cardinality(_ids) OR EXISTS(SELECT 1 FROM unnest(_ids) v WHERE NOT EXISTS(SELECT 1 FROM tracks WHERE id=v AND offer_id=_course)) THEN RAISE EXCEPTION 'invalid_order'; END IF;
  UPDATE tracks t SET sort_order=x.pos FROM unnest(_ids) WITH ORDINALITY x(id,pos) WHERE t.id=x.id AND t.offer_id=_course;
 ELSE
  IF NOT EXISTS(SELECT 1 FROM tracks WHERE id=_track AND offer_id=_course) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  SELECT count(*) INTO n FROM lessons WHERE track_id=_track;
  IF n<>cardinality(_ids) OR EXISTS(SELECT 1 FROM unnest(_ids) v WHERE NOT EXISTS(SELECT 1 FROM lessons WHERE id=v AND track_id=_track)) THEN RAISE EXCEPTION 'invalid_order'; END IF;
  UPDATE lessons l SET sort_order=x.pos FROM unnest(_ids) WITH ORDINALITY x(id,pos) WHERE l.id=x.id AND l.track_id=_track;
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.reorder_course_curriculum(uuid,uuid,uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.reorder_course_curriculum(uuid,uuid,uuid[]) TO authenticated;
CREATE OR REPLACE FUNCTION public.course_link_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
 IF NEW.type='link' AND EXISTS(SELECT 1 FROM tracks WHERE id=NEW.track_id AND offer_id IS NOT NULL) AND (NEW.url IS NULL OR NEW.url !~ '^https://[^[:space:]@/]+([/?#][^[:space:]]*)?$') THEN RAISE EXCEPTION 'https_link_required'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER course_link_guard BEFORE INSERT OR UPDATE OF url,type ON public.lessons FOR EACH ROW EXECUTE FUNCTION public.course_link_guard();