-- Subtree of a team (self included), only when the caller leads the root.
CREATE OR REPLACE FUNCTION public.team_insights(_root uuid, _scope uuid, _from timestamptz, _to timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _ids uuid[]; _len interval := _to - _from; _pf timestamptz := _from - (_to - _from); _weeks int; _res jsonb;
BEGIN
  IF NOT public.is_team_member(_root, ARRAY['leader']) THEN RAISE EXCEPTION 'not_leader'; END IF;
  WITH RECURSIVE tree AS (SELECT _root AS id, 0 AS d UNION ALL SELECT t.id, tree.d + 1 FROM public.teams t JOIN tree ON t.parent_team_id = tree.id WHERE tree.d < 10)
  SELECT array_agg(id) INTO _ids FROM tree;
  IF _scope IS NOT NULL AND _scope <> _root THEN
    IF NOT (_scope = ANY(_ids)) THEN RAISE EXCEPTION 'not_leader'; END IF;
    WITH RECURSIVE tree AS (SELECT _scope AS id, 0 AS d UNION ALL SELECT t.id, tree.d + 1 FROM public.teams t JOIN tree ON t.parent_team_id = tree.id WHERE tree.d < 10)
    SELECT array_agg(id) INTO _ids FROM tree;
  END IF;
  _weeks := greatest(8, ceil(extract(epoch FROM _len) / 604800)::int);

  WITH ev AS (SELECT * FROM public.events WHERE team_id = ANY(_ids) AND status = 'published'),
  rs AS (SELECT r.* FROM public.rsvps r JOIN ev ON ev.id = r.event_id),
  stat AS (
    SELECT
      (SELECT count(*) FROM ev WHERE starts_at >= _from AND starts_at < _to) AS g, (SELECT count(*) FROM ev WHERE starts_at >= _pf AND starts_at < _from) AS g_prev,
      (SELECT count(*) FROM rs WHERE status <> 'cancelled' AND created_at >= _from AND created_at < _to) AS r, (SELECT count(*) FROM rs WHERE status <> 'cancelled' AND created_at >= _pf AND created_at < _from) AS r_prev,
      (SELECT count(*) FROM rs WHERE checked_in_at >= _from AND checked_in_at < _to) AS c, (SELECT count(*) FROM rs WHERE checked_in_at >= _pf AND checked_in_at < _from) AS c_prev,
      (SELECT count(DISTINCT host_id) FROM ev WHERE starts_at >= _from AND starts_at < _to) AS h, (SELECT count(DISTINCT host_id) FROM ev WHERE starts_at >= _pf AND starts_at < _from) AS h_prev,
      (SELECT count(*) FROM public.team_members WHERE team_id = ANY(_ids) AND joined_at >= _from AND joined_at < _to) AS m, (SELECT count(*) FROM public.team_members WHERE team_id = ANY(_ids) AND joined_at >= _pf AND joined_at < _from) AS m_prev,
      (SELECT count(*) FROM public.activity WHERE team_id = ANY(_ids) AND type = 'template_launched' AND created_at >= _from AND created_at < _to) AS t, (SELECT count(*) FROM public.activity WHERE team_id = ANY(_ids) AND type = 'template_launched' AND created_at >= _pf AND created_at < _from) AS t_prev
  )
  SELECT jsonb_build_object(
    'stats', (SELECT to_jsonb(stat) FROM stat),
    'weekly', (SELECT coalesce(jsonb_agg(jsonb_build_object('week', w, 'count', (SELECT count(*) FROM rs WHERE checked_in_at >= w AND checked_in_at < w + interval '1 week')) ORDER BY w), '[]')
               FROM generate_series(date_trunc('week', _to) - make_interval(weeks => _weeks - 1), date_trunc('week', _to), interval '1 week') w),
    'top_hosts', (SELECT coalesce(jsonb_agg(x ORDER BY x.gatherings DESC, x.checkins DESC), '[]') FROM (
        SELECT ev.host_id AS user_id, p.full_name AS name, (SELECT tm.name FROM public.teams tm WHERE tm.id = min(ev.team_id::text)::uuid) AS team,
               count(DISTINCT ev.id) AS gatherings, (SELECT count(*) FROM rs WHERE rs.event_id = ANY(array_agg(ev.id)) AND rs.checked_in_at IS NOT NULL) AS checkins
        FROM ev LEFT JOIN public.profiles p ON p.id = ev.host_id WHERE ev.starts_at >= _from AND ev.starts_at < _to
        GROUP BY ev.host_id, p.full_name ORDER BY gatherings DESC LIMIT 10) x),
    'templates', (SELECT coalesce(jsonb_agg(x ORDER BY x.launches DESC, x.checkins DESC), '[]') FROM (
        SELECT tp.id, tp.title, count(DISTINCT e.id) AS launches,
               (SELECT count(*) FROM public.rsvps r JOIN public.events e2 ON e2.id = r.event_id WHERE e2.template_id = tp.id AND e2.team_id = ANY(_ids) AND r.checked_in_at IS NOT NULL) AS checkins
        FROM public.templates tp LEFT JOIN public.events e ON e.template_id = tp.id AND e.team_id = ANY(_ids)
        WHERE tp.team_id = ANY(_ids) OR tp.team_id = _root GROUP BY tp.id, tp.title) x),
    'nudge', (SELECT coalesce(jsonb_agg(x ORDER BY x.last_hosted NULLS FIRST), '[]') FROM (
        SELECT DISTINCT ON (m.user_id) m.user_id, p.full_name AS name, tm.name AS team,
               (SELECT max(e.starts_at) FROM public.events e WHERE e.host_id = m.user_id AND e.team_id = ANY(_ids) AND e.status <> 'cancelled' AND e.starts_at <= now()) AS last_hosted
        FROM public.team_members m JOIN public.teams tm ON tm.id = m.team_id LEFT JOIN public.profiles p ON p.id = m.user_id
        WHERE m.team_id = ANY(_ids) AND m.role = 'host' AND m.user_id <> auth.uid()
          AND NOT EXISTS (SELECT 1 FROM public.events e WHERE e.host_id = m.user_id AND e.status <> 'cancelled'
                          AND (e.starts_at >= now() - interval '30 days' OR e.created_at >= now() - interval '30 days'))
        ORDER BY m.user_id) x)
  ) INTO _res;
  RETURN _res;
END; $$;

CREATE OR REPLACE FUNCTION public.post_shoutout(_team uuid, _to uuid, _message text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _name text;
BEGIN
  IF NOT public.is_team_member(_team, ARRAY['leader']) THEN RAISE EXCEPTION 'not_leader'; END IF;
  IF coalesce(trim(_message),'') = '' OR length(_message) > 280 THEN RAISE EXCEPTION 'invalid_message'; END IF;
  SELECT full_name INTO _name FROM public.profiles WHERE id = _to;
  INSERT INTO public.activity (team_id, actor_id, type, payload)
  VALUES (_team, auth.uid(), 'shoutout', jsonb_build_object('to', _to, 'to_name', coalesce(_name, ''), 'body', trim(_message)));
END; $$;

REVOKE EXECUTE ON FUNCTION public.team_insights(uuid, uuid, timestamptz, timestamptz), public.post_shoutout(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.team_insights(uuid, uuid, timestamptz, timestamptz), public.post_shoutout(uuid, uuid, text) TO authenticated;