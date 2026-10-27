CREATE TABLE public.assessment_scope_versions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), locale text NOT NULL CHECK(locale IN('en','es')), version integer NOT NULL CHECK(version>0), document_text text NOT NULL CHECK(length(document_text)>0), document_hash text NOT NULL, approval_reference text NOT NULL, approved_at timestamptz NOT NULL, approved_by uuid NOT NULL, retired_at timestamptz, UNIQUE(locale,version));
GRANT SELECT ON public.assessment_scope_versions TO authenticated;
GRANT ALL ON public.assessment_scope_versions TO service_role;
ALTER TABLE public.assessment_scope_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY assessment_scope_read ON public.assessment_scope_versions FOR SELECT TO authenticated USING(retired_at IS NULL);
ALTER TABLE public.quizzes ADD COLUMN assessment_scope_id uuid REFERENCES public.assessment_scope_versions(id) ON DELETE RESTRICT;
CREATE TABLE public.assessment_receipts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), quiz_id uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE RESTRICT, user_id uuid NOT NULL, request_id uuid NOT NULL, revision integer NOT NULL, scope_id uuid NOT NULL REFERENCES public.assessment_scope_versions(id) ON DELETE RESTRICT, answers jsonb NOT NULL, config_snapshot jsonb NOT NULL, score integer CHECK(score BETWEEN 0 AND 100), result_snapshot jsonb, completed_at timestamptz NOT NULL DEFAULT now(), UNIQUE(quiz_id,user_id,request_id));
GRANT SELECT ON public.assessment_receipts TO authenticated;
GRANT ALL ON public.assessment_receipts TO service_role;
ALTER TABLE public.assessment_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY assessment_receipt_private ON public.assessment_receipts FOR SELECT TO authenticated USING(user_id=auth.uid() OR EXISTS(SELECT 1 FROM public.quizzes q WHERE q.id=quiz_id AND q.host_id=auth.uid()));
CREATE OR REPLACE FUNCTION public.immutable_assessment_evidence() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN RAISE EXCEPTION 'immutable_evidence'; END $$;
CREATE TRIGGER assessment_receipt_immutable BEFORE UPDATE OR DELETE ON public.assessment_receipts FOR EACH ROW EXECUTE FUNCTION public.immutable_assessment_evidence();
CREATE TRIGGER assessment_scope_immutable BEFORE UPDATE OF locale,version,document_text,document_hash,approval_reference,approved_at,approved_by OR DELETE ON public.assessment_scope_versions FOR EACH ROW EXECUTE FUNCTION public.immutable_assessment_evidence();
ALTER TABLE public.lessons ADD COLUMN detached_at timestamptz, ADD COLUMN resource_quiz_id uuid REFERENCES public.quizzes(id) ON DELETE RESTRICT;
ALTER TABLE public.offers ADD COLUMN curriculum_revision integer NOT NULL DEFAULT 0;
CREATE OR REPLACE FUNCTION public.validate_assessment_config(_c jsonb) RETURNS void LANGUAGE plpgsql SET search_path=public AS $$
DECLARE q jsonb; o jsonb; r jsonb; ids text[]:='{}'; opts text[]; lo numeric; hi numeric; previous integer:=-1; scored boolean:=false;
BEGIN
 IF _c->>'kind' IS DISTINCT FROM 'wellness_assessment' OR jsonb_typeof(_c->'questions') IS DISTINCT FROM 'array' OR jsonb_array_length(_c->'questions') NOT BETWEEN 1 AND 50 OR length(_c::text)>150000 OR length(trim(coalesce(_c->>'title_en','')||coalesce(_c->>'title_es','')))=0 OR _c->>'language' NOT IN('en','es') THEN RAISE EXCEPTION 'invalid_assessment'; END IF;
 FOR q IN SELECT value FROM jsonb_array_elements(_c->'questions') LOOP
 IF coalesce(q->>'id','')='' OR q->>'id'=ANY(ids) OR q->>'type' NOT IN('single','multi','scale','text') OR length(trim(coalesce(q->>'prompt','')))=0 OR length(q->>'prompt')>500 THEN RAISE EXCEPTION 'invalid_questions'; END IF; ids:=array_append(ids,q->>'id');
 IF q->>'type'='text' THEN IF coalesce((q->>'scored')::boolean,false) THEN RAISE EXCEPTION 'text_unscored'; END IF; CONTINUE; END IF;
 IF jsonb_typeof(q->'options') IS DISTINCT FROM 'array' OR jsonb_array_length(q->'options') NOT BETWEEN 2 AND 8 THEN RAISE EXCEPTION 'invalid_options'; END IF;
 opts:='{}'; lo:=NULL; hi:=NULL;
 FOR o IN SELECT value FROM jsonb_array_elements(q->'options') LOOP
 IF coalesce(o->>'id','')='' OR o->>'id'=ANY(opts) OR length(trim(coalesce(o->>'label','')))=0 OR length(o->>'label')>200 OR (o->>'value')::numeric NOT BETWEEN 0 AND 100 THEN RAISE EXCEPTION 'invalid_options'; END IF;
 opts:=array_append(opts,o->>'id'); lo:=least(lo,(o->>'value')::numeric); hi:=greatest(hi,(o->>'value')::numeric);
 END LOOP;
 IF coalesce((q->>'scored')::boolean,false) THEN scored:=true; IF (q->>'weight')::numeric NOT BETWEEN 0.1 AND 100 OR lo=hi THEN RAISE EXCEPTION 'invalid_weights'; END IF; END IF;
 END LOOP;
 IF jsonb_typeof(_c->'results') IS DISTINCT FROM 'array' OR jsonb_array_length(_c->'results')>101 THEN RAISE EXCEPTION 'invalid_ranges'; END IF;
 ids:='{}';
 FOR r IN SELECT value FROM jsonb_array_elements(_c->'results') ORDER BY (value->>'min')::integer LOOP
 IF coalesce(r->>'id','')='' OR r->>'id'=ANY(ids) OR length(trim(coalesce(r->>'title','')))=0 OR length(trim(coalesce(r->>'body','')))=0 OR length(r->>'body')>2000 OR (r->>'min')::numeric<>(r->>'min')::integer OR (r->>'max')::numeric<>(r->>'max')::integer OR (r->>'min')::integer<>previous+1 OR (r->>'max')::integer NOT BETWEEN (r->>'min')::integer AND 100 THEN RAISE EXCEPTION 'invalid_ranges'; END IF;
 IF coalesce(r->>'url','')<>'' AND r->>'url' !~ '^https://[^[:space:]@/]+([/?#][^[:space:]]*)?$' THEN RAISE EXCEPTION 'https_link_required'; END IF;
 IF r ? 'recommendations' THEN RAISE EXCEPTION 'unsupported_recommendation'; END IF;
 ids:=array_append(ids,r->>'id'); previous:=(r->>'max')::integer;
 END LOOP;
 IF scored AND previous<>100 THEN RAISE EXCEPTION 'invalid_ranges'; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.assessment_collection_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_TABLE_NAME='quizzes' THEN
 IF TG_OP='UPDATE' AND OLD.assessment_config IS NOT NULL AND NEW.assessment_config IS NULL THEN RAISE EXCEPTION 'assessment_identity_locked'; END IF;
 IF NEW.assessment_config IS NOT NULL THEN
 IF jsonb_typeof(NEW.assessment_config)<>'object' OR NEW.assessment_config->>'kind' IS DISTINCT FROM 'wellness_assessment' OR length(NEW.assessment_config::text)>150000 THEN RAISE EXCEPTION 'invalid_assessment'; END IF;
 IF public.has_blocked_claim(concat_ws(' ',NEW.assessment_config->>'title_en',NEW.assessment_config->>'title_es',NEW.assessment_config->>'description_en',NEW.assessment_config->>'description_es',NEW.assessment_config->'questions',NEW.assessment_config->'results')) THEN RAISE EXCEPTION 'blocked_claim'; END IF;
 IF TG_OP='UPDATE' AND (OLD.is_published OR EXISTS(SELECT 1 FROM assessment_receipts WHERE quiz_id=OLD.id)) AND (NEW.assessment_config IS DISTINCT FROM OLD.assessment_config OR NEW.assessment_scope_id IS DISTINCT FROM OLD.assessment_scope_id) THEN RAISE EXCEPTION 'assessment_history_locked'; END IF;
 IF NEW.is_published THEN
 PERFORM validate_assessment_config(NEW.assessment_config);
 IF NOT EXISTS(SELECT 1 FROM assessment_scope_versions s WHERE s.id=NEW.assessment_scope_id AND s.locale=NEW.assessment_config->>'language' AND s.retired_at IS NULL AND length(s.approval_reference)>0) THEN RAISE EXCEPTION 'approved_assessment_content_required'; END IF;
 END IF;
 END IF;
 ELSE IF EXISTS(SELECT 1 FROM quizzes WHERE id=NEW.quiz_id AND assessment_config IS NOT NULL) THEN RAISE EXCEPTION 'assessment_use_receipt'; END IF; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.complete_wellness_assessment(_quiz uuid,_request uuid,_revision integer,_scope uuid,_accepted boolean,_answers jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE z quizzes; receipt assessment_receipts; q jsonb; answer jsonb; chosen text[]; lo numeric; hi numeric; val numeric; total numeric:=0; weights numeric:=0; score integer; result jsonb; access_error text;
BEGIN
 IF auth.uid() IS NULL OR _request IS NULL THEN RAISE EXCEPTION 'not_allowed'; END IF;
 SELECT * INTO z FROM quizzes WHERE id=_quiz FOR UPDATE;
 IF NOT FOUND OR z.assessment_config IS NULL OR z.host_id=auth.uid() THEN RAISE EXCEPTION 'not_allowed'; END IF;
 access_error:=quiz_access_error(_quiz); IF access_error IS NOT NULL THEN RAISE EXCEPTION '%',access_error; END IF;
 IF z.assessment_revision<>_revision OR z.assessment_scope_id IS DISTINCT FROM _scope OR NOT _accepted OR NOT EXISTS(SELECT 1 FROM assessment_scope_versions WHERE id=_scope AND retired_at IS NULL) THEN RAISE EXCEPTION 'approved_assessment_content_required'; END IF;
 SELECT * INTO receipt FROM assessment_receipts WHERE quiz_id=_quiz AND user_id=auth.uid() AND request_id=_request;
 IF FOUND THEN RETURN jsonb_build_object('id',receipt.id,'score',receipt.score,'result',receipt.result_snapshot,'completed_at',receipt.completed_at); END IF;
 IF NOT coalesce((z.assessment_config->>'allow_retake')::boolean,false) AND EXISTS(SELECT 1 FROM assessment_receipts WHERE quiz_id=_quiz AND user_id=auth.uid()) THEN RAISE EXCEPTION 'retake_not_allowed'; END IF;
 IF (SELECT count(*) FROM assessment_receipts WHERE quiz_id=_quiz AND user_id=auth.uid() AND completed_at>now()-interval '1 hour')>=10 THEN RAISE EXCEPTION 'rate_limited'; END IF;
 PERFORM validate_assessment_config(z.assessment_config);
 IF jsonb_typeof(_answers) IS DISTINCT FROM 'object' OR length(_answers::text)>50000 OR EXISTS(SELECT 1 FROM jsonb_object_keys(_answers) k WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(z.assessment_config->'questions') q WHERE q->>'id'=k)) THEN RAISE EXCEPTION 'invalid_answers'; END IF;
 FOR q IN SELECT value FROM jsonb_array_elements(z.assessment_config->'questions') LOOP
 answer:=_answers->(q->>'id');
 IF q->>'type'='text' THEN IF answer IS NOT NULL AND (jsonb_typeof(answer)<>'string' OR length(answer#>>'{}')>2000) THEN RAISE EXCEPTION 'invalid_answers'; END IF; CONTINUE; END IF;
 IF jsonb_typeof(answer) IS DISTINCT FROM 'array' OR jsonb_array_length(answer)=0 OR (q->>'type'<>'multi' AND jsonb_array_length(answer)<>1) THEN RAISE EXCEPTION 'invalid_answers'; END IF;
 SELECT array_agg(x) INTO chosen FROM jsonb_array_elements_text(answer) x;
 IF cardinality(chosen)<>(SELECT count(DISTINCT x) FROM unnest(chosen) x) OR EXISTS(SELECT 1 FROM unnest(chosen) x WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(q->'options') o WHERE o->>'id'=x)) THEN RAISE EXCEPTION 'invalid_answers'; END IF;
 IF coalesce((q->>'scored')::boolean,false) THEN
 SELECT min((o->>'value')::numeric),max((o->>'value')::numeric) INTO lo,hi FROM jsonb_array_elements(q->'options') o;
 SELECT avg((o->>'value')::numeric) INTO val FROM jsonb_array_elements(q->'options') o WHERE o->>'id'=ANY(chosen);
 total:=total+(val-lo)/(hi-lo)*100*(q->>'weight')::numeric; weights:=weights+(q->>'weight')::numeric;
 END IF;
 END LOOP;
 IF weights>0 THEN score:=round(total/weights); SELECT value INTO result FROM jsonb_array_elements(z.assessment_config->'results') WHERE score BETWEEN (value->>'min')::integer AND (value->>'max')::integer; END IF;
 INSERT INTO assessment_receipts(quiz_id,user_id,request_id,revision,scope_id,answers,config_snapshot,score,result_snapshot) VALUES(_quiz,auth.uid(),_request,z.assessment_revision,_scope,_answers,z.assessment_config,score,result) RETURNING * INTO receipt;
 IF z.lesson_id IS NOT NULL THEN INSERT INTO lesson_progress(user_id,lesson_id,started_at,completed_at) VALUES(auth.uid(),z.lesson_id,now(),now()) ON CONFLICT(user_id,lesson_id) DO UPDATE SET completed_at=coalesce(lesson_progress.completed_at,now()); END IF;
 RETURN jsonb_build_object('id',receipt.id,'score',receipt.score,'result',receipt.result_snapshot,'completed_at',receipt.completed_at);
END $$;
REVOKE ALL ON FUNCTION public.complete_wellness_assessment(uuid,uuid,integer,uuid,boolean,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.complete_wellness_assessment(uuid,uuid,integer,uuid,boolean,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.assessment_for_learner(_quiz uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ DECLARE z quizzes; e text; BEGIN
 e:=quiz_access_error(_quiz); IF e IS NOT NULL THEN RAISE EXCEPTION '%',e; END IF;
 SELECT * INTO z FROM quizzes WHERE id=_quiz AND assessment_config IS NOT NULL;
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF NOT EXISTS(SELECT 1 FROM assessment_scope_versions WHERE id=z.assessment_scope_id AND retired_at IS NULL) THEN RAISE EXCEPTION 'approved_assessment_content_required'; END IF;
 RETURN jsonb_build_object('config',z.assessment_config,'revision',z.assessment_revision,'scope',(SELECT jsonb_build_object('id',id,'version',version,'text',document_text) FROM assessment_scope_versions WHERE id=z.assessment_scope_id),'history',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'score',score,'result',result_snapshot,'completed_at',completed_at) ORDER BY completed_at DESC,id) FROM assessment_receipts WHERE quiz_id=_quiz AND user_id=auth.uid()),'[]'::jsonb)); END $$;
REVOKE ALL ON FUNCTION public.assessment_for_learner(uuid) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.assessment_for_learner(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.bind_course_assessment(_quiz uuid,_track uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE z quizzes; tr tracks; l uuid; BEGIN
 SELECT * INTO tr FROM tracks WHERE id=_track FOR UPDATE;
 SELECT * INTO z FROM quizzes WHERE id=_quiz FOR UPDATE;
 IF auth.uid() IS NULL OR z.host_id IS DISTINCT FROM auth.uid() OR z.assessment_config IS NULL OR z.offer_id IS DISTINCT FROM tr.offer_id OR NOT EXISTS(SELECT 1 FROM offers WHERE id=tr.offer_id AND host_id=auth.uid() AND kind='course') THEN RAISE EXCEPTION 'not_allowed'; END IF;
 IF z.lesson_id IS NOT NULL THEN RETURN z.lesson_id; END IF;
 INSERT INTO lessons(track_id,title_en,title_es,type,sort_order,is_published,resource_quiz_id) VALUES(_track,z.title_en,z.title_es,'text',coalesce((SELECT max(sort_order)+1 FROM lessons WHERE track_id=_track),1),false,z.id) RETURNING id INTO l;
 UPDATE quizzes SET lesson_id=l WHERE id=_quiz;
 RETURN l; END $$;
REVOKE ALL ON FUNCTION public.bind_course_assessment(uuid,uuid) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.bind_course_assessment(uuid,uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.detach_course_curriculum(_course uuid,_track uuid,_lesson uuid DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 PERFORM 1 FROM offers WHERE id=_course AND host_id=auth.uid() AND kind='course' FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'not_allowed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM tracks WHERE id=_track AND offer_id=_course) OR (_lesson IS NOT NULL AND NOT EXISTS(SELECT 1 FROM lessons WHERE id=_lesson AND track_id=_track)) THEN RAISE EXCEPTION 'not_allowed'; END IF;
 UPDATE lessons SET detached_at=coalesce(detached_at,now()),is_published=false WHERE track_id=_track AND (_lesson IS NULL OR id=_lesson);
 IF _lesson IS NULL THEN UPDATE tracks SET is_published=false WHERE id=_track; END IF;
 UPDATE offers SET curriculum_revision=curriculum_revision+1 WHERE id=_course;
END $$;
REVOKE ALL ON FUNCTION public.detach_course_curriculum(uuid,uuid,uuid) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.detach_course_curriculum(uuid,uuid,uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.reorder_course_curriculum_checked(_course uuid,_track uuid,_ids uuid[],_expected uuid[]) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE actual uuid[]; BEGIN
 PERFORM 1 FROM offers WHERE id=_course AND host_id=auth.uid() FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'not_allowed'; END IF;
 IF _track IS NULL THEN SELECT coalesce(array_agg(id ORDER BY sort_order,created_at,id),'{}') INTO actual FROM tracks WHERE offer_id=_course; ELSE SELECT coalesce(array_agg(id ORDER BY sort_order,created_at,id),'{}') INTO actual FROM lessons WHERE track_id=_track; END IF;
 IF actual IS DISTINCT FROM _expected THEN RAISE EXCEPTION 'curriculum_changed'; END IF;
 PERFORM reorder_course_curriculum(_course,_track,_ids); UPDATE offers SET curriculum_revision=curriculum_revision+1 WHERE id=_course;
END $$;
REVOKE ALL ON FUNCTION public.reorder_course_curriculum_checked(uuid,uuid,uuid[],uuid[]) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.reorder_course_curriculum_checked(uuid,uuid,uuid[],uuid[]) TO authenticated;
CREATE OR REPLACE FUNCTION public.guard_assessment_manual_progress() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NEW.completed_at IS NOT NULL AND EXISTS(SELECT 1 FROM quizzes q WHERE q.lesson_id=NEW.lesson_id AND q.assessment_config IS NOT NULL AND NOT EXISTS(SELECT 1 FROM assessment_receipts r WHERE r.quiz_id=q.id AND r.user_id=NEW.user_id)) THEN RAISE EXCEPTION 'assessment_completion_required'; END IF; RETURN NEW; END $$;
CREATE TRIGGER assessment_progress_guard BEFORE INSERT OR UPDATE ON public.lesson_progress FOR EACH ROW EXECUTE FUNCTION public.guard_assessment_manual_progress();