CREATE OR REPLACE FUNCTION public.comment_feed(_event uuid, _topic uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _ok boolean; _mod boolean;
BEGIN
  IF _event IS NOT NULL THEN _ok := can_join_conversation(_event); _mod := can_manage_event(_event);
  ELSE SELECT is_team_member(team_id, ARRAY['leader','host','member']), is_team_member(team_id, ARRAY['leader']) INTO _ok, _mod FROM discussion_topics WHERE id = _topic; END IF;
  IF NOT coalesce(_ok,false) THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('can_moderate', coalesce(_mod,false), 'items', coalesce((SELECT jsonb_agg(jsonb_build_object(
    'id', c.id, 'parent_id', c.parent_id, 'author_id', c.author_id, 'name', p.full_name, 'avatar_url', p.avatar_url, 'body', c.body,
    'pinned', c.pinned, 'hidden', c.hidden, 'created_at', c.created_at,
    'reactions', (SELECT coalesce(jsonb_object_agg(k, n), '{}'::jsonb) FROM (SELECT kind k, count(*) n FROM comment_reactions WHERE comment_id = c.id GROUP BY kind) x),
    'mine', (SELECT coalesce(jsonb_agg(kind), '[]'::jsonb) FROM comment_reactions WHERE comment_id = c.id AND user_id = auth.uid())
  ) ORDER BY c.created_at) FROM comments c LEFT JOIN profiles p ON p.id = c.author_id
    WHERE (c.event_id = _event OR c.topic_id = _topic) AND (NOT c.hidden OR c.author_id = auth.uid() OR coalesce(_mod,false))), '[]'::jsonb));
END $$;
CREATE OR REPLACE FUNCTION public.team_topics(_team uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN NOT is_team_member(_team, ARRAY['leader','host','member']) THEN NULL ELSE coalesce((SELECT jsonb_agg(jsonb_build_object(
    'id', t.id, 'title', t.title, 'pinned', t.pinned, 'last_post_at', t.last_post_at, 'created_at', t.created_at,
    'posts', (SELECT count(*) FROM comments c WHERE c.topic_id = t.id AND NOT c.hidden),
    'unread', t.last_post_at > coalesce((SELECT last_read_at FROM topic_reads r WHERE r.topic_id = t.id AND r.user_id = auth.uid()), '-infinity'::timestamptz)
      AND EXISTS (SELECT 1 FROM comments c WHERE c.topic_id = t.id AND c.author_id <> auth.uid())
  ) ORDER BY t.pinned DESC, t.last_post_at DESC) FROM discussion_topics t WHERE t.team_id = _team), '[]'::jsonb) END;
$$;
REVOKE ALL ON FUNCTION public.comment_feed(uuid,uuid), public.team_topics(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.comment_feed(uuid,uuid), public.team_topics(uuid) TO authenticated;