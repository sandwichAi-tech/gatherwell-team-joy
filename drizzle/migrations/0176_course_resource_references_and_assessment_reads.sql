ALTER TABLE public.lessons ADD COLUMN resource_offer_id uuid REFERENCES public.offers(id) ON DELETE RESTRICT, ADD COLUMN resource_recipe_id uuid REFERENCES public.recipes(id) ON DELETE RESTRICT;
CREATE OR REPLACE FUNCTION public.course_lesson_quiz(_lesson uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT jsonb_build_object('id',q.id,'assessment',q.assessment_config IS NOT NULL) FROM lessons l JOIN tracks t ON t.id=l.track_id JOIN quizzes q ON q.lesson_id=l.id WHERE l.id=_lesson AND l.detached_at IS NULL AND l.is_published AND q.is_published AND can_read_track(t.id) AND lesson_is_unlocked(l.id) LIMIT 1; $$;
REVOKE ALL ON FUNCTION public.course_lesson_quiz(uuid) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.course_lesson_quiz(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.quiz_is_assessment(_quiz uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM quizzes WHERE id=_quiz AND assessment_config IS NOT NULL AND (can_edit_quiz(_quiz) OR quiz_access_error(_quiz) IS NULL)); $$;
REVOKE ALL ON FUNCTION public.quiz_is_assessment(uuid) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.quiz_is_assessment(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.course_reusable_resources(_course uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM offers WHERE id=_course AND host_id=auth.uid() AND kind='course') THEN '[]'::jsonb ELSE coalesce((SELECT jsonb_agg(row) FROM (
 SELECT jsonb_build_object('id',q.id,'kind','quiz','title_en',q.title_en,'title_es',q.title_es) row FROM quizzes q WHERE q.host_id=auth.uid() AND q.offer_id IS NULL
 UNION ALL SELECT jsonb_build_object('id',o.id,'kind','offer','title_en',o.title_en,'title_es',o.title_es) FROM offers o WHERE o.host_id=auth.uid() AND o.id<>_course AND o.kind='download'
 UNION ALL SELECT jsonb_build_object('id',r.id,'kind','recipe','title_en',r.title_en,'title_es',r.title_es) FROM recipes r WHERE r.created_by=auth.uid()
 ) x),'[]'::jsonb) END $$;
REVOKE ALL ON FUNCTION public.course_reusable_resources(uuid) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.course_reusable_resources(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.attach_course_resource(_track uuid,_kind text,_resource uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE tr tracks; en text; es text; l uuid; BEGIN
 SELECT * INTO tr FROM tracks WHERE id=_track FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM offers WHERE id=tr.offer_id AND host_id=auth.uid() AND kind='course') THEN RAISE EXCEPTION 'not_allowed'; END IF;
 IF _kind='quiz' THEN SELECT title_en,title_es INTO en,es FROM quizzes WHERE id=_resource AND host_id=auth.uid() AND offer_id IS NULL;
 ELSIF _kind='offer' THEN SELECT title_en,title_es INTO en,es FROM offers WHERE id=_resource AND host_id=auth.uid() AND kind='download' AND id<>tr.offer_id;
 ELSIF _kind='recipe' THEN SELECT title_en,title_es INTO en,es FROM recipes WHERE id=_resource AND created_by=auth.uid(); ELSE RAISE EXCEPTION 'invalid_resource'; END IF;
 IF NOT FOUND THEN RAISE EXCEPTION 'not_allowed'; END IF;
 INSERT INTO lessons(track_id,type,title_en,title_es,is_published,sort_order,resource_quiz_id,resource_offer_id,resource_recipe_id) VALUES(_track,'text',en,es,false,coalesce((SELECT max(sort_order)+1 FROM lessons WHERE track_id=_track),1),CASE WHEN _kind='quiz' THEN _resource END,CASE WHEN _kind='offer' THEN _resource END,CASE WHEN _kind='recipe' THEN _resource END) RETURNING id INTO l;
 RETURN l; END $$;
REVOKE ALL ON FUNCTION public.attach_course_resource(uuid,text,uuid) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.attach_course_resource(uuid,text,uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.course_resource_destination(_lesson uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ DECLARE l lessons; BEGIN
 SELECT * INTO l FROM lessons WHERE id=_lesson AND is_published AND detached_at IS NULL;
 IF NOT FOUND OR NOT can_read_track(l.track_id) OR NOT lesson_is_unlocked(l.id) THEN RETURN NULL; END IF;
 IF l.resource_quiz_id IS NOT NULL AND quiz_access_error(l.resource_quiz_id) IS NULL THEN RETURN jsonb_build_object('kind','quiz','id',l.resource_quiz_id); END IF;
 IF l.resource_offer_id IS NOT NULL AND can_access_offer(l.resource_offer_id) THEN RETURN jsonb_build_object('kind','offer','id',l.resource_offer_id); END IF;
 IF l.resource_recipe_id IS NOT NULL AND EXISTS(SELECT 1 FROM recipes r WHERE r.id=l.resource_recipe_id AND r.is_published AND r.created_by=(SELECT o.host_id FROM tracks t JOIN offers o ON o.id=t.offer_id WHERE t.id=l.track_id) AND (r.commerce_offer_id IS NULL OR resource_commerce_access(r.commerce_offer_id))) THEN RETURN jsonb_build_object('kind','recipe','id',l.resource_recipe_id); END IF;
 RETURN NULL; END $$;
REVOKE ALL ON FUNCTION public.course_resource_destination(uuid) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.course_resource_destination(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.assessment_scope_valid_hash() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN IF NEW.document_hash<>encode(sha256(convert_to(NEW.document_text,'UTF8')),'hex') OR length(trim(NEW.approval_reference))=0 OR NEW.approved_at>now() THEN RAISE EXCEPTION 'invalid_approval_reference'; END IF; RETURN NEW; END $$;
CREATE TRIGGER assessment_scope_hash BEFORE INSERT ON public.assessment_scope_versions FOR EACH ROW EXECUTE FUNCTION public.assessment_scope_valid_hash();
CREATE OR REPLACE FUNCTION public.assessment_receipt_self_insert() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN IF auth.role()<>'service_role' AND (NEW.user_id IS DISTINCT FROM auth.uid() OR quiz_access_error(NEW.quiz_id) IS NOT NULL) THEN RAISE EXCEPTION 'not_allowed'; END IF; RETURN NEW; END $$;
CREATE TRIGGER assessment_receipt_insert_guard BEFORE INSERT ON public.assessment_receipts FOR EACH ROW EXECUTE FUNCTION public.assessment_receipt_self_insert();