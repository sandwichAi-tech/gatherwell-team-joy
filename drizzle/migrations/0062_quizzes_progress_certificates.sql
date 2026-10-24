-- 0062: course quizzes, learner progress, completion rules, certificates (additive).

CREATE TABLE public.quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  lesson_id uuid REFERENCES public.lessons(id) ON DELETE CASCADE, -- null = course final
  title_en text NOT NULL DEFAULT '',
  title_es text NOT NULL DEFAULT '',
  instructions_en text,
  instructions_es text,
  pass_pct integer NOT NULL DEFAULT 80 CHECK (pass_pct BETWEEN 1 AND 100),
  attempts_allowed integer CHECK (attempts_allowed IS NULL OR attempts_allowed > 0), -- null = unlimited
  cooldown_minutes integer NOT NULL DEFAULT 0 CHECK (cooldown_minutes >= 0),
  time_limit_minutes integer CHECK (time_limit_minutes IS NULL OR time_limit_minutes > 0),
  is_required boolean NOT NULL DEFAULT false,
  show_score boolean NOT NULL DEFAULT true,
  reveal_answers text NOT NULL DEFAULT 'after_pass' CHECK (reveal_answers IN ('never','after_pass','always')),
  randomize_questions boolean NOT NULL DEFAULT false,
  randomize_answers boolean NOT NULL DEFAULT false,
  is_published boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quizzes TO authenticated;
GRANT ALL ON public.quizzes TO service_role;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
CREATE POLICY quizzes_host ON public.quizzes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.offers o WHERE o.id = offer_id AND o.host_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.offers o WHERE o.id = offer_id AND o.host_id = auth.uid()));

CREATE TABLE public.quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('single','multi','truefalse','short')),
  prompt_en text NOT NULL DEFAULT '',
  prompt_es text NOT NULL DEFAULT '',
  points numeric NOT NULL DEFAULT 1 CHECK (points > 0),
  sort_order integer NOT NULL DEFAULT 0,
  accepted_answers text[], -- secret: short-answer keys
  allow_manual boolean NOT NULL DEFAULT false, -- short answer graded by host
  explanation_en text, -- secret scoring note
  explanation_es text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_questions TO authenticated;
GRANT ALL ON public.quiz_questions TO service_role;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY quiz_questions_host ON public.quiz_questions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.quizzes q JOIN public.offers o ON o.id = q.offer_id WHERE q.id = quiz_id AND o.host_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.quizzes q JOIN public.offers o ON o.id = q.offer_id WHERE q.id = quiz_id AND o.host_id = auth.uid()));

CREATE TABLE public.quiz_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.quiz_questions(id) ON DELETE CASCADE,
  label_en text NOT NULL DEFAULT '',
  label_es text NOT NULL DEFAULT '',
  is_correct boolean NOT NULL DEFAULT false, -- secret
  sort_order integer NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_options TO authenticated;
GRANT ALL ON public.quiz_options TO service_role;
ALTER TABLE public.quiz_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY quiz_options_host ON public.quiz_options FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.quiz_questions qq JOIN public.quizzes q ON q.id = qq.quiz_id JOIN public.offers o ON o.id = q.offer_id WHERE qq.id = question_id AND o.host_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.quiz_questions qq JOIN public.quizzes q ON q.id = qq.quiz_id JOIN public.offers o ON o.id = q.offer_id WHERE qq.id = question_id AND o.host_id = auth.uid()));

CREATE TABLE public.quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  attempt_no integer NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  deadline timestamptz,
  submitted_at timestamptz,
  submitted_late boolean NOT NULL DEFAULT false,
  score_pct numeric,
  passed boolean,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','awaiting_manual','graded')),
  UNIQUE (quiz_id, user_id, attempt_no)
);
GRANT SELECT ON public.quiz_attempts TO authenticated; -- writes only via RPCs
GRANT ALL ON public.quiz_attempts TO service_role;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY quiz_attempts_owner ON public.quiz_attempts FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY quiz_attempts_host ON public.quiz_attempts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.quizzes q JOIN public.offers o ON o.id = q.offer_id WHERE q.id = quiz_id AND o.host_id = auth.uid()));

CREATE TABLE public.quiz_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES public.quiz_attempts(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.quiz_questions(id) ON DELETE CASCADE,
  selected uuid[],
  text_answer text,
  points_awarded numeric,
  needs_manual boolean NOT NULL DEFAULT false,
  UNIQUE (attempt_id, question_id)
);
GRANT SELECT ON public.quiz_responses TO authenticated; -- writes only via RPCs
GRANT ALL ON public.quiz_responses TO service_role;
ALTER TABLE public.quiz_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY quiz_responses_owner ON public.quiz_responses FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.quiz_attempts a WHERE a.id = attempt_id AND a.user_id = auth.uid()));
CREATE POLICY quiz_responses_host ON public.quiz_responses FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.quiz_attempts a JOIN public.quizzes q ON q.id = a.quiz_id JOIN public.offers o ON o.id = q.offer_id WHERE a.id = attempt_id AND o.host_id = auth.uid()));

ALTER TABLE public.lesson_progress ADD COLUMN started_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.offers
  ADD COLUMN completion_require_lessons boolean NOT NULL DEFAULT true,
  ADD COLUMN completion_require_quizzes boolean NOT NULL DEFAULT true,
  ADD COLUMN certificate_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN cert_title text,
  ADD COLUMN cert_issuer text,
  ADD COLUMN cert_signer_name text,
  ADD COLUMN cert_signer_title text,
  ADD COLUMN cert_statement text,
  ADD COLUMN cert_expiry_months integer CHECK (cert_expiry_months IS NULL OR cert_expiry_months > 0);

CREATE TABLE public.certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  cert_number text NOT NULL UNIQUE,
  learner_name text NOT NULL,
  course_title text NOT NULL,
  issuer_name text NOT NULL,
  signer_name text,
  signer_title text,
  statement text,
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  revoke_reason text,
  UNIQUE (offer_id, user_id)
);
GRANT SELECT ON public.certificates TO authenticated; -- issue/revoke only via RPCs
GRANT ALL ON public.certificates TO service_role;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
CREATE POLICY certificates_owner ON public.certificates FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY certificates_host ON public.certificates FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.offers o WHERE o.id = offer_id AND o.host_id = auth.uid()));

-- Publish gate: explicit answer keys and point values required.
CREATE OR REPLACE FUNCTION public.quiz_blockers(_quiz uuid)
RETURNS text[]
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE b text[] := '{}'; z public.quizzes; n int;
BEGIN
  SELECT * INTO z FROM public.quizzes WHERE id = _quiz;
  IF NOT FOUND THEN RETURN array_append(b, 'not_found'); END IF;
  IF length(trim(coalesce(z.title_en,''))) = 0 AND length(trim(coalesce(z.title_es,''))) = 0 THEN b := array_append(b, 'missing_title'); END IF;
  SELECT count(*) INTO n FROM public.quiz_questions WHERE quiz_id = _quiz;
  IF n = 0 THEN b := array_append(b, 'no_questions'); END IF;
  IF EXISTS (SELECT 1 FROM public.quiz_questions qq WHERE qq.quiz_id = _quiz AND (length(trim(coalesce(qq.prompt_en,''))) = 0 AND length(trim(coalesce(qq.prompt_es,''))) = 0)) THEN b := array_append(b, 'missing_prompt'); END IF;
  IF EXISTS (SELECT 1 FROM public.quiz_questions qq WHERE qq.quiz_id = _quiz AND qq.type IN ('single','truefalse') AND (SELECT count(*) FROM public.quiz_options o WHERE o.question_id = qq.id AND o.is_correct) <> 1) THEN b := array_append(b, 'missing_key'); END IF;
  IF EXISTS (SELECT 1 FROM public.quiz_questions qq WHERE qq.quiz_id = _quiz AND qq.type = 'multi' AND (SELECT count(*) FROM public.quiz_options o WHERE o.question_id = qq.id AND o.is_correct) < 1) THEN b := array_append(b, 'missing_key'); END IF;
  IF EXISTS (SELECT 1 FROM public.quiz_questions qq WHERE qq.quiz_id = _quiz AND qq.type IN ('single','multi','truefalse') AND (SELECT count(*) FROM public.quiz_options o WHERE o.question_id = qq.id) < 2) THEN b := array_append(b, 'missing_options'); END IF;
  IF EXISTS (SELECT 1 FROM public.quiz_questions qq WHERE qq.quiz_id = _quiz AND qq.type = 'short' AND NOT qq.allow_manual AND (qq.accepted_answers IS NULL OR cardinality(qq.accepted_answers) = 0)) THEN b := array_append(b, 'missing_key'); END IF;
  RETURN b;
END;
$function$;

CREATE OR REPLACE FUNCTION public.quiz_enforce_publish()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.is_published AND (OLD.is_published IS DISTINCT FROM true) THEN
    IF cardinality(public.quiz_blockers(NEW.id)) > 0 THEN RAISE EXCEPTION 'quiz_not_ready'; END IF;
  END IF;
  RETURN NEW;
END;
$function$;
CREATE TRIGGER quiz_publish_gate BEFORE INSERT OR UPDATE ON public.quizzes FOR EACH ROW EXECUTE FUNCTION public.quiz_enforce_publish();

-- Access check: entitled learner, published quiz/offer/lesson, prerequisites met.
CREATE OR REPLACE FUNCTION public.quiz_access_error(_quiz uuid)
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE z public.quizzes; o public.offers; l public.lessons;
BEGIN
  SELECT * INTO z FROM public.quizzes WHERE id = _quiz AND is_published;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  SELECT * INTO o FROM public.offers WHERE id = z.offer_id;
  IF o.status <> 'published' AND o.host_id <> auth.uid() THEN RETURN 'not_found'; END IF;
  IF o.host_id <> auth.uid() AND NOT public.can_access_offer(o.id) THEN RETURN 'no_access'; END IF;
  IF z.lesson_id IS NOT NULL THEN
    SELECT * INTO l FROM public.lessons WHERE id = z.lesson_id;
    IF l IS NULL OR NOT l.is_published THEN RETURN 'not_found'; END IF;
    IF l.prerequisite_lesson_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.lesson_progress lp WHERE lp.lesson_id = l.prerequisite_lesson_id AND lp.user_id = auth.uid() AND lp.completed_at IS NOT NULL
    ) THEN RETURN 'prerequisite'; END IF;
  ELSE
    -- course final: all published required lessons complete
    IF EXISTS (
      SELECT 1 FROM public.lessons l2 JOIN public.tracks t ON t.id = l2.track_id
      WHERE t.offer_id = z.offer_id AND t.is_published AND l2.is_published
        AND NOT EXISTS (SELECT 1 FROM public.lesson_progress lp WHERE lp.lesson_id = l2.id AND lp.user_id = auth.uid() AND lp.completed_at IS NOT NULL)
    ) THEN RETURN 'prerequisite'; END IF;
  END IF;
  RETURN NULL;
END;
$function$;

-- Learner-facing quiz payload: never includes answer keys, accepted answers, or explanations.
CREATE OR REPLACE FUNCTION public.get_quiz_for_taker(_quiz uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE z public.quizzes; err text; att public.quiz_attempts; used int; last_submit timestamptz; qs jsonb;
BEGIN
  err := public.quiz_access_error(_quiz);
  IF err IS NOT NULL THEN RETURN jsonb_build_object('error', err); END IF;
  SELECT * INTO z FROM public.quizzes WHERE id = _quiz;
  SELECT count(*), max(submitted_at) INTO used, last_submit FROM public.quiz_attempts WHERE quiz_id = _quiz AND user_id = auth.uid() AND submitted_at IS NOT NULL;
  SELECT * INTO att FROM public.quiz_attempts WHERE quiz_id = _quiz AND user_id = auth.uid() AND status = 'in_progress' ORDER BY attempt_no DESC LIMIT 1;
  SELECT jsonb_agg(jsonb_build_object(
      'id', qq.id, 'type', qq.type, 'points', qq.points,
      'prompt_en', qq.prompt_en, 'prompt_es', qq.prompt_es,
      'options', (SELECT jsonb_agg(jsonb_build_object('id', o.id, 'label_en', o.label_en, 'label_es', o.label_es) ORDER BY CASE WHEN z.randomize_answers THEN random() ELSE o.sort_order END) FROM public.quiz_options o WHERE o.question_id = qq.id)
    ) ORDER BY CASE WHEN z.randomize_questions THEN random() ELSE qq.sort_order END) INTO qs
  FROM public.quiz_questions qq WHERE qq.quiz_id = _quiz;
  RETURN jsonb_build_object(
    'quiz', jsonb_build_object('id', z.id, 'offer_id', z.offer_id, 'lesson_id', z.lesson_id, 'title_en', z.title_en, 'title_es', z.title_es,
      'instructions_en', z.instructions_en, 'instructions_es', z.instructions_es, 'pass_pct', z.pass_pct,
      'attempts_allowed', z.attempts_allowed, 'cooldown_minutes', z.cooldown_minutes, 'time_limit_minutes', z.time_limit_minutes,
      'is_required', z.is_required, 'show_score', z.show_score),
    'questions', coalesce(qs, '[]'::jsonb),
    'attempts_used', used,
    'cooldown_until', CASE WHEN z.cooldown_minutes > 0 AND last_submit IS NOT NULL THEN last_submit + make_interval(mins => z.cooldown_minutes) END,
    'can_start', (z.attempts_allowed IS NULL OR used < z.attempts_allowed) AND (z.cooldown_minutes = 0 OR last_submit IS NULL OR last_submit + make_interval(mins => z.cooldown_minutes) <= now()),
    'active_attempt', CASE WHEN att.id IS NULL THEN NULL ELSE jsonb_build_object('id', att.id, 'attempt_no', att.attempt_no, 'deadline', att.deadline,
      'responses', (SELECT coalesce(jsonb_object_agg(r.question_id, jsonb_build_object('selected', r.selected, 'text_answer', r.text_answer)), '{}'::jsonb) FROM public.quiz_responses r WHERE r.attempt_id = att.id)
    ) END);
END;
$function$;

CREATE OR REPLACE FUNCTION public.start_quiz_attempt(_quiz uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE z public.quizzes; err text; att public.quiz_attempts; used int; last_submit timestamptz; next_no int;
BEGIN
  err := public.quiz_access_error(_quiz);
  IF err IS NOT NULL THEN RAISE EXCEPTION '%', err; END IF;
  SELECT * INTO z FROM public.quizzes WHERE id = _quiz;
  SELECT * INTO att FROM public.quiz_attempts WHERE quiz_id = _quiz AND user_id = auth.uid() AND status = 'in_progress' ORDER BY attempt_no DESC LIMIT 1;
  IF att.id IS NOT NULL THEN RETURN jsonb_build_object('attempt_id', att.id, 'attempt_no', att.attempt_no, 'deadline', att.deadline, 'resumed', true); END IF;
  SELECT count(*), max(submitted_at) INTO used, last_submit FROM public.quiz_attempts WHERE quiz_id = _quiz AND user_id = auth.uid() AND submitted_at IS NOT NULL;
  IF z.attempts_allowed IS NOT NULL AND used >= z.attempts_allowed THEN RAISE EXCEPTION 'attempts_exhausted'; END IF;
  IF z.cooldown_minutes > 0 AND last_submit IS NOT NULL AND last_submit + make_interval(mins => z.cooldown_minutes) > now() THEN RAISE EXCEPTION 'cooldown'; END IF;
  next_no := used + 1;
  INSERT INTO public.quiz_attempts (quiz_id, user_id, attempt_no, deadline)
  VALUES (_quiz, auth.uid(), next_no, CASE WHEN z.time_limit_minutes IS NOT NULL THEN now() + make_interval(mins => z.time_limit_minutes) END)
  RETURNING * INTO att;
  RETURN jsonb_build_object('attempt_id', att.id, 'attempt_no', att.attempt_no, 'deadline', att.deadline, 'resumed', false);
END;
$function$;

CREATE OR REPLACE FUNCTION public.save_quiz_response(_attempt uuid, _question uuid, _selected uuid[], _text text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE att public.quiz_attempts;
BEGIN
  SELECT * INTO att FROM public.quiz_attempts WHERE id = _attempt AND user_id = auth.uid() AND status = 'in_progress';
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF att.deadline IS NOT NULL AND now() > att.deadline + interval '60 seconds' THEN RAISE EXCEPTION 'time_expired'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.quiz_questions WHERE id = _question AND quiz_id = att.quiz_id) THEN RAISE EXCEPTION 'not_found'; END IF;
  INSERT INTO public.quiz_responses (attempt_id, question_id, selected, text_answer)
  VALUES (_attempt, _question, _selected, left(coalesce(_text,''), 2000))
  ON CONFLICT (attempt_id, question_id) DO UPDATE SET selected = EXCLUDED.selected, text_answer = EXCLUDED.text_answer;
END;
$function$;

-- Idempotent submit: grades objective questions server-side; clients never send scores.
CREATE OR REPLACE FUNCTION public.submit_quiz(_attempt uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE att public.quiz_attempts; z public.quizzes; q record; r public.quiz_responses; awarded numeric; total numeric := 0; earned numeric := 0; any_manual boolean := false; corr uuid[]; late boolean := false;
BEGIN
  SELECT * INTO att FROM public.quiz_attempts WHERE id = _attempt AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF att.status <> 'in_progress' THEN
    RETURN jsonb_build_object('attempt_id', att.id, 'status', att.status, 'score_pct', att.score_pct, 'passed', att.passed, 'idempotent', true);
  END IF;
  SELECT * INTO z FROM public.quizzes WHERE id = att.quiz_id;
  IF att.deadline IS NOT NULL AND now() > att.deadline + interval '60 seconds' THEN late := true; END IF;
  FOR q IN SELECT * FROM public.quiz_questions WHERE quiz_id = att.quiz_id LOOP
    total := total + q.points;
    SELECT * INTO r FROM public.quiz_responses WHERE attempt_id = att.id AND question_id = q.id;
    awarded := 0;
    IF q.type = 'short' THEN
      IF q.allow_manual AND (q.accepted_answers IS NULL OR cardinality(q.accepted_answers) = 0) THEN
        any_manual := true;
        INSERT INTO public.quiz_responses (attempt_id, question_id, needs_manual) VALUES (att.id, q.id, true)
          ON CONFLICT (attempt_id, question_id) DO UPDATE SET needs_manual = true;
      ELSIF r.id IS NOT NULL AND r.text_answer IS NOT NULL AND EXISTS (
        SELECT 1 FROM unnest(q.accepted_answers) a WHERE lower(regexp_replace(trim(a), '\s+', ' ', 'g')) = lower(regexp_replace(trim(r.text_answer), '\s+', ' ', 'g'))
      ) THEN awarded := q.points; END IF;
    ELSE
      SELECT coalesce(array_agg(o.id ORDER BY o.id), '{}') INTO corr FROM public.quiz_options o WHERE o.question_id = q.id AND o.is_correct;
      IF r.id IS NOT NULL AND r.selected IS NOT NULL AND coalesce(array_agg_sel, '{}') IS NOT NULL AND (SELECT coalesce(array_agg(x ORDER BY x), '{}') FROM unnest(r.selected) x) = corr THEN awarded := q.points; END IF;
    END IF;
    earned := earned + awarded;
    INSERT INTO public.quiz_responses (attempt_id, question_id, points_awarded) VALUES (att.id, q.id, awarded)
      ON CONFLICT (attempt_id, question_id) DO UPDATE SET points_awarded = EXCLUDED.points_awarded;
  END LOOP;
  UPDATE public.quiz_attempts SET submitted_at = now(), submitted_late = late,
    score_pct = CASE WHEN total > 0 THEN round(earned / total * 100, 2) END,
    passed = CASE WHEN total > 0 THEN round(earned / total * 100, 2) >= z.pass_pct END,
    status = CASE WHEN any_manual THEN 'awaiting_manual' ELSE 'graded' END
  WHERE id = att.id RETURNING * INTO att;
  RETURN jsonb_build_object('attempt_id', att.id, 'status', att.status, 'score_pct', att.score_pct, 'passed', att.passed, 'idempotent', false);
END;
$function$;

-- Host manual grading of short answers; recomputes the attempt.
CREATE OR REPLACE FUNCTION public.grade_quiz_response(_response uuid, _points numeric)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r public.quiz_responses; att public.quiz_attempts; z public.quizzes; q public.quiz_questions; total numeric; earned numeric; remaining int;
BEGIN
  SELECT * INTO r FROM public.quiz_responses WHERE id = _response;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  SELECT * INTO att FROM public.quiz_attempts WHERE id = r.attempt_id;
  SELECT * INTO z FROM public.quizzes WHERE id = att.quiz_id;
  IF NOT EXISTS (SELECT 1 FROM public.offers o WHERE o.id = z.offer_id AND o.host_id = auth.uid()) THEN RAISE EXCEPTION 'not_found'; END IF;
  SELECT * INTO q FROM public.quiz_questions WHERE id = r.question_id;
  IF _points < 0 OR _points > q.points THEN RAISE EXCEPTION 'invalid_points'; END IF;
  UPDATE public.quiz_responses SET points_awarded = _points, needs_manual = false WHERE id = _response;
  SELECT sum(qq.points), coalesce(sum(rr.points_awarded), 0), count(*) FILTER (WHERE rr.needs_manual) INTO total, earned, remaining
  FROM public.quiz_questions qq LEFT JOIN public.quiz_responses rr ON rr.question_id = qq.id AND rr.attempt_id = att.id
  WHERE qq.quiz_id = att.quiz_id;
  UPDATE public.quiz_attempts SET
    score_pct = CASE WHEN total > 0 THEN round(earned / total * 100, 2) END,
    passed = CASE WHEN total > 0 THEN round(earned / total * 100, 2) >= z.pass_pct END,
    status = CASE WHEN remaining > 0 THEN 'awaiting_manual' ELSE 'graded' END
  WHERE id = att.id RETURNING * INTO att;
  RETURN jsonb_build_object('attempt_id', att.id, 'status', att.status, 'score_pct', att.score_pct, 'passed', att.passed);
END;
$function$;

-- Attempt history with permitted feedback only.
CREATE OR REPLACE FUNCTION public.my_quiz_attempts(_quiz uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE z public.quizzes; reveal boolean;
BEGIN
  SELECT * INTO z FROM public.quizzes WHERE id = _quiz;
  IF NOT FOUND THEN RETURN '[]'::jsonb; END IF;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object(
    'id', a.id, 'attempt_no', a.attempt_no, 'started_at', a.started_at, 'submitted_at', a.submitted_at,
    'status', a.status,
    'score_pct', CASE WHEN z.show_score OR o.host_id = auth.uid() THEN a.score_pct END,
    'passed', CASE WHEN z.show_score OR o.host_id = auth.uid() THEN a.passed END
  ) ORDER BY a.attempt_no) FROM public.quiz_attempts a JOIN public.quizzes q2 ON q2.id = a.quiz_id JOIN public.offers o ON o.id = q2.offer_id
  WHERE a.quiz_id = _quiz AND a.user_id = auth.uid() AND a.submitted_at IS NOT NULL), '[]'::jsonb);
END;
$function$;

-- Progress: lesson started/completed (entitlement-checked).
CREATE OR REPLACE FUNCTION public.set_lesson_progress(_lesson uuid, _completed boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE t public.tracks;
BEGIN
  SELECT * INTO t FROM public.tracks t2 JOIN public.lessons l ON l.track_id = t2.id WHERE l.id = _lesson LIMIT 1;
  IF t.id IS NULL OR t.offer_id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF NOT public.can_access_offer(t.offer_id) THEN RAISE EXCEPTION 'no_access'; END IF;
  INSERT INTO public.lesson_progress (user_id, lesson_id, started_at, completed_at)
  VALUES (auth.uid(), _lesson, now(), CASE WHEN _completed THEN now() END)
  ON CONFLICT (user_id, lesson_id) DO UPDATE SET completed_at = CASE WHEN _completed THEN coalesce(lesson_progress.completed_at, now()) ELSE NULL END;
END;
$function$;

-- Caller-scoped course progress.
CREATE OR REPLACE FUNCTION public.course_progress(_offer uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE o public.offers; n_lessons int; done_lessons int; n_req_quizzes int; passed_quizzes int; last timestamptz; pct numeric; complete boolean;
BEGIN
  SELECT * INTO o FROM public.offers WHERE id = _offer;
  IF NOT FOUND OR NOT public.can_access_offer(_offer) THEN RETURN jsonb_build_object('error', 'not_found'); END IF;
  SELECT count(*), count(*) FILTER (WHERE lp.completed_at IS NOT NULL), max(greatest(lp.started_at, lp.completed_at)) INTO n_lessons, done_lessons, last
  FROM public.lessons l JOIN public.tracks t ON t.id = l.track_id
  LEFT JOIN public.lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = auth.uid()
  WHERE t.offer_id = _offer AND t.is_published AND l.is_published;
  SELECT count(*), count(*) FILTER (WHERE ok.passed) INTO n_req_quizzes, passed_quizzes
  FROM public.quizzes qz LEFT JOIN LATERAL (
    SELECT bool_or(a.passed) AS passed FROM public.quiz_attempts a WHERE a.quiz_id = qz.id AND a.user_id = auth.uid() AND a.submitted_at IS NOT NULL
  ) ok ON true
  WHERE qz.offer_id = _offer AND qz.is_published AND qz.is_required;
  pct := CASE WHEN n_lessons + n_req_quizzes = 0 THEN 0 ELSE round((
    (CASE WHEN o.completion_require_lessons THEN done_lessons ELSE 0 END + CASE WHEN o.completion_require_quizzes THEN passed_quizzes ELSE 0 END)::numeric
    / (CASE WHEN o.completion_require_lessons THEN n_lessons ELSE 0 END + CASE WHEN o.completion_require_quizzes THEN n_req_quizzes ELSE 0 END)
  ) * 100, 0) END;
  complete := (NOT o.completion_require_lessons OR n_lessons = 0 OR done_lessons >= n_lessons)
    AND (NOT o.completion_require_quizzes OR n_req_quizzes = 0 OR passed_quizzes >= n_req_quizzes)
    AND (n_lessons > 0 OR n_req_quizzes > 0);
  RETURN jsonb_build_object('lessons', n_lessons, 'lessons_done', done_lessons, 'quizzes_required', n_req_quizzes, 'quizzes_passed', passed_quizzes,
    'percent', coalesce(pct, 0), 'complete', complete, 'last_activity', last);
END;
$function$;

-- Host-only per-learner progress for their own courses.
CREATE OR REPLACE FUNCTION public.offer_learner_progress(_offer uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.offers WHERE id = _offer AND host_id = auth.uid()) THEN RAISE EXCEPTION 'not_found'; END IF;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('user_id', u.user_id, 'name', p.full_name, 'lessons_done', u.done, 'percent',
    CASE WHEN u.total > 0 THEN round(u.done::numeric / u.total * 100, 0) ELSE 0 END, 'last_activity', u.last) ORDER BY u.last DESC NULLS LAST)
  FROM (
    SELECT lp.user_id, count(*) FILTER (WHERE lp.completed_at IS NOT NULL) AS done, count(*) AS total, max(greatest(lp.started_at, lp.completed_at)) AS last
    FROM public.lesson_progress lp JOIN public.lessons l ON l.id = lp.lesson_id JOIN public.tracks t ON t.id = l.track_id
    WHERE t.offer_id = _offer GROUP BY lp.user_id
  ) u LEFT JOIN public.profiles p ON p.id = u.user_id), '[]'::jsonb);
END;
$function$;

-- Certificate issuance: server-verified completion, idempotent.
CREATE OR REPLACE FUNCTION public.issue_certificate(_offer uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE o public.offers; prog jsonb; c public.certificates; p public.profiles; num text;
BEGIN
  SELECT * INTO o FROM public.offers WHERE id = _offer AND certificate_enabled;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  SELECT * INTO c FROM public.certificates WHERE offer_id = _offer AND user_id = auth.uid();
  IF c.id IS NOT NULL THEN RETURN jsonb_build_object('certificate_id', c.id, 'cert_number', c.cert_number, 'idempotent', true, 'revoked', c.revoked_at IS NOT NULL); END IF;
  prog := public.course_progress(_offer);
  IF NOT coalesce((prog->>'complete')::boolean, false) THEN RAISE EXCEPTION 'not_complete'; END IF;
  SELECT * INTO p FROM public.profiles WHERE id = auth.uid();
  num := 'ZW-' || upper(encode(gen_random_bytes(6), 'hex'));
  INSERT INTO public.certificates (offer_id, user_id, cert_number, learner_name, course_title, issuer_name, signer_name, signer_title, statement, expires_at)
  VALUES (_offer, auth.uid(), num, coalesce(nullif(trim(p.full_name), ''), 'Learner'),
    coalesce(nullif(trim(o.title_en), ''), nullif(trim(o.title_es), ''), 'Course'),
    coalesce(nullif(trim(o.cert_issuer), ''), 'ZoheeWell'), o.cert_signer_name, o.cert_signer_title,
    coalesce(nullif(trim(o.cert_statement), ''), coalesce(nullif(trim(o.cert_title), ''), 'Certificate of completion')),
    CASE WHEN o.cert_expiry_months IS NOT NULL THEN now() + make_interval(months => o.cert_expiry_months) END)
  RETURNING * INTO c;
  RETURN jsonb_build_object('certificate_id', c.id, 'cert_number', c.cert_number, 'idempotent', false, 'revoked', false);
END;
$function$;

CREATE OR REPLACE FUNCTION public.revoke_certificate(_cert uuid, _reason text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.certificates c JOIN public.offers o ON o.id = c.offer_id WHERE c.id = _cert AND o.host_id = auth.uid()) THEN RAISE EXCEPTION 'not_found'; END IF;
  UPDATE public.certificates SET revoked_at = now(), revoke_reason = left(trim(coalesce(_reason,'')), 500) WHERE id = _cert AND revoked_at IS NULL;
END;
$function$;

-- Public verification: privacy-safe payload only.
CREATE OR REPLACE FUNCTION public.verify_certificate(_number text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE c public.certificates;
BEGIN
  SELECT * INTO c FROM public.certificates WHERE cert_number = upper(trim(_number));
  IF NOT FOUND THEN RETURN jsonb_build_object('valid', false); END IF;
  RETURN jsonb_build_object('valid', c.revoked_at IS NULL AND (c.expires_at IS NULL OR c.expires_at > now()),
    'learner_name', c.learner_name, 'course_title', c.course_title, 'issuer_name', c.issuer_name,
    'issued_at', c.issued_at, 'expires_at', c.expires_at, 'revoked', c.revoked_at IS NOT NULL,
    'expired', c.expires_at IS NOT NULL AND c.expires_at <= now());
END;
$function$;

-- Duplicate copies quiz structure and answer keys, never attempts or progress.
CREATE OR REPLACE FUNCTION public.duplicate_offer(_offer uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE o public.offers; new_id uuid := gen_random_uuid(); t record; l record; qz record; new_track uuid; new_lesson uuid; new_quiz uuid; new_q uuid;
BEGIN
  SELECT * INTO o FROM public.offers WHERE id = _offer AND host_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  INSERT INTO public.offers (id, host_id, team_id, kind, title_en, title_es, description_en, description_es, includes_en, includes_es,
    price_cents, cover_style, cover_url, file_path, drip_days, status, refund_policy,
    visibility, summary_en, summary_es, category, tags, support_email, accessibility_notes, coauthor_name,
    version_label, license_en, license_es, billing_interval, currency, enroll_opens_at, enroll_closes_at,
    completion_require_lessons, completion_require_quizzes, certificate_enabled, cert_title, cert_issuer, cert_signer_name, cert_signer_title, cert_statement, cert_expiry_months)
  VALUES (new_id, o.host_id, o.team_id, o.kind, left(o.title_en || ' (copy)', 120), left(o.title_es || ' (copia)', 120), o.description_en, o.description_es, o.includes_en, o.includes_es,
    o.price_cents, o.cover_style, o.cover_url, o.file_path, o.drip_days, 'draft', o.refund_policy,
    o.visibility, o.summary_en, o.summary_es, o.category, o.tags, o.support_email, o.accessibility_notes, o.coauthor_name,
    o.version_label, o.license_en, o.license_es, o.billing_interval, o.currency, o.enroll_opens_at, o.enroll_closes_at,
    o.completion_require_lessons, o.completion_require_quizzes, o.certificate_enabled, o.cert_title, o.cert_issuer, o.cert_signer_name, o.cert_signer_title, o.cert_statement, o.cert_expiry_months);
  FOR t IN SELECT * FROM public.tracks WHERE offer_id = o.id ORDER BY sort_order, created_at LOOP
    new_track := gen_random_uuid();
    INSERT INTO public.tracks (id, team_id, offer_id, title_en, title_es, description_en, description_es, cover_url, cover_style, sort_order, is_start_here, is_published)
    VALUES (new_track, t.team_id, new_id, t.title_en, t.title_es, t.description_en, t.description_es, t.cover_url, t.cover_style, t.sort_order, t.is_start_here, t.is_published);
    FOR l IN SELECT * FROM public.lessons WHERE track_id = t.id ORDER BY sort_order, created_at LOOP
      new_lesson := gen_random_uuid();
      INSERT INTO public.lessons (id, track_id, title_en, title_es, type, url, storage_path, duration_minutes, live_starts_at, replay_url, notes_en, notes_es, sort_order,
        description_en, description_es, is_preview, is_published, attachments, event_id)
      VALUES (new_lesson, new_track, l.title_en, l.title_es, l.type, l.url, l.storage_path, l.duration_minutes, l.live_starts_at, l.replay_url, l.notes_en, l.notes_es, l.sort_order,
        l.description_en, l.description_es, l.is_preview, l.is_published, l.attachments, l.event_id);
      FOR qz IN SELECT * FROM public.quizzes WHERE lesson_id = l.id LOOP
        new_quiz := gen_random_uuid();
        INSERT INTO public.quizzes (id, offer_id, lesson_id, title_en, title_es, instructions_en, instructions_es, pass_pct, attempts_allowed, cooldown_minutes, time_limit_minutes, is_required, show_score, reveal_answers, randomize_questions, randomize_answers, is_published, sort_order, created_by)
        VALUES (new_quiz, new_id, new_lesson, qz.title_en, qz.title_es, qz.instructions_en, qz.instructions_es, qz.pass_pct, qz.attempts_allowed, qz.cooldown_minutes, qz.time_limit_minutes, qz.is_required, qz.show_score, qz.reveal_answers, qz.randomize_questions, qz.randomize_answers, qz.is_published, qz.sort_order, auth.uid());
        FOR new_q IN SELECT id FROM public.quiz_questions WHERE quiz_id = qz.id LOOP END LOOP; -- placeholder replaced below
        INSERT INTO public.quiz_questions (id, quiz_id, type, prompt_en, prompt_es, points, sort_order, accepted_answers, allow_manual, explanation_en, explanation_es)
        SELECT gen_random_uuid(), new_quiz, qq.type, qq.prompt_en, qq.prompt_es, qq.points, qq.sort_order, qq.accepted_answers, qq.allow_manual, qq.explanation_en, qq.explanation_es
        FROM public.quiz_questions qq WHERE qq.quiz_id = qz.id;
        INSERT INTO public.quiz_options (question_id, label_en, label_es, is_correct, sort_order)
        SELECT nq.id, o.label_en, o.label_es, o.is_correct, o.sort_order
        FROM public.quiz_options o
        JOIN public.quiz_questions oq ON oq.id = o.question_id AND oq.quiz_id = qz.id
        JOIN public.quiz_questions nq ON nq.quiz_id = new_quiz AND nq.sort_order = oq.sort_order AND nq.prompt_en = oq.prompt_en;
      END LOOP;
    END LOOP;
  END LOOP;
  -- course-final quizzes (no lesson)
  FOR qz IN SELECT * FROM public.quizzes WHERE offer_id = o.id AND lesson_id IS NULL LOOP
    new_quiz := gen_random_uuid();
    INSERT INTO public.quizzes (id, offer_id, lesson_id, title_en, title_es, instructions_en, instructions_es, pass_pct, attempts_allowed, cooldown_minutes, time_limit_minutes, is_required, show_score, reveal_answers, randomize_questions, randomize_answers, is_published, sort_order, created_by)
    VALUES (new_quiz, new_id, NULL, qz.title_en, qz.title_es, qz.instructions_en, qz.instructions_es, qz.pass_pct, qz.attempts_allowed, qz.cooldown_minutes, qz.time_limit_minutes, qz.is_required, qz.show_score, qz.reveal_answers, qz.randomize_questions, qz.randomize_answers, qz.is_published, qz.sort_order, auth.uid());
    INSERT INTO public.quiz_questions (id, quiz_id, type, prompt_en, prompt_es, points, sort_order, accepted_answers, allow_manual, explanation_en, explanation_es)
    SELECT gen_random_uuid(), new_quiz, qq.type, qq.prompt_en, qq.prompt_es, qq.points, qq.sort_order, qq.accepted_answers, qq.allow_manual, qq.explanation_en, qq.explanation_es
    FROM public.quiz_questions qq WHERE qq.quiz_id = qz.id;
    INSERT INTO public.quiz_options (question_id, label_en, label_es, is_correct, sort_order)
    SELECT nq.id, o.label_en, o.label_es, o.is_correct, o.sort_order
    FROM public.quiz_options o
    JOIN public.quiz_questions oq ON oq.id = o.question_id AND oq.quiz_id = qz.id
    JOIN public.quiz_questions nq ON nq.quiz_id = new_quiz AND nq.sort_order = oq.sort_order AND nq.prompt_en = oq.prompt_en;
  END LOOP;
  RETURN new_id;
END;
$function$;