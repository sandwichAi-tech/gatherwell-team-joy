-- 0125: Resources quizzes — standalone team quizzes (no course needed), scored / outcome / poll modes,
-- question and answer images (private media paths), score bands, outcomes, idempotent submit and
-- privacy-safe summaries. Course quizzes keep their existing course-entitlement gate.

ALTER TABLE public.quizzes ALTER COLUMN offer_id DROP NOT NULL;
ALTER TABLE public.quizzes
  ADD COLUMN team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  ADD COLUMN host_id uuid,
  ADD COLUMN mode text NOT NULL DEFAULT 'scored' CHECK (mode IN ('scored','outcome','poll')),
  ADD COLUMN cover_path text,
  ADD COLUMN cover_alt text;
UPDATE public.quizzes z SET host_id = o.host_id FROM public.offers o WHERE o.id = z.offer_id AND z.host_id IS NULL;
ALTER TABLE public.quizzes ADD CONSTRAINT quizzes_parent_check CHECK (offer_id IS NOT NULL OR team_id IS NOT NULL) NOT VALID;
CREATE INDEX IF NOT EXISTS quizzes_team_idx ON public.quizzes(team_id) WHERE offer_id IS NULL;

ALTER TABLE public.quiz_questions ADD COLUMN image_path text, ADD COLUMN image_alt text;

CREATE TABLE public.quiz_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  title_en text NOT NULL DEFAULT '', title_es text NOT NULL DEFAULT '',
  body_en text, body_es text,
  image_path text, image_alt text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_outcomes TO authenticated;
GRANT ALL ON public.quiz_outcomes TO service_role;

CREATE TABLE public.quiz_bands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  min_pct integer NOT NULL DEFAULT 0 CHECK (min_pct BETWEEN 0 AND 100),
  title_en text NOT NULL DEFAULT '', title_es text NOT NULL DEFAULT '',
  body_en text, body_es text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_bands TO authenticated;
GRANT ALL ON public.quiz_bands TO service_role;

ALTER TABLE public.quiz_options
  ADD COLUMN image_path text, ADD COLUMN image_alt text,
  ADD COLUMN outcome_id uuid REFERENCES public.quiz_outcomes(id) ON DELETE SET NULL;
ALTER TABLE public.quiz_attempts ADD COLUMN outcome_id uuid REFERENCES public.quiz_outcomes(id) ON DELETE SET NULL;

-- Who may edit a quiz: its creator, or the host of its course.
CREATE OR REPLACE FUNCTION public.can_edit_quiz(_quiz uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.quizzes z LEFT JOIN public.offers o ON o.id = z.offer_id
    WHERE z.id = _quiz AND auth.uid() IS NOT NULL AND (z.host_id = auth.uid() OR o.host_id = auth.uid()));
$$;
REVOKE ALL ON FUNCTION public.can_edit_quiz(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_edit_quiz(uuid) TO authenticated;

-- Server-owned identity columns: creator, course and team are fixed at insert.
CREATE OR REPLACE FUNCTION public.quiz_fill_owner() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.offer_id IS NOT NULL THEN
      SELECT o.host_id INTO NEW.host_id FROM public.offers o WHERE o.id = NEW.offer_id;
      NEW.team_id := NULL;
    ELSE
      NEW.host_id := auth.uid();
      IF NEW.team_id IS NULL OR NOT public.can_build_resources(NEW.team_id) THEN RAISE EXCEPTION 'not_allowed'; END IF;
    END IF;
    NEW.created_by := coalesce(auth.uid(), NEW.created_by);
  ELSE
    IF NEW.host_id IS DISTINCT FROM OLD.host_id OR NEW.offer_id IS DISTINCT FROM OLD.offer_id OR NEW.team_id IS DISTINCT FROM OLD.team_id THEN
      IF coalesce(auth.jwt()->>'role','') <> 'service_role' THEN RAISE EXCEPTION 'owner_locked'; END IF;
    END IF;
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER quiz_fill_owner BEFORE INSERT OR UPDATE ON public.quizzes FOR EACH ROW EXECUTE FUNCTION public.quiz_fill_owner();

DROP POLICY IF EXISTS quizzes_host ON public.quizzes;
CREATE POLICY quizzes_editor ON public.quizzes FOR ALL TO authenticated
  USING (host_id = auth.uid() OR EXISTS (SELECT 1 FROM public.offers o WHERE o.id = offer_id AND o.host_id = auth.uid()))
  WITH CHECK ((offer_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.offers o WHERE o.id = offer_id AND o.host_id = auth.uid()))
    OR (offer_id IS NULL AND team_id IS NOT NULL AND public.can_build_resources(team_id)));

DROP POLICY IF EXISTS quiz_questions_host ON public.quiz_questions;
CREATE POLICY quiz_questions_editor ON public.quiz_questions FOR ALL TO authenticated
  USING (public.can_edit_quiz(quiz_id)) WITH CHECK (public.can_edit_quiz(quiz_id));
DROP POLICY IF EXISTS quiz_options_host ON public.quiz_options;
CREATE POLICY quiz_options_editor ON public.quiz_options FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.quiz_questions qq WHERE qq.id = question_id AND public.can_edit_quiz(qq.quiz_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.quiz_questions qq WHERE qq.id = question_id AND public.can_edit_quiz(qq.quiz_id))
    AND (outcome_id IS NULL OR EXISTS (SELECT 1 FROM public.quiz_outcomes oc JOIN public.quiz_questions q2 ON q2.quiz_id = oc.quiz_id WHERE oc.id = outcome_id AND q2.id = question_id)));
ALTER TABLE public.quiz_outcomes ENABLE ROW LEVEL SECURITY;
CREATE POLICY quiz_outcomes_editor ON public.quiz_outcomes FOR ALL TO authenticated
  USING (public.can_edit_quiz(quiz_id)) WITH CHECK (public.can_edit_quiz(quiz_id));
ALTER TABLE public.quiz_bands ENABLE ROW LEVEL SECURITY;
CREATE POLICY quiz_bands_editor ON public.quiz_bands FOR ALL TO authenticated
  USING (public.can_edit_quiz(quiz_id)) WITH CHECK (public.can_edit_quiz(quiz_id));
DROP POLICY IF EXISTS quiz_attempts_host ON public.quiz_attempts;
CREATE POLICY quiz_attempts_editor ON public.quiz_attempts FOR SELECT TO authenticated USING (public.can_edit_quiz(quiz_id));
DROP POLICY IF EXISTS quiz_responses_host ON public.quiz_responses;
CREATE POLICY quiz_responses_editor ON public.quiz_responses FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.quiz_attempts a WHERE a.id = attempt_id AND public.can_edit_quiz(a.quiz_id)));

-- Publish checks per mode, including leftover [placeholder] text.
CREATE OR REPLACE FUNCTION public.quiz_blockers(_quiz uuid)
RETURNS text[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE b text[] := '{}'; z public.quizzes; n int; ph text := '\[[^\]]{1,80}\]';
BEGIN
  SELECT * INTO z FROM public.quizzes WHERE id = _quiz;
  IF NOT FOUND THEN RETURN array_append(b, 'not_found'); END IF;
  IF length(trim(coalesce(z.title_en,''))) = 0 AND length(trim(coalesce(z.title_es,''))) = 0 THEN b := array_append(b, 'missing_title'); END IF;
  SELECT count(*) INTO n FROM public.quiz_questions WHERE quiz_id = _quiz;
  IF n = 0 THEN b := array_append(b, 'no_questions'); END IF;
  IF EXISTS (SELECT 1 FROM public.quiz_questions qq WHERE qq.quiz_id = _quiz AND (length(trim(coalesce(qq.prompt_en,''))) = 0 AND length(trim(coalesce(qq.prompt_es,''))) = 0)) THEN b := array_append(b, 'missing_prompt'); END IF;
  IF EXISTS (SELECT 1 FROM public.quiz_questions qq WHERE qq.quiz_id = _quiz AND qq.type IN ('single','multi','truefalse') AND (SELECT count(*) FROM public.quiz_options o WHERE o.question_id = qq.id) < 2) THEN b := array_append(b, 'missing_options'); END IF;
  IF EXISTS (SELECT 1 FROM public.quiz_options o JOIN public.quiz_questions qq ON qq.id = o.question_id WHERE qq.quiz_id = _quiz AND length(trim(o.label_en)) = 0 AND length(trim(o.label_es)) = 0 AND o.image_path IS NULL) THEN b := array_append(b, 'empty_option'); END IF;
  IF EXISTS (SELECT 1 FROM public.quiz_options o JOIN public.quiz_questions qq ON qq.id = o.question_id WHERE qq.quiz_id = _quiz AND o.image_path IS NOT NULL AND length(trim(coalesce(o.image_alt,''))) = 0)
     OR EXISTS (SELECT 1 FROM public.quiz_questions qq WHERE qq.quiz_id = _quiz AND qq.image_path IS NOT NULL AND length(trim(coalesce(qq.image_alt,''))) = 0) THEN b := array_append(b, 'missing_alt'); END IF;
  IF z.title_en ~ ph OR z.title_es ~ ph OR coalesce(z.instructions_en,'') ~ ph OR coalesce(z.instructions_es,'') ~ ph
     OR EXISTS (SELECT 1 FROM public.quiz_questions qq WHERE qq.quiz_id = _quiz AND (qq.prompt_en ~ ph OR qq.prompt_es ~ ph))
     OR EXISTS (SELECT 1 FROM public.quiz_options o JOIN public.quiz_questions qq ON qq.id = o.question_id WHERE qq.quiz_id = _quiz AND (o.label_en ~ ph OR o.label_es ~ ph))
     OR EXISTS (SELECT 1 FROM public.quiz_outcomes oc WHERE oc.quiz_id = _quiz AND (oc.title_en ~ ph OR oc.title_es ~ ph OR coalesce(oc.body_en,'') ~ ph OR coalesce(oc.body_es,'') ~ ph)) THEN
    b := array_append(b, 'placeholder');
  END IF;
  IF z.mode = 'scored' THEN
    IF EXISTS (SELECT 1 FROM public.quiz_questions qq WHERE qq.quiz_id = _quiz AND qq.type IN ('single','truefalse') AND (SELECT count(*) FROM public.quiz_options o WHERE o.question_id = qq.id AND o.is_correct) <> 1) THEN b := array_append(b, 'missing_key'); END IF;
    IF EXISTS (SELECT 1 FROM public.quiz_questions qq WHERE qq.quiz_id = _quiz AND qq.type = 'multi' AND (SELECT count(*) FROM public.quiz_options o WHERE o.question_id = qq.id AND o.is_correct) < 1) THEN b := array_append(b, 'missing_key'); END IF;
    IF EXISTS (SELECT 1 FROM public.quiz_questions qq WHERE qq.quiz_id = _quiz AND qq.type = 'short' AND NOT qq.allow_manual AND (qq.accepted_answers IS NULL OR cardinality(qq.accepted_answers) = 0)) THEN b := array_append(b, 'missing_key'); END IF;
    IF EXISTS (SELECT 1 FROM public.quiz_bands bd WHERE bd.quiz_id = _quiz AND length(trim(bd.title_en)) = 0 AND length(trim(bd.title_es)) = 0) THEN b := array_append(b, 'band_title'); END IF;
  ELSE
    IF EXISTS (SELECT 1 FROM public.quiz_questions qq WHERE qq.quiz_id = _quiz AND qq.type NOT IN ('single','multi')) THEN b := array_append(b, 'mode_types'); END IF;
  END IF;
  IF z.mode = 'outcome' THEN
    IF (SELECT count(*) FROM public.quiz_outcomes oc WHERE oc.quiz_id = _quiz) < 2 THEN b := array_append(b, 'outcomes_needed'); END IF;
    IF EXISTS (SELECT 1 FROM public.quiz_outcomes oc WHERE oc.quiz_id = _quiz AND length(trim(oc.title_en)) = 0 AND length(trim(oc.title_es)) = 0) THEN b := array_append(b, 'outcome_title'); END IF;
    IF EXISTS (SELECT 1 FROM public.quiz_options o JOIN public.quiz_questions qq ON qq.id = o.question_id WHERE qq.quiz_id = _quiz AND o.outcome_id IS NULL) THEN b := array_append(b, 'outcome_unmapped'); END IF;
  END IF;
  RETURN b;
END $function$;

-- Access: course quizzes keep the course gate; standalone quizzes are for members of their team.
CREATE OR REPLACE FUNCTION public.quiz_access_error(_quiz uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE z public.quizzes; o public.offers; l public.lessons;
BEGIN
  IF auth.uid() IS NULL THEN RETURN 'not_found'; END IF;
  SELECT * INTO z FROM public.quizzes WHERE id = _quiz AND is_published;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF z.offer_id IS NULL THEN
    IF z.host_id = auth.uid() THEN RETURN NULL; END IF;
    IF NOT public.is_team_member(z.team_id, ARRAY['leader','host','member']) THEN RETURN 'not_found'; END IF;
    RETURN NULL;
  END IF;
  SELECT * INTO o FROM public.offers WHERE id = z.offer_id;
  IF o.status <> 'published' AND o.host_id <> auth.uid() THEN RETURN 'not_found'; END IF;
  IF o.host_id <> auth.uid() AND NOT public.can_access_offer(o.id) THEN RETURN 'no_access'; END IF;
  IF z.lesson_id IS NOT NULL THEN
    SELECT * INTO l FROM public.lessons WHERE id = z.lesson_id;
    IF l IS NULL OR NOT l.is_published THEN RETURN 'not_found'; END IF;
    IF l.prerequisite_lesson_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.lesson_progress lp WHERE lp.lesson_id = l.prerequisite_lesson_id AND lp.user_id = auth.uid() AND lp.completed_at IS NOT NULL
    ) THEN RETURN 'prerequisite'; END IF;
  ELSIF o.host_id <> auth.uid() AND EXISTS (
      SELECT 1 FROM public.lessons l2 JOIN public.tracks t ON t.id = l2.track_id
      WHERE t.offer_id = z.offer_id AND t.is_published AND l2.is_published
        AND NOT EXISTS (SELECT 1 FROM public.lesson_progress lp WHERE lp.lesson_id = l2.id AND lp.user_id = auth.uid() AND lp.completed_at IS NOT NULL)
    ) THEN RETURN 'prerequisite';
  END IF;
  RETURN NULL;
END $function$;

-- Taker payload: never answer keys, outcome mapping or explanations; images as paths (signed server-side).
CREATE OR REPLACE FUNCTION public.get_quiz_for_taker(_quiz uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE z public.quizzes; err text; att public.quiz_attempts; used int; last_submit timestamptz; last_id uuid; qs jsonb;
BEGIN
  err := public.quiz_access_error(_quiz);
  IF err IS NOT NULL THEN RETURN jsonb_build_object('error', err); END IF;
  SELECT * INTO z FROM public.quizzes WHERE id = _quiz;
  SELECT count(*), max(submitted_at) INTO used, last_submit FROM public.quiz_attempts WHERE quiz_id = _quiz AND user_id = auth.uid() AND submitted_at IS NOT NULL;
  SELECT id INTO last_id FROM public.quiz_attempts WHERE quiz_id = _quiz AND user_id = auth.uid() AND submitted_at IS NOT NULL ORDER BY attempt_no DESC LIMIT 1;
  SELECT * INTO att FROM public.quiz_attempts WHERE quiz_id = _quiz AND user_id = auth.uid() AND status = 'in_progress' ORDER BY attempt_no DESC LIMIT 1;
  SELECT jsonb_agg(jsonb_build_object(
      'id', qq.id, 'type', qq.type, 'points', qq.points, 'prompt_en', qq.prompt_en, 'prompt_es', qq.prompt_es,
      'image_path', qq.image_path, 'image_alt', qq.image_alt,
      'options', (SELECT jsonb_agg(jsonb_build_object('id', o.id, 'label_en', o.label_en, 'label_es', o.label_es, 'image_path', o.image_path, 'image_alt', o.image_alt)
        ORDER BY CASE WHEN z.randomize_answers THEN random() ELSE o.sort_order END) FROM public.quiz_options o WHERE o.question_id = qq.id)
    ) ORDER BY CASE WHEN z.randomize_questions THEN random() ELSE qq.sort_order END) INTO qs
  FROM public.quiz_questions qq WHERE qq.quiz_id = _quiz;
  RETURN jsonb_build_object(
    'quiz', jsonb_build_object('id', z.id, 'offer_id', z.offer_id, 'team_id', z.team_id, 'lesson_id', z.lesson_id, 'mode', z.mode,
      'title_en', z.title_en, 'title_es', z.title_es, 'instructions_en', z.instructions_en, 'instructions_es', z.instructions_es,
      'pass_pct', z.pass_pct, 'attempts_allowed', z.attempts_allowed, 'cooldown_minutes', z.cooldown_minutes, 'time_limit_minutes', z.time_limit_minutes,
      'is_required', z.is_required, 'show_score', z.show_score, 'cover_path', z.cover_path, 'cover_alt', z.cover_alt, 'is_editor', public.can_edit_quiz(z.id)),
    'questions', coalesce(qs, '[]'::jsonb),
    'attempts_used', used,
    'last_attempt_id', last_id,
    'cooldown_until', CASE WHEN z.cooldown_minutes > 0 AND last_submit IS NOT NULL THEN last_submit + make_interval(mins => z.cooldown_minutes) END,
    'can_start', (z.attempts_allowed IS NULL OR used < z.attempts_allowed) AND (z.cooldown_minutes = 0 OR last_submit IS NULL OR last_submit + make_interval(mins => z.cooldown_minutes) <= now()),
    'active_attempt', CASE WHEN att.id IS NULL THEN NULL ELSE jsonb_build_object('id', att.id, 'attempt_no', att.attempt_no, 'deadline', att.deadline,
      'responses', (SELECT coalesce(jsonb_object_agg(r.question_id, jsonb_build_object('selected', r.selected, 'text_answer', r.text_answer)), '{}'::jsonb) FROM public.quiz_responses r WHERE r.attempt_id = att.id)
    ) END);
END $function$;

-- Serialized start: a double tap resumes the same attempt instead of creating two.
CREATE OR REPLACE FUNCTION public.start_quiz_attempt(_quiz uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE z public.quizzes; err text; att public.quiz_attempts; used int; last_submit timestamptz;
BEGIN
  err := public.quiz_access_error(_quiz);
  IF err IS NOT NULL THEN RAISE EXCEPTION '%', err; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('quiz:' || _quiz || ':' || auth.uid(), 0));
  SELECT * INTO z FROM public.quizzes WHERE id = _quiz;
  SELECT * INTO att FROM public.quiz_attempts WHERE quiz_id = _quiz AND user_id = auth.uid() AND status = 'in_progress' ORDER BY attempt_no DESC LIMIT 1;
  IF att.id IS NOT NULL THEN RETURN jsonb_build_object('attempt_id', att.id, 'attempt_no', att.attempt_no, 'deadline', att.deadline, 'resumed', true); END IF;
  SELECT count(*), max(submitted_at) INTO used, last_submit FROM public.quiz_attempts WHERE quiz_id = _quiz AND user_id = auth.uid() AND submitted_at IS NOT NULL;
  IF z.attempts_allowed IS NOT NULL AND used >= z.attempts_allowed THEN RAISE EXCEPTION 'attempts_exhausted'; END IF;
  IF z.cooldown_minutes > 0 AND last_submit IS NOT NULL AND last_submit + make_interval(mins => z.cooldown_minutes) > now() THEN RAISE EXCEPTION 'cooldown'; END IF;
  INSERT INTO public.quiz_attempts (quiz_id, user_id, attempt_no, deadline)
  VALUES (_quiz, auth.uid(), (SELECT coalesce(max(attempt_no), 0) + 1 FROM public.quiz_attempts WHERE quiz_id = _quiz AND user_id = auth.uid()),
    CASE WHEN z.time_limit_minutes IS NOT NULL THEN now() + make_interval(mins => z.time_limit_minutes) END)
  RETURNING * INTO att;
  RETURN jsonb_build_object('attempt_id', att.id, 'attempt_no', att.attempt_no, 'deadline', att.deadline, 'resumed', false);
END $function$;

-- Saved answers must belong to the question (no foreign option ids).
CREATE OR REPLACE FUNCTION public.save_quiz_response(_attempt uuid, _question uuid, _selected uuid[], _text text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE att public.quiz_attempts; q public.quiz_questions;
BEGIN
  SELECT * INTO att FROM public.quiz_attempts WHERE id = _attempt AND user_id = auth.uid() AND status = 'in_progress';
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF att.deadline IS NOT NULL AND now() > att.deadline + interval '60 seconds' THEN RAISE EXCEPTION 'time_expired'; END IF;
  SELECT * INTO q FROM public.quiz_questions WHERE id = _question AND quiz_id = att.quiz_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF _selected IS NOT NULL AND EXISTS (SELECT 1 FROM unnest(_selected) s WHERE NOT EXISTS (SELECT 1 FROM public.quiz_options o WHERE o.id = s AND o.question_id = _question)) THEN RAISE EXCEPTION 'invalid_option'; END IF;
  IF q.type IN ('single','truefalse') AND cardinality(coalesce(_selected, '{}')) > 1 THEN RAISE EXCEPTION 'invalid_option'; END IF;
  INSERT INTO public.quiz_responses (attempt_id, question_id, selected, text_answer)
  VALUES (_attempt, _question, _selected, left(coalesce(_text,''), 2000))
  ON CONFLICT (attempt_id, question_id) DO UPDATE SET selected = EXCLUDED.selected, text_answer = EXCLUDED.text_answer;
END $function$;

-- Idempotent, row-locked submit for all three modes. Clients never send scores or outcomes.
CREATE OR REPLACE FUNCTION public.submit_quiz(_attempt uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE att public.quiz_attempts; z public.quizzes; q record; r public.quiz_responses; awarded numeric; total numeric := 0; earned numeric := 0;
  any_manual boolean := false; corr uuid[]; sel uuid[]; late boolean := false; win uuid;
BEGIN
  SELECT * INTO att FROM public.quiz_attempts WHERE id = _attempt AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF att.status <> 'in_progress' THEN
    RETURN jsonb_build_object('attempt_id', att.id, 'status', att.status, 'score_pct', att.score_pct, 'passed', att.passed, 'outcome_id', att.outcome_id, 'idempotent', true);
  END IF;
  SELECT * INTO z FROM public.quizzes WHERE id = att.quiz_id;
  IF att.deadline IS NOT NULL AND now() > att.deadline + interval '60 seconds' THEN late := true; END IF;
  IF z.mode <> 'scored' AND EXISTS (SELECT 1 FROM public.quiz_questions qq WHERE qq.quiz_id = z.id AND NOT EXISTS (
      SELECT 1 FROM public.quiz_responses rr WHERE rr.attempt_id = att.id AND rr.question_id = qq.id AND cardinality(coalesce(rr.selected, '{}')) > 0)) THEN
    RAISE EXCEPTION 'incomplete';
  END IF;
  IF z.mode = 'scored' THEN
    FOR q IN SELECT * FROM public.quiz_questions WHERE quiz_id = att.quiz_id LOOP
      total := total + q.points;
      r := NULL;
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
        SELECT coalesce(array_agg(x ORDER BY x), '{}') INTO sel FROM unnest(coalesce(r.selected, '{}')) x;
        IF r.id IS NOT NULL AND r.selected IS NOT NULL AND sel = corr THEN awarded := q.points; END IF;
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
  ELSE
    IF z.mode = 'outcome' THEN
      SELECT oc.id INTO win FROM public.quiz_outcomes oc
        LEFT JOIN (SELECT o.outcome_id, count(*) c FROM public.quiz_responses rr CROSS JOIN LATERAL unnest(rr.selected) s(id)
                   JOIN public.quiz_options o ON o.id = s.id WHERE rr.attempt_id = att.id GROUP BY o.outcome_id) t ON t.outcome_id = oc.id
        WHERE oc.quiz_id = z.id ORDER BY coalesce(t.c, 0) DESC, oc.sort_order, oc.created_at LIMIT 1;
    END IF;
    UPDATE public.quiz_attempts SET submitted_at = now(), submitted_late = late, score_pct = NULL, passed = true, outcome_id = win, status = 'graded'
    WHERE id = att.id RETURNING * INTO att;
  END IF;
  RETURN jsonb_build_object('attempt_id', att.id, 'status', att.status, 'score_pct', att.score_pct, 'passed', att.passed, 'outcome_id', att.outcome_id, 'idempotent', false);
END $function$;

CREATE OR REPLACE FUNCTION public.my_quiz_attempts(_quiz uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE z public.quizzes; ed boolean;
BEGIN
  SELECT * INTO z FROM public.quizzes WHERE id = _quiz;
  IF NOT FOUND THEN RETURN '[]'::jsonb; END IF;
  ed := public.can_edit_quiz(_quiz);
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object(
    'id', a.id, 'attempt_no', a.attempt_no, 'started_at', a.started_at, 'submitted_at', a.submitted_at, 'status', a.status,
    'score_pct', CASE WHEN z.show_score OR ed THEN a.score_pct END,
    'passed', CASE WHEN z.show_score OR ed THEN a.passed END
  ) ORDER BY a.attempt_no) FROM public.quiz_attempts a
  WHERE a.quiz_id = _quiz AND a.user_id = auth.uid() AND a.submitted_at IS NOT NULL), '[]'::jsonb);
END $function$;

-- Aggregate counts per option (no names, no per-person answers).
CREATE OR REPLACE FUNCTION public.quiz_option_counts(_quiz uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH latest AS (
    SELECT DISTINCT ON (a.user_id) a.id FROM public.quiz_attempts a
    WHERE a.quiz_id = _quiz AND a.submitted_at IS NOT NULL ORDER BY a.user_id, a.attempt_no DESC)
  SELECT coalesce(jsonb_agg(jsonb_build_object('question_id', qq.id, 'prompt_en', qq.prompt_en, 'prompt_es', qq.prompt_es,
    'answered', (SELECT count(*) FROM public.quiz_responses rr WHERE rr.question_id = qq.id AND rr.attempt_id IN (SELECT id FROM latest) AND cardinality(coalesce(rr.selected,'{}')) > 0),
    'options', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'label_en', o.label_en, 'label_es', o.label_es,
        'count', (SELECT count(*) FROM public.quiz_responses rr WHERE rr.question_id = qq.id AND rr.attempt_id IN (SELECT id FROM latest) AND o.id = ANY(rr.selected))) ORDER BY o.sort_order), '[]'::jsonb)
      FROM public.quiz_options o WHERE o.question_id = qq.id)) ORDER BY qq.sort_order), '[]'::jsonb)
  FROM public.quiz_questions qq WHERE qq.quiz_id = _quiz AND qq.type <> 'short';
$$;
REVOKE ALL ON FUNCTION public.quiz_option_counts(uuid) FROM PUBLIC, anon, authenticated;

-- Participant result for one of their own attempts (or the quiz editor).
CREATE OR REPLACE FUNCTION public.quiz_result(_attempt uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE att public.quiz_attempts; z public.quizzes; bd public.quiz_bands; oc public.quiz_outcomes; n int; used int; ed boolean;
BEGIN
  SELECT * INTO att FROM public.quiz_attempts WHERE id = _attempt;
  IF NOT FOUND OR att.submitted_at IS NULL THEN RETURN jsonb_build_object('error', 'not_found'); END IF;
  ed := public.can_edit_quiz(att.quiz_id);
  IF att.user_id <> auth.uid() AND NOT ed THEN RETURN jsonb_build_object('error', 'not_found'); END IF;
  SELECT * INTO z FROM public.quizzes WHERE id = att.quiz_id;
  SELECT count(*) INTO used FROM public.quiz_attempts WHERE quiz_id = z.id AND user_id = att.user_id AND submitted_at IS NOT NULL;
  IF z.mode = 'scored' AND att.score_pct IS NOT NULL THEN
    SELECT * INTO bd FROM public.quiz_bands WHERE quiz_id = z.id AND min_pct <= att.score_pct ORDER BY min_pct DESC LIMIT 1;
  END IF;
  IF att.outcome_id IS NOT NULL THEN SELECT * INTO oc FROM public.quiz_outcomes WHERE id = att.outcome_id; END IF;
  SELECT count(DISTINCT user_id) INTO n FROM public.quiz_attempts WHERE quiz_id = z.id AND submitted_at IS NOT NULL;
  RETURN jsonb_build_object('attempt_id', att.id, 'attempt_no', att.attempt_no, 'mode', z.mode, 'status', att.status,
    'score_pct', CASE WHEN z.show_score OR ed THEN att.score_pct END, 'passed', CASE WHEN z.show_score OR ed THEN att.passed END, 'pass_pct', z.pass_pct,
    'attempts_used', used, 'attempts_allowed', z.attempts_allowed,
    'band', CASE WHEN bd.id IS NULL THEN NULL ELSE jsonb_build_object('title_en', bd.title_en, 'title_es', bd.title_es, 'body_en', bd.body_en, 'body_es', bd.body_es, 'min_pct', bd.min_pct) END,
    'outcome', CASE WHEN oc.id IS NULL THEN NULL ELSE jsonb_build_object('id', oc.id, 'title_en', oc.title_en, 'title_es', oc.title_es, 'body_en', oc.body_en, 'body_es', oc.body_es, 'image_path', oc.image_path, 'image_alt', oc.image_alt) END,
    'respondents', CASE WHEN z.mode = 'poll' THEN n END,
    -- Poll results stay hidden until 3 people have answered so no single answer can be inferred.
    'poll', CASE WHEN z.mode = 'poll' AND (n >= 3 OR ed) THEN public.quiz_option_counts(z.id) END);
END $function$;

-- Coach summary: counts, averages and distributions; names only for scored/outcome quizzes they manage.
CREATE OR REPLACE FUNCTION public.quiz_host_summary(_quiz uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE z public.quizzes;
BEGIN
  IF NOT public.can_edit_quiz(_quiz) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  SELECT * INTO z FROM public.quizzes WHERE id = _quiz;
  RETURN jsonb_build_object(
    'mode', z.mode,
    'respondents', (SELECT count(DISTINCT user_id) FROM public.quiz_attempts WHERE quiz_id = _quiz AND submitted_at IS NOT NULL),
    'attempts', (SELECT count(*) FROM public.quiz_attempts WHERE quiz_id = _quiz AND submitted_at IS NOT NULL),
    'in_progress', (SELECT count(*) FROM public.quiz_attempts WHERE quiz_id = _quiz AND submitted_at IS NULL),
    'avg_score', (SELECT round(avg(score_pct), 1) FROM public.quiz_attempts WHERE quiz_id = _quiz AND submitted_at IS NOT NULL AND score_pct IS NOT NULL),
    'pass_rate', (SELECT round(100.0 * count(*) FILTER (WHERE passed) / nullif(count(*), 0), 1) FROM public.quiz_attempts WHERE quiz_id = _quiz AND submitted_at IS NOT NULL AND z.mode = 'scored'),
    'outcomes', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', oc.id, 'title_en', oc.title_en, 'title_es', oc.title_es,
        'count', (SELECT count(*) FROM public.quiz_attempts a WHERE a.outcome_id = oc.id AND a.submitted_at IS NOT NULL)) ORDER BY oc.sort_order), '[]'::jsonb)
      FROM public.quiz_outcomes oc WHERE oc.quiz_id = _quiz),
    'questions', public.quiz_option_counts(_quiz),
    'recent', CASE WHEN z.mode = 'poll' THEN '[]'::jsonb ELSE (SELECT coalesce(jsonb_agg(x ORDER BY x->>'submitted_at' DESC), '[]'::jsonb) FROM (
      SELECT jsonb_build_object('name', coalesce(p.full_name, ''), 'attempt_no', a.attempt_no, 'submitted_at', a.submitted_at, 'score_pct', a.score_pct,
        'outcome_en', oc.title_en, 'outcome_es', oc.title_es) x
      FROM public.quiz_attempts a LEFT JOIN public.profiles p ON p.id = a.user_id LEFT JOIN public.quiz_outcomes oc ON oc.id = a.outcome_id
      WHERE a.quiz_id = _quiz AND a.submitted_at IS NOT NULL ORDER BY a.submitted_at DESC LIMIT 50) s) END);
END $function$;

-- Standalone team quizzes for Resources: members see published ones; builders also see their drafts.
CREATE OR REPLACE FUNCTION public.team_quizzes(_team uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', z.id, 'title_en', z.title_en, 'title_es', z.title_es, 'mode', z.mode,
    'is_published', z.is_published, 'mine', z.host_id = auth.uid(), 'cover_path', z.cover_path,
    'questions', (SELECT count(*) FROM public.quiz_questions qq WHERE qq.quiz_id = z.id),
    'done', EXISTS (SELECT 1 FROM public.quiz_attempts a WHERE a.quiz_id = z.id AND a.user_id = auth.uid() AND a.submitted_at IS NOT NULL),
    'updated_at', z.updated_at) ORDER BY z.updated_at DESC), '[]'::jsonb)
  FROM public.quizzes z
  WHERE z.offer_id IS NULL AND z.team_id = _team AND auth.uid() IS NOT NULL
    AND public.is_team_member(_team, ARRAY['leader','host','member'])
    AND (z.is_published OR z.host_id = auth.uid());
$$;

-- Duplicate as a private draft, remapping outcomes so answer mapping survives the copy.
CREATE OR REPLACE FUNCTION public.duplicate_quiz(_quiz uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE z public.quizzes; nid uuid := gen_random_uuid(); q record; nq uuid;
BEGIN
  IF NOT public.can_edit_quiz(_quiz) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  SELECT * INTO z FROM public.quizzes WHERE id = _quiz;
  IF z.offer_id IS NULL AND NOT public.can_build_resources(z.team_id) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  INSERT INTO public.quizzes (id, offer_id, team_id, lesson_id, mode, title_en, title_es, instructions_en, instructions_es, pass_pct, attempts_allowed, cooldown_minutes,
    time_limit_minutes, is_required, show_score, reveal_answers, randomize_questions, randomize_answers, is_published, sort_order, cover_path, cover_alt)
  VALUES (nid, z.offer_id, z.team_id, z.lesson_id, z.mode, left(z.title_en || CASE WHEN z.title_en <> '' THEN ' (copy)' ELSE '' END, 160),
    left(z.title_es || CASE WHEN z.title_es <> '' THEN ' (copia)' ELSE '' END, 160), z.instructions_en, z.instructions_es, z.pass_pct, z.attempts_allowed,
    z.cooldown_minutes, z.time_limit_minutes, z.is_required, z.show_score, z.reveal_answers, z.randomize_questions, z.randomize_answers, false, z.sort_order + 1, z.cover_path, z.cover_alt);
  CREATE TEMP TABLE IF NOT EXISTS _qz_map (old_id uuid, new_id uuid) ON COMMIT DROP;
  DELETE FROM _qz_map;
  INSERT INTO _qz_map SELECT id, gen_random_uuid() FROM public.quiz_outcomes WHERE quiz_id = _quiz;
  INSERT INTO public.quiz_outcomes (id, quiz_id, title_en, title_es, body_en, body_es, image_path, image_alt, sort_order)
    SELECT m.new_id, nid, oc.title_en, oc.title_es, oc.body_en, oc.body_es, oc.image_path, oc.image_alt, oc.sort_order FROM public.quiz_outcomes oc JOIN _qz_map m ON m.old_id = oc.id;
  INSERT INTO public.quiz_bands (quiz_id, min_pct, title_en, title_es, body_en, body_es) SELECT nid, min_pct, title_en, title_es, body_en, body_es FROM public.quiz_bands WHERE quiz_id = _quiz;
  FOR q IN SELECT * FROM public.quiz_questions WHERE quiz_id = _quiz ORDER BY sort_order LOOP
    nq := gen_random_uuid();
    INSERT INTO public.quiz_questions (id, quiz_id, type, prompt_en, prompt_es, points, sort_order, accepted_answers, allow_manual, explanation_en, explanation_es, image_path, image_alt)
    VALUES (nq, nid, q.type, q.prompt_en, q.prompt_es, q.points, q.sort_order, q.accepted_answers, q.allow_manual, q.explanation_en, q.explanation_es, q.image_path, q.image_alt);
    INSERT INTO public.quiz_options (question_id, label_en, label_es, is_correct, sort_order, image_path, image_alt, outcome_id)
      SELECT nq, o.label_en, o.label_es, o.is_correct, o.sort_order, o.image_path, o.image_alt, m.new_id FROM public.quiz_options o LEFT JOIN _qz_map m ON m.old_id = o.outcome_id WHERE o.question_id = q.id;
  END LOOP;
  RETURN nid;
END $function$;

REVOKE ALL ON FUNCTION public.quiz_result(uuid), public.quiz_host_summary(uuid), public.team_quizzes(uuid), public.duplicate_quiz(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.quiz_result(uuid), public.quiz_host_summary(uuid), public.team_quizzes(uuid), public.duplicate_quiz(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.get_quiz_for_taker(uuid), public.start_quiz_attempt(uuid), public.save_quiz_response(uuid, uuid, uuid[], text), public.submit_quiz(uuid), public.my_quiz_attempts(uuid), public.quiz_blockers(uuid) FROM anon;