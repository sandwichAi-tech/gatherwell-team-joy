-- moderation_queue referenced reports.target_kind; the column is target_type
CREATE OR REPLACE FUNCTION public.moderation_queue(_team uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _full boolean;
BEGIN
  _full := public.team_capability(_team, 'moderate');
  IF NOT _full AND NOT EXISTS (SELECT 1 FROM workspace_assignments a JOIN team_members m ON m.team_id = a.team_id AND m.user_id = a.user_id AND m.suspended_at IS NULL
    WHERE a.team_id = _team AND a.user_id = auth.uid() AND a.scope_type = 'moderation' AND a.revoked_at IS NULL) THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'excerpt', left(c.body, 140), 'scope', CASE WHEN c.event_id IS NOT NULL THEN 'event' ELSE 'topic' END,
      'scope_id', coalesce(c.event_id, c.topic_id), 'reports', coalesce(rep.n, 0), 'created_at', c.created_at) ORDER BY c.created_at DESC), '[]'::jsonb)
    FROM comments c
    LEFT JOIN (SELECT target_id, count(*) AS n FROM reports WHERE target_type = 'comment' GROUP BY target_id) rep ON rep.target_id = c.id
    WHERE c.team_id = _team AND c.deleted_at IS NULL
      AND (_full OR public.has_workspace_assignment(_team, auth.uid(), 'moderation', coalesce(c.event_id, c.topic_id))));
END $$;
GRANT EXECUTE ON FUNCTION public.moderation_queue(uuid) TO authenticated;