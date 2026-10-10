CREATE TABLE public.progress_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 80),
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.progress_goal_checks (
  goal_id uuid NOT NULL REFERENCES public.progress_goals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  checked_on date NOT NULL,
  PRIMARY KEY (goal_id, checked_on)
);
CREATE TABLE public.personal_bests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  label text NOT NULL CHECK (length(trim(label)) BETWEEN 1 AND 60),
  kind text NOT NULL CHECK (kind IN ('distance','time','reps','lifted')),
  value numeric NOT NULL CHECK (value > 0 AND value < 100000),
  unit text NOT NULL CHECK (unit IN ('km','mi','min','reps','kg','lb')),
  recorded_on date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.progress_shares (
  user_id uuid NOT NULL DEFAULT auth.uid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, team_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.progress_goals, public.progress_goal_checks, public.personal_bests, public.progress_shares TO authenticated;
GRANT ALL ON public.progress_goals, public.progress_goal_checks, public.personal_bests, public.progress_shares TO service_role;
ALTER TABLE public.progress_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress_goal_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_bests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own goals" ON public.progress_goals FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid() AND NOT public.has_blocked_claim(title));
CREATE POLICY "Own goal checks" ON public.progress_goal_checks FOR ALL TO authenticated USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.progress_goals g WHERE g.id = goal_id AND g.user_id = auth.uid()));
-- body-weight style entries are refused by the claims guard; "lifted" covers weight lifted
CREATE POLICY "Own bests" ON public.personal_bests FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid() AND NOT public.has_blocked_claim(label));
CREATE POLICY "Own shares" ON public.progress_shares FOR ALL TO authenticated USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND public.is_team_member(team_id, ARRAY['leader','host','member']));

CREATE OR REPLACE FUNCTION public.progress_core(_user uuid, _tz text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _tzv text := coalesce(nullif(_tz,''),'UTC'); _month date; _weeks date[]; _cur int := 0; _best int := 0; _run int := 0; _prev date; _w date; _this date;
  _res jsonb;
BEGIN
  BEGIN PERFORM now() AT TIME ZONE _tzv; EXCEPTION WHEN others THEN _tzv := 'UTC'; END;
  _month := date_trunc('month', now() AT TIME ZONE _tzv)::date;
  _this := date_trunc('week', now() AT TIME ZONE _tzv)::date;
  SELECT array_agg(DISTINCT date_trunc('week', r.checked_in_at AT TIME ZONE _tzv)::date ORDER BY date_trunc('week', r.checked_in_at AT TIME ZONE _tzv)::date)
    INTO _weeks FROM public.rsvps r WHERE r.user_id = _user AND r.checked_in_at IS NOT NULL;
  IF _weeks IS NOT NULL THEN
    FOREACH _w IN ARRAY _weeks LOOP
      IF _prev IS NOT NULL AND _w = _prev + 7 THEN _run := _run + 1; ELSE _run := 1; END IF;
      _best := greatest(_best, _run); _prev := _w;
    END LOOP;
    IF _prev >= _this - 7 THEN _cur := _run; END IF;
  END IF;
  SELECT jsonb_build_object(
    'attended', (SELECT count(*) FROM public.rsvps WHERE user_id = _user AND checked_in_at IS NOT NULL),
    'streak', _cur, 'best_streak', _best,
    'by_category', coalesce((SELECT jsonb_agg(jsonb_build_object('category', c, 'count', n) ORDER BY n DESC) FROM (
       SELECT coalesce(e.category,'other') c, count(*) n FROM public.rsvps r JOIN public.events e ON e.id = r.event_id
       WHERE r.user_id = _user AND r.checked_in_at IS NOT NULL GROUP BY 1) x), '[]'::jsonb),
    'lessons', (SELECT count(*) FROM public.lesson_progress WHERE user_id = _user AND completed_at IS NOT NULL),
    'month', jsonb_build_object(
      'start', _month,
      'gatherings', (SELECT count(*) FROM public.rsvps WHERE user_id = _user AND checked_in_at AT TIME ZONE _tzv >= _month),
      'goals_checked', (SELECT count(*) FROM public.progress_goal_checks WHERE user_id = _user AND checked_on >= _month),
      'new_people', (SELECT count(DISTINCT coalesce(o.user_id::text, lower(o.email), o.phone)) FROM public.rsvps m JOIN public.rsvps o ON o.event_id = m.event_id AND o.id <> m.id AND o.checked_in_at IS NOT NULL
         WHERE m.user_id = _user AND m.checked_in_at AT TIME ZONE _tzv >= _month AND coalesce(o.user_id::text, lower(o.email), o.phone) IS NOT NULL AND o.user_id IS DISTINCT FROM _user
         AND NOT EXISTS (SELECT 1 FROM public.rsvps pm JOIN public.rsvps po ON po.event_id = pm.event_id AND po.checked_in_at IS NOT NULL
           WHERE pm.user_id = _user AND pm.checked_in_at IS NOT NULL AND pm.checked_in_at AT TIME ZONE _tzv < _month
           AND coalesce(po.user_id::text, lower(po.email), po.phone) = coalesce(o.user_id::text, lower(o.email), o.phone))),
      'streak', _cur)) INTO _res;
  RETURN _res;
END $$;
REVOKE ALL ON FUNCTION public.progress_core(uuid, text) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.my_progress(_tz text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN auth.uid() IS NULL THEN NULL ELSE public.progress_core(auth.uid(), _tz) END
$$;
REVOKE ALL ON FUNCTION public.my_progress(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.my_progress(text) TO authenticated;

-- Coaches see progress only when the member shared it with that team
CREATE OR REPLACE FUNCTION public.shared_progress(_team uuid, _user uuid, _tz text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_team_member(_team, ARRAY['leader']) THEN RETURN NULL; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.progress_shares WHERE user_id = _user AND team_id = _team) THEN RETURN NULL; END IF;
  RETURN public.progress_core(_user, _tz) || jsonb_build_object(
    'goals', coalesce((SELECT jsonb_agg(jsonb_build_object('title', g.title, 'checks', (SELECT count(*) FROM public.progress_goal_checks c WHERE c.goal_id = g.id)) ORDER BY g.created_at) FROM public.progress_goals g WHERE g.user_id = _user AND NOT g.archived), '[]'::jsonb),
    'bests', coalesce((SELECT jsonb_agg(jsonb_build_object('label', b.label, 'value', b.value, 'unit', b.unit, 'recorded_on', b.recorded_on) ORDER BY b.recorded_on DESC) FROM (SELECT * FROM public.personal_bests WHERE user_id = _user ORDER BY recorded_on DESC LIMIT 10) b), '[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.shared_progress(uuid, uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.shared_progress(uuid, uuid, text) TO authenticated;