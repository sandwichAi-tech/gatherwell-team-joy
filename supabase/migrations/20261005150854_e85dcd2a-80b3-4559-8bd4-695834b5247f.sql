
CREATE TABLE public.challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  title_en text NOT NULL DEFAULT '', title_es text NOT NULL DEFAULT '',
  description_en text, description_es text,
  cover_url text, cover_style smallint NOT NULL DEFAULT 0,
  starts_on date NOT NULL, ends_on date NOT NULL,
  daily_prompt_en text, daily_prompt_es text,
  is_paid boolean NOT NULL DEFAULT false, price_cents integer,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_on >= starts_on AND ends_on - starts_on <= 365),
  CHECK (is_paid = false)
);
CREATE TABLE public.challenge_members (
  challenge_id uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (challenge_id, user_id)
);
CREATE TABLE public.challenge_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  checkin_date date NOT NULL,
  note text CHECK (char_length(note) <= 280),
  photo_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, user_id, checkin_date)
);
CREATE INDEX ON public.challenge_checkins(challenge_id, checkin_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.challenges TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.challenge_members TO authenticated;
GRANT SELECT ON public.challenge_checkins TO authenticated;
GRANT ALL ON public.challenges, public.challenge_members, public.challenge_checkins TO service_role;

ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_checkins ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_read_challenge(_c uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.challenges c WHERE c.id = _c AND (public.can_use_team_templates(c.team_id) OR public.is_team_member(c.team_id, ARRAY['leader'])));
$$;
REVOKE EXECUTE ON FUNCTION public.can_read_challenge(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_challenge(uuid) TO authenticated;

CREATE POLICY "Team and sub-team read challenges" ON public.challenges FOR SELECT TO authenticated USING (can_use_team_templates(team_id) OR is_team_member(team_id, ARRAY['leader']));
CREATE POLICY "Leaders create challenges" ON public.challenges FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() AND is_team_member(team_id, ARRAY['leader']));
CREATE POLICY "Leaders edit challenges" ON public.challenges FOR UPDATE TO authenticated USING (is_team_member(team_id, ARRAY['leader'])) WITH CHECK (is_team_member(team_id, ARRAY['leader']));
CREATE POLICY "Leaders delete challenges" ON public.challenges FOR DELETE TO authenticated USING (is_team_member(team_id, ARRAY['leader']));

CREATE POLICY "Read own membership" ON public.challenge_members FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Join readable challenges" ON public.challenge_members FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND can_read_challenge(challenge_id));
CREATE POLICY "Leave own membership" ON public.challenge_members FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Read own check-ins" ON public.challenge_checkins FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Streaks for one person: current (run ending at last check-in, if that is today or yesterday) and best
CREATE OR REPLACE FUNCTION public.challenge_streaks(_c uuid, _u uuid, _today date DEFAULT current_date)
RETURNS TABLE(checkins integer, current_streak integer, best_streak integer, last_date date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH d AS (SELECT checkin_date, checkin_date - (row_number() OVER (ORDER BY checkin_date))::int AS grp FROM public.challenge_checkins WHERE challenge_id = _c AND user_id = _u),
  runs AS (SELECT grp, count(*)::int AS len, max(checkin_date) AS last FROM d GROUP BY grp)
  SELECT (SELECT count(*)::int FROM d),
    coalesce((SELECT len FROM runs WHERE last = (SELECT max(last) FROM runs) AND last >= _today - 1), 0),
    coalesce((SELECT max(len) FROM runs), 0),
    (SELECT max(last) FROM runs);
$$;
REVOKE EXECUTE ON FUNCTION public.challenge_streaks(uuid, uuid, date) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.local_today(_tz text) RETURNS timestamp
LANGUAGE plpgsql STABLE SET search_path = public AS $$
BEGIN
  RETURN now() AT TIME ZONE coalesce(nullif(_tz, ''), 'UTC');
EXCEPTION WHEN others THEN RETURN now() AT TIME ZONE 'UTC';
END $$;
REVOKE EXECUTE ON FUNCTION public.local_today(text) FROM PUBLIC, anon, authenticated;

-- Check in for today (or yesterday until noon), member's time zone
CREATE OR REPLACE FUNCTION public.challenge_check_in(_c uuid, _date date, _tz text, _note text DEFAULT NULL, _photo text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _ch public.challenges; _local timestamp := public.local_today(_tz); _today date; _s record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_allowed'; END IF;
  _today := _local::date;
  SELECT * INTO _ch FROM public.challenges WHERE id = _c;
  IF NOT FOUND OR NOT public.can_read_challenge(_c) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.challenge_members WHERE challenge_id = _c AND user_id = auth.uid()) THEN RAISE EXCEPTION 'not_joined'; END IF;
  IF NOT (_date = _today OR (_date = _today - 1 AND _local::time < time '12:00')) THEN RAISE EXCEPTION 'date_closed'; END IF;
  IF _date < _ch.starts_on OR _date > _ch.ends_on THEN RAISE EXCEPTION 'out_of_range'; END IF;
  IF _photo IS NOT NULL AND split_part(_photo, '/', 1) <> auth.uid()::text THEN RAISE EXCEPTION 'not_allowed'; END IF;
  INSERT INTO public.challenge_checkins (challenge_id, user_id, checkin_date, note, photo_path)
  VALUES (_c, auth.uid(), _date, nullif(left(trim(coalesce(_note, '')), 280), ''), _photo)
  ON CONFLICT (challenge_id, user_id, checkin_date) DO NOTHING;
  SELECT * INTO _s FROM public.challenge_streaks(_c, auth.uid(), _today);
  RETURN jsonb_build_object('checkins', _s.checkins, 'current', _s.current_streak, 'best', _s.best_streak,
    'days', _ch.ends_on - _ch.starts_on + 1, 'finished', _s.checkins >= _ch.ends_on - _ch.starts_on + 1);
END $$;
REVOKE EXECUTE ON FUNCTION public.challenge_check_in(uuid, date, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.challenge_check_in(uuid, date, text, text, text) TO authenticated;

-- Leaderboard: names, check-ins and streaks only
CREATE OR REPLACE FUNCTION public.challenge_leaderboard(_c uuid, _tz text DEFAULT 'UTC')
RETURNS TABLE(user_id uuid, full_name text, checkins integer, current_streak integer, best_streak integer, rank integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _today date := public.local_today(_tz)::date;
BEGIN
  IF NOT public.can_read_challenge(_c) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  RETURN QUERY
  SELECT m.user_id, p.full_name, s.checkins, s.current_streak, s.best_streak,
    (rank() OVER (ORDER BY s.checkins DESC, s.current_streak DESC, s.best_streak DESC))::int
  FROM public.challenge_members m
  LEFT JOIN public.profiles p ON p.id = m.user_id
  CROSS JOIN LATERAL public.challenge_streaks(_c, m.user_id, _today) s
  WHERE m.challenge_id = _c
  ORDER BY 6, p.full_name NULLS LAST;
END $$;
REVOKE EXECUTE ON FUNCTION public.challenge_leaderboard(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.challenge_leaderboard(uuid, text) TO authenticated;

-- Joined counts (any reader) and leader stats
CREATE OR REPLACE FUNCTION public.challenge_counts(_ids uuid[])
RETURNS TABLE(challenge_id uuid, members integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, (SELECT count(*)::int FROM public.challenge_members m WHERE m.challenge_id = c.id)
  FROM public.challenges c WHERE c.id = ANY(_ids) AND public.can_read_challenge(c.id);
$$;
REVOKE EXECUTE ON FUNCTION public.challenge_counts(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.challenge_counts(uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.challenge_stats(_c uuid, _tz text DEFAULT 'UTC')
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _ch public.challenges; _today date := public.local_today(_tz)::date; _members int; _elapsed int; _total int;
BEGIN
  SELECT * INTO _ch FROM public.challenges WHERE id = _c;
  IF NOT FOUND OR NOT public.is_team_member(_ch.team_id, ARRAY['leader']) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  SELECT count(*) INTO _members FROM public.challenge_members WHERE challenge_id = _c;
  _elapsed := greatest(0, least(_today, _ch.ends_on) - _ch.starts_on + 1);
  SELECT count(*) INTO _total FROM public.challenge_checkins WHERE challenge_id = _c;
  RETURN jsonb_build_object('members', _members,
    'today', (SELECT count(*) FROM public.challenge_checkins WHERE challenge_id = _c AND checkin_date = _today),
    'elapsed', _elapsed,
    'completion', CASE WHEN _members = 0 OR _elapsed = 0 THEN 0 ELSE round(100.0 * _total / (_members * _elapsed)) END,
    'finishers', (SELECT count(*) FROM (SELECT user_id FROM public.challenge_checkins WHERE challenge_id = _c GROUP BY user_id HAVING count(*) >= _ch.ends_on - _ch.starts_on + 1) f));
END $$;
REVOKE EXECUTE ON FUNCTION public.challenge_stats(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.challenge_stats(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.post_challenge_encouragement(_c uuid, _message text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _ch public.challenges; _msg text := trim(coalesce(_message, ''));
BEGIN
  SELECT * INTO _ch FROM public.challenges WHERE id = _c;
  IF NOT FOUND OR NOT public.is_team_member(_ch.team_id, ARRAY['leader']) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  IF char_length(_msg) = 0 OR char_length(_msg) > 280 THEN RAISE EXCEPTION 'invalid_message'; END IF;
  INSERT INTO public.activity (team_id, actor_id, type, payload)
  VALUES (_ch.team_id, auth.uid(), 'challenge_cheer', jsonb_build_object('challenge_id', _c, 'title', _ch.title_en, 'title_es', _ch.title_es, 'body', _msg));
END $$;
REVOKE EXECUTE ON FUNCTION public.post_challenge_encouragement(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_challenge_encouragement(uuid, text) TO authenticated;

-- Activity: grouped joins (one row per challenge per 12h)
CREATE OR REPLACE FUNCTION public.log_challenge_joined() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _ch public.challenges; _row uuid; _name text;
BEGIN
  SELECT * INTO _ch FROM public.challenges WHERE id = NEW.challenge_id;
  SELECT full_name INTO _name FROM public.profiles WHERE id = NEW.user_id;
  SELECT id INTO _row FROM public.activity WHERE type = 'challenge_joined' AND payload->>'challenge_id' = NEW.challenge_id::text AND created_at > now() - interval '12 hours' ORDER BY created_at DESC LIMIT 1;
  IF _row IS NOT NULL THEN
    UPDATE public.activity SET payload = jsonb_set(payload, '{count}', to_jsonb(coalesce((payload->>'count')::int, 1) + 1)) WHERE id = _row;
  ELSE
    INSERT INTO public.activity (team_id, actor_id, type, payload)
    VALUES (_ch.team_id, NEW.user_id, 'challenge_joined', jsonb_build_object('challenge_id', _ch.id, 'title', _ch.title_en, 'title_es', _ch.title_es, 'count', 1));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER challenge_members_log AFTER INSERT ON public.challenge_members FOR EACH ROW EXECUTE FUNCTION public.log_challenge_joined();

-- Activity: 7-day streaks and finishers (once each per person)
CREATE OR REPLACE FUNCTION public.log_challenge_checkin() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _ch public.challenges; _s record; _days int;
BEGIN
  SELECT * INTO _ch FROM public.challenges WHERE id = NEW.challenge_id;
  _days := _ch.ends_on - _ch.starts_on + 1;
  SELECT * INTO _s FROM public.challenge_streaks(NEW.challenge_id, NEW.user_id, NEW.checkin_date);
  IF _s.current_streak = 7 AND NOT EXISTS (SELECT 1 FROM public.activity WHERE type = 'challenge_streak' AND actor_id = NEW.user_id AND payload->>'challenge_id' = NEW.challenge_id::text) THEN
    INSERT INTO public.activity (team_id, actor_id, type, payload) VALUES (_ch.team_id, NEW.user_id, 'challenge_streak', jsonb_build_object('challenge_id', _ch.id, 'title', _ch.title_en, 'title_es', _ch.title_es, 'days', 7));
  END IF;
  IF _s.checkins >= _days AND NOT EXISTS (SELECT 1 FROM public.activity WHERE type = 'challenge_finished' AND actor_id = NEW.user_id AND payload->>'challenge_id' = NEW.challenge_id::text) THEN
    INSERT INTO public.activity (team_id, actor_id, type, payload) VALUES (_ch.team_id, NEW.user_id, 'challenge_finished', jsonb_build_object('challenge_id', _ch.id, 'title', _ch.title_en, 'title_es', _ch.title_es, 'days', _days));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER challenge_checkins_log AFTER INSERT ON public.challenge_checkins FOR EACH ROW EXECUTE FUNCTION public.log_challenge_checkin();
REVOKE EXECUTE ON FUNCTION public.log_challenge_joined(), public.log_challenge_checkin() FROM PUBLIC, anon, authenticated;

-- Private progress photos: <user_id>/<challenge_id>/...
CREATE POLICY "Own challenge photos upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'challenge-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Own challenge photos read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'challenge-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Own challenge photos delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'challenge-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
