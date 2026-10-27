CREATE OR REPLACE FUNCTION public.assessment_required_fields_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ DECLARE q jsonb; o jsonb; r jsonb; c jsonb; BEGIN
 c:=NEW.assessment_config; IF c IS NULL OR NOT NEW.is_published THEN RETURN NEW; END IF;
 IF c->>'language' IS NULL OR c->>'language' NOT IN('en','es') OR jsonb_typeof(c->'allow_retake') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'invalid_assessment'; END IF;
 FOR q IN SELECT value FROM jsonb_array_elements(c->'questions') LOOP
 IF q->>'type' IS NULL OR jsonb_typeof(q->'scored') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'invalid_questions'; END IF;
 IF (q->>'scored')::boolean AND (jsonb_typeof(q->'weight') IS DISTINCT FROM 'number' OR (q->>'weight')::numeric NOT BETWEEN 0.1 AND 100) THEN RAISE EXCEPTION 'invalid_weights'; END IF;
 FOR o IN SELECT value FROM jsonb_array_elements(coalesce(q->'options','[]')) LOOP IF jsonb_typeof(o->'value') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'invalid_options'; END IF; END LOOP;
 END LOOP;
 FOR r IN SELECT value FROM jsonb_array_elements(c->'results') LOOP IF jsonb_typeof(r->'min') IS DISTINCT FROM 'number' OR jsonb_typeof(r->'max') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'invalid_ranges'; END IF; END LOOP;
 RETURN NEW; END $$;
CREATE TRIGGER assessment_required_fields BEFORE INSERT OR UPDATE ON public.quizzes FOR EACH ROW EXECUTE FUNCTION public.assessment_required_fields_guard();
CREATE OR REPLACE FUNCTION public.credit_course_assessment_receipt(_lesson uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE l lessons; q quizzes; BEGIN
 SELECT * INTO l FROM lessons WHERE id=_lesson AND detached_at IS NULL AND is_published FOR UPDATE;
 IF auth.uid() IS NULL OR NOT FOUND OR NOT can_read_track(l.track_id) OR NOT lesson_is_unlocked(l.id) THEN RAISE EXCEPTION 'not_allowed'; END IF;
 SELECT * INTO q FROM quizzes WHERE (id=l.resource_quiz_id OR lesson_id=l.id) AND assessment_config IS NOT NULL LIMIT 1;
 IF NOT FOUND OR quiz_access_error(q.id) IS NOT NULL OR NOT EXISTS(SELECT 1 FROM assessment_receipts WHERE quiz_id=q.id AND user_id=auth.uid()) THEN RAISE EXCEPTION 'assessment_completion_required'; END IF;
 INSERT INTO lesson_progress(user_id,lesson_id,started_at,completed_at) VALUES(auth.uid(),l.id,now(),now()) ON CONFLICT(user_id,lesson_id) DO UPDATE SET completed_at=coalesce(lesson_progress.completed_at,now()); END $$;
REVOKE ALL ON FUNCTION public.credit_course_assessment_receipt(uuid) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.credit_course_assessment_receipt(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.course_lesson_quiz(_lesson uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT jsonb_build_object('id',q.id,'assessment',q.assessment_config IS NOT NULL) FROM lessons l JOIN tracks t ON t.id=l.track_id JOIN quizzes q ON q.lesson_id=l.id OR q.id=l.resource_quiz_id WHERE l.id=_lesson AND l.detached_at IS NULL AND l.is_published AND q.is_published AND can_read_track(t.id) AND lesson_is_unlocked(l.id) AND quiz_access_error(q.id) IS NULL LIMIT 1; $$;
DO $$ DECLARE d text; BEGIN
 SELECT pg_get_functiondef('public.cancel_challenge_checkout_verified(uuid,uuid,text)'::regprocedure) INTO d; d:=replace(d,'o.stripe_checkout_session_id IS DISTINCT FROM _session','o.stripe_checkout_session_id IS DISTINCT FROM nullif(_session,'''')'); d:=replace(d,'IF _session IS NULL','IF nullif(_session,'''') IS NULL'); EXECUTE d;
 SELECT pg_get_functiondef('public.attach_course_resource(uuid,text,uuid)'::regprocedure) INTO d;
 d:=replace(d,'INSERT INTO lessons(track_id,type,title_en','SELECT id INTO l FROM lessons WHERE track_id=_track AND detached_at IS NULL AND ((_kind=''quiz'' AND resource_quiz_id=_resource) OR (_kind=''offer'' AND resource_offer_id=_resource) OR (_kind=''recipe'' AND resource_recipe_id=_resource)); IF FOUND THEN RETURN l; END IF; INSERT INTO lessons(track_id,type,title_en'); EXECUTE d;
END $$;