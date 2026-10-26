CREATE OR REPLACE FUNCTION public.quiz_host_summary(_quiz uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE z public.quizzes; n int;
BEGIN
  IF NOT public.can_edit_quiz(_quiz) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  SELECT * INTO z FROM public.quizzes WHERE id = _quiz;
  SELECT count(DISTINCT user_id) INTO n FROM public.quiz_attempts WHERE quiz_id = _quiz AND submitted_at IS NOT NULL;
  RETURN jsonb_build_object(
    'mode', z.mode,
    'respondents', n,
    'attempts', (SELECT count(*) FROM public.quiz_attempts WHERE quiz_id = _quiz AND submitted_at IS NOT NULL),
    'in_progress', (SELECT count(*) FROM public.quiz_attempts WHERE quiz_id = _quiz AND submitted_at IS NULL),
    'avg_score', (SELECT round(avg(score_pct), 1) FROM public.quiz_attempts WHERE quiz_id = _quiz AND submitted_at IS NOT NULL AND score_pct IS NOT NULL),
    'pass_rate', (SELECT round(100.0 * count(*) FILTER (WHERE passed) / nullif(count(*), 0), 1) FROM public.quiz_attempts WHERE quiz_id = _quiz AND submitted_at IS NOT NULL AND z.mode = 'scored'),
    'outcomes', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', oc.id, 'title_en', oc.title_en, 'title_es', oc.title_es,
        'count', (SELECT count(*) FROM public.quiz_attempts a WHERE a.outcome_id = oc.id AND a.submitted_at IS NOT NULL)) ORDER BY oc.sort_order), '[]'::jsonb)
      FROM public.quiz_outcomes oc WHERE oc.quiz_id = _quiz),
    -- Poll totals stay hidden from the coach too until 3 people answered, so no single answer can be inferred.
    'poll_hidden', z.mode = 'poll' AND n < 3,
    'questions', CASE WHEN z.mode = 'poll' AND n < 3 THEN '[]'::jsonb ELSE public.quiz_option_counts(_quiz) END,
    'recent', CASE WHEN z.mode = 'poll' THEN '[]'::jsonb ELSE (SELECT coalesce(jsonb_agg(x ORDER BY x->>'submitted_at' DESC), '[]'::jsonb) FROM (
      SELECT jsonb_build_object('name', coalesce(p.full_name, ''), 'attempt_no', a.attempt_no, 'submitted_at', a.submitted_at, 'score_pct', a.score_pct,
        'outcome_en', oc.title_en, 'outcome_es', oc.title_es) x
      FROM public.quiz_attempts a LEFT JOIN public.profiles p ON p.id = a.user_id LEFT JOIN public.quiz_outcomes oc ON oc.id = a.outcome_id
      WHERE a.quiz_id = _quiz AND a.submitted_at IS NOT NULL ORDER BY a.submitted_at DESC LIMIT 50) s) END);
END $$;