CREATE TABLE public.playbook_patterns (
  key text PRIMARY KEY,
  context text NOT NULL CHECK (context IN ('brief','insights','create')),
  category text,
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  gatherings integer NOT NULL,
  teams integer NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.playbook_patterns TO authenticated;
GRANT ALL ON public.playbook_patterns TO service_role;
ALTER TABLE public.playbook_patterns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in people read network patterns" ON public.playbook_patterns FOR SELECT TO authenticated USING (true);

-- Per-gathering anonymized metrics (no names, no contact details, no money)
CREATE OR REPLACE FUNCTION public.playbook_event_metrics(_since timestamptz)
RETURNS TABLE(event_id uuid, team_id uuid, category text, dow int, hr int, minutes int, going int, checkins int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT e.id, e.team_id, coalesce(e.category, 'more'),
    extract(dow FROM e.starts_at AT TIME ZONE e.timezone)::int,
    extract(hour FROM e.starts_at AT TIME ZONE e.timezone)::int,
    CASE WHEN e.ends_at IS NULL THEN 60 ELSE greatest(5, round(extract(epoch FROM e.ends_at - e.starts_at) / 60))::int END,
    (SELECT count(*) FROM rsvps r WHERE r.event_id = e.id AND (r.status IN ('going','checked_in') OR r.checked_in_at IS NOT NULL))::int,
    (SELECT count(*) FROM rsvps r WHERE r.event_id = e.id AND r.checked_in_at IS NOT NULL)::int
  FROM events e
  WHERE e.status = 'published' AND e.starts_at < now() AND e.starts_at >= _since;
$$;
REVOKE ALL ON FUNCTION public.playbook_event_metrics(timestamptz) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.compute_playbook()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _since timestamptz := now() - interval '180 days'; _n int;
BEGIN
  CREATE TEMP TABLE pb_m ON COMMIT DROP AS SELECT * FROM playbook_event_metrics(_since);
  DELETE FROM playbook_patterns WHERE true;

  -- Best time slot per gathering type (min 20 gatherings, 5 teams)
  INSERT INTO playbook_patterns(key, context, category, params, gatherings, teams)
  SELECT 'slot:' || s.category, 'brief', s.category,
    jsonb_build_object('dow', s.dow, 'hour', s.hr, 'ratio', round((s.avg_c / nullif(o.avg_c, 0))::numeric, 1)), s.n, s.t
  FROM (
    SELECT DISTINCT ON (category) category, dow, hr, avg(checkins)::float avg_c, count(*)::int n, count(DISTINCT team_id)::int t
    FROM pb_m GROUP BY category, dow, hr
    HAVING count(*) >= 20 AND count(DISTINCT team_id) >= 5
    ORDER BY category, avg(checkins) DESC
  ) s
  JOIN LATERAL (SELECT avg(checkins)::float avg_c FROM pb_m m WHERE m.category = s.category AND NOT (m.dow = s.dow AND m.hr = s.hr)) o ON true
  WHERE o.avg_c > 0 AND s.avg_c / o.avg_c >= 1.2;

  -- Best length per gathering type, by show-up rate
  INSERT INTO playbook_patterns(key, context, category, params, gatherings, teams)
  SELECT DISTINCT ON (category) 'length:' || category, 'create', category,
    jsonb_build_object('min', lo, 'max', lo + 15), n, t
  FROM (
    SELECT category, (minutes / 15) * 15 lo, sum(checkins)::float / nullif(sum(going), 0) rate, count(*)::int n, count(DISTINCT team_id)::int t
    FROM pb_m WHERE minutes BETWEEN 15 AND 240 GROUP BY category, (minutes / 15) * 15
    HAVING count(*) >= 20 AND count(DISTINCT team_id) >= 5
  ) b WHERE rate IS NOT NULL ORDER BY category, rate DESC;

  -- Follow-ups within 24 hours vs first-timer return rate
  WITH ft AS (
    SELECT r.id rsvp_id, r.event_id, m.team_id, e.starts_at, coalesce(r.user_id::text, guest_key_of(r.guest_email, r.guest_phone)) gk
    FROM rsvps r JOIN pb_m m ON m.event_id = r.event_id JOIN events e ON e.id = r.event_id
    WHERE r.checked_in_at IS NOT NULL
  ), first AS (
    SELECT f.* FROM ft f WHERE f.gk IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM rsvps r2 JOIN events e2 ON e2.id = r2.event_id
      WHERE r2.checked_in_at IS NOT NULL AND e2.starts_at < f.starts_at AND coalesce(r2.user_id::text, guest_key_of(r2.guest_email, r2.guest_phone)) = f.gk)
  ), scored AS (
    SELECT fi.*, EXISTS (SELECT 1 FROM followup_drafts d WHERE d.rsvp_id = fi.rsvp_id AND d.status = 'sent' AND d.sent_at <= fi.starts_at + interval '30 hours') fast,
      EXISTS (SELECT 1 FROM rsvps r3 JOIN events e3 ON e3.id = r3.event_id WHERE r3.checked_in_at IS NOT NULL AND e3.starts_at > fi.starts_at AND e3.starts_at <= fi.starts_at + interval '60 days'
        AND coalesce(r3.user_id::text, guest_key_of(r3.guest_email, r3.guest_phone)) = fi.gk) returned
    FROM first fi
  ), agg AS (
    SELECT count(DISTINCT event_id)::int n, count(DISTINCT team_id)::int t,
      avg(returned::int) FILTER (WHERE fast) fr, avg(returned::int) FILTER (WHERE NOT fast) sr,
      count(*) FILTER (WHERE fast) fc, count(*) FILTER (WHERE NOT fast) sc FROM scored
  )
  INSERT INTO playbook_patterns(key, context, category, params, gatherings, teams)
  SELECT 'followup', 'insights', NULL, jsonb_build_object('fast', round(fr * 100), 'slow', round(sr * 100)), n, t
  FROM agg WHERE n >= 20 AND t >= 5 AND fc >= 5 AND sc >= 5 AND fr > sr;

  SELECT count(*) INTO _n FROM playbook_patterns;
  RETURN _n;
END $$;
REVOKE ALL ON FUNCTION public.compute_playbook() FROM public, anon, authenticated;

-- Cards for a screen: real patterns first, otherwise labeled samples
CREATE OR REPLACE FUNCTION public.playbook_cards(_context text, _category text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _r jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_signed_in'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('kind', split_part(key, ':', 1), 'category', category, 'params', params, 'gatherings', gatherings, 'teams', teams, 'sample', false) ORDER BY gatherings DESC), '[]'::jsonb)
    INTO _r FROM (SELECT * FROM playbook_patterns WHERE context = _context AND (_category IS NULL OR category IS NULL OR category = _category) ORDER BY gatherings DESC LIMIT 2) p;
  IF jsonb_array_length(_r) > 0 THEN RETURN _r; END IF;
  RETURN CASE _context
    WHEN 'brief' THEN jsonb_build_array(jsonb_build_object('kind','slot','category',coalesce(_category,'fitcamp'),'params',jsonb_build_object('dow',6,'hour',8,'ratio',2.1),'sample',true))
    WHEN 'insights' THEN jsonb_build_array(jsonb_build_object('kind','followup','category',null,'params',jsonb_build_object('fast',46,'slow',28),'sample',true))
    ELSE jsonb_build_array(jsonb_build_object('kind','length','category',coalesce(_category,'more'),'params',jsonb_build_object('min',60,'max',75),'sample',true))
  END;
END $$;
REVOKE ALL ON FUNCTION public.playbook_cards(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.playbook_cards(text, text) TO authenticated;

-- Leader benchmark: team subtree vs network, activity only
CREATE OR REPLACE FUNCTION public.team_benchmark(_root uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _since timestamptz := now() - interval '90 days'; _team jsonb; _net jsonb; _nn int; _nt int;
BEGIN
  IF NOT is_team_member(_root, ARRAY['leader']) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  WITH RECURSIVE tree AS (SELECT id FROM teams WHERE id = _root UNION ALL SELECT t.id FROM teams t JOIN tree ON t.parent_team_id = tree.id),
  m AS (SELECT * FROM playbook_event_metrics(_since))
  SELECT jsonb_build_object('gatherings', count(*), 'avg_checkins', coalesce(round(avg(checkins)::numeric, 1), 0),
    'showup', coalesce(round(100.0 * sum(checkins) / nullif(sum(going), 0)), 0))
    INTO _team FROM m WHERE team_id IN (SELECT id FROM tree);
  SELECT jsonb_build_object('gatherings', count(*), 'avg_checkins', coalesce(round(avg(checkins)::numeric, 1), 0),
    'showup', coalesce(round(100.0 * sum(checkins) / nullif(sum(going), 0)), 0)), count(*), count(DISTINCT team_id)
    INTO _net, _nn, _nt FROM playbook_event_metrics(_since);
  IF _nn < 20 OR _nt < 5 THEN
    RETURN jsonb_build_object('team', _team, 'network', jsonb_build_object('gatherings', 240, 'avg_checkins', 9.4, 'showup', 72), 'sample', true);
  END IF;
  RETURN jsonb_build_object('team', _team, 'network', _net, 'sample', false);
END $$;
REVOKE ALL ON FUNCTION public.team_benchmark(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.team_benchmark(uuid) TO authenticated;

SELECT cron.schedule('gatherwell-playbook', '20 9 * * *', $cron$ SELECT public.compute_playbook(); $cron$);
SELECT public.compute_playbook();