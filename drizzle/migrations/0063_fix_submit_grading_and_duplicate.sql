-- 0063: fix submit_quiz objective grading (undefined variable) and clean duplicate_offer placeholder loop.

CREATE OR REPLACE FUNCTION public.submit_quiz(_attempt uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE att public.quiz_attempts; z public.quizzes; q record; r public.quiz_responses; awarded numeric; total numeric := 0; earned numeric := 0; any_manual boolean := false; corr uuid[]; sel uuid[]; late boolean := false;
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
  RETURN jsonb_build_object('attempt_id', att.id, 'status', att.status, 'score_pct', att.score_pct, 'passed', att.passed, 'idempotent', false);
END;
$function$;

CREATE OR REPLACE FUNCTION public.duplicate_offer(_offer uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE o public.offers; new_id uuid := gen_random_uuid(); t record; l record; qz record; new_track uuid; new_lesson uuid; new_quiz uuid;
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