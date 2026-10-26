CREATE OR REPLACE FUNCTION public.duplicate_quiz(_quiz uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE z public.quizzes; nid uuid := gen_random_uuid(); q record; nq uuid; omap jsonb := '{}'::jsonb; oc record; noc uuid;
BEGIN
  IF NOT public.can_edit_quiz(_quiz) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  SELECT * INTO z FROM public.quizzes WHERE id = _quiz;
  IF z.offer_id IS NULL AND NOT public.can_build_resources(z.team_id) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  INSERT INTO public.quizzes (id, offer_id, team_id, lesson_id, mode, title_en, title_es, instructions_en, instructions_es, pass_pct, attempts_allowed, cooldown_minutes,
    time_limit_minutes, is_required, show_score, reveal_answers, randomize_questions, randomize_answers, is_published, sort_order, cover_path, cover_alt)
  VALUES (nid, z.offer_id, z.team_id, z.lesson_id, z.mode, left(z.title_en || CASE WHEN z.title_en <> '' THEN ' (copy)' ELSE '' END, 160),
    left(z.title_es || CASE WHEN z.title_es <> '' THEN ' (copia)' ELSE '' END, 160), z.instructions_en, z.instructions_es, z.pass_pct, z.attempts_allowed,
    z.cooldown_minutes, z.time_limit_minutes, z.is_required, z.show_score, z.reveal_answers, z.randomize_questions, z.randomize_answers, false, z.sort_order + 1, z.cover_path, z.cover_alt);
  FOR oc IN SELECT * FROM public.quiz_outcomes WHERE quiz_id = _quiz ORDER BY sort_order LOOP
    noc := gen_random_uuid();
    INSERT INTO public.quiz_outcomes (id, quiz_id, title_en, title_es, body_en, body_es, image_path, image_alt, sort_order)
    VALUES (noc, nid, oc.title_en, oc.title_es, oc.body_en, oc.body_es, oc.image_path, oc.image_alt, oc.sort_order);
    omap := omap || jsonb_build_object(oc.id::text, noc::text);
  END LOOP;
  INSERT INTO public.quiz_bands (quiz_id, min_pct, title_en, title_es, body_en, body_es) SELECT nid, min_pct, title_en, title_es, body_en, body_es FROM public.quiz_bands WHERE quiz_id = _quiz;
  FOR q IN SELECT * FROM public.quiz_questions WHERE quiz_id = _quiz ORDER BY sort_order LOOP
    nq := gen_random_uuid();
    INSERT INTO public.quiz_questions (id, quiz_id, type, prompt_en, prompt_es, points, sort_order, accepted_answers, allow_manual, explanation_en, explanation_es, image_path, image_alt)
    VALUES (nq, nid, q.type, q.prompt_en, q.prompt_es, q.points, q.sort_order, q.accepted_answers, q.allow_manual, q.explanation_en, q.explanation_es, q.image_path, q.image_alt);
    INSERT INTO public.quiz_options (question_id, label_en, label_es, is_correct, sort_order, image_path, image_alt, outcome_id)
      SELECT nq, o.label_en, o.label_es, o.is_correct, o.sort_order, o.image_path, o.image_alt, (omap ->> o.outcome_id::text)::uuid
      FROM public.quiz_options o WHERE o.question_id = q.id;
  END LOOP;
  RETURN nid;
END $$;