ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS whatsapp_url text CHECK (whatsapp_url IS NULL OR whatsapp_url ~ '^https://chat\.whatsapp\.com/[A-Za-z0-9]{10,40}$');
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS whatsapp_url text CHECK (whatsapp_url IS NULL OR whatsapp_url ~ '^https://chat\.whatsapp\.com/[A-Za-z0-9]{10,40}$');

CREATE TABLE public.discussion_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 120),
  created_by uuid NOT NULL,
  pinned boolean NOT NULL DEFAULT false,
  last_post_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.discussion_topics TO authenticated;
GRANT ALL ON public.discussion_topics TO service_role;
ALTER TABLE public.discussion_topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team members read topics" ON public.discussion_topics FOR SELECT TO authenticated USING (public.is_team_member(team_id, ARRAY['leader','host','member']));
CREATE INDEX discussion_topics_team_idx ON public.discussion_topics(team_id, pinned DESC, last_post_at DESC);

CREATE TABLE public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  topic_id uuid REFERENCES public.discussion_topics(id) ON DELETE CASCADE,
  team_id uuid NOT NULL,
  parent_id uuid REFERENCES public.comments(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  body text NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 2000),
  pinned boolean NOT NULL DEFAULT false,
  hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((event_id IS NULL) <> (topic_id IS NULL))
);
CREATE INDEX comments_event_idx ON public.comments(event_id, created_at);
CREATE INDEX comments_topic_idx ON public.comments(topic_id, created_at);

CREATE TABLE public.comment_reactions (
  comment_id uuid NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('heart','clap','highfive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, user_id, kind)
);

CREATE TABLE public.topic_reads (
  topic_id uuid NOT NULL REFERENCES public.discussion_topics(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (topic_id, user_id)
);

CREATE OR REPLACE FUNCTION public.can_join_conversation(_event uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM events e WHERE e.id = _event AND (
    is_team_member(e.team_id, ARRAY['leader','host','member']) OR can_manage_event(e.id)
    OR EXISTS (SELECT 1 FROM rsvps r WHERE r.event_id = e.id AND r.user_id = auth.uid() AND r.status NOT IN ('cancelled','declined'))));
$$;
CREATE OR REPLACE FUNCTION public.can_moderate_comment(_c uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM comments c WHERE c.id = _c AND (
    (c.event_id IS NOT NULL AND can_manage_event(c.event_id)) OR (c.topic_id IS NOT NULL AND is_team_member(c.team_id, ARRAY['leader']))));
$$;
CREATE OR REPLACE FUNCTION public.can_read_comment(_c uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM comments c WHERE c.id = _c AND (
    (c.event_id IS NOT NULL AND can_join_conversation(c.event_id)) OR (c.topic_id IS NOT NULL AND is_team_member(c.team_id, ARRAY['leader','host','member'])))
    AND (NOT c.hidden OR c.author_id = auth.uid() OR can_moderate_comment(c.id)));
$$;

GRANT SELECT ON public.comments TO authenticated;
GRANT ALL ON public.comments TO service_role;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants read comments" ON public.comments FOR SELECT TO authenticated USING (public.can_read_comment(id));

GRANT SELECT ON public.comment_reactions TO authenticated;
GRANT ALL ON public.comment_reactions TO service_role;
ALTER TABLE public.comment_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants read reactions" ON public.comment_reactions FOR SELECT TO authenticated USING (public.can_read_comment(comment_id));

GRANT SELECT ON public.topic_reads TO authenticated;
GRANT ALL ON public.topic_reads TO service_role;
ALTER TABLE public.topic_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own reads" ON public.topic_reads FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.post_comment(_event uuid, _topic uuid, _parent uuid, _body text, _mentions uuid[]) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _team uuid; _id uuid; p record; _title text; _name text; _url text; _m uuid; _key text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_allowed'; END IF;
  _body := trim(coalesce(_body,''));
  IF length(_body) < 1 OR length(_body) > 2000 THEN RAISE EXCEPTION 'invalid_body'; END IF;
  IF has_blocked_claim(_body) THEN RAISE EXCEPTION 'blocked_claim'; END IF;
  _key := 'comment:' || _uid;
  PERFORM pg_advisory_xact_lock(hashtextextended(_key, 0));
  IF (SELECT count(*) FROM rsvp_attempts WHERE key = _key AND created_at > clock_timestamp() - interval '1 minute') >= 10 THEN RAISE EXCEPTION 'rate_limited'; END IF;
  IF _event IS NOT NULL THEN
    IF NOT can_join_conversation(_event) THEN RAISE EXCEPTION 'not_allowed'; END IF;
    SELECT team_id, title INTO _team, _title FROM events WHERE id = _event;
    _url := '/event/' || _event;
  ELSIF _topic IS NOT NULL THEN
    SELECT team_id, title INTO _team, _title FROM discussion_topics WHERE id = _topic;
    IF _team IS NULL OR NOT is_team_member(_team, ARRAY['leader','host','member']) THEN RAISE EXCEPTION 'not_allowed'; END IF;
    _url := '/team?topic=' || _topic;
  ELSE RAISE EXCEPTION 'invalid'; END IF;
  IF _parent IS NOT NULL THEN
    SELECT * INTO p FROM comments WHERE id = _parent;
    IF p.id IS NULL OR p.parent_id IS NOT NULL OR p.event_id IS DISTINCT FROM _event OR p.topic_id IS DISTINCT FROM _topic THEN RAISE EXCEPTION 'invalid_parent'; END IF;
  END IF;
  INSERT INTO comments (event_id, topic_id, team_id, parent_id, author_id, body) VALUES (_event, _topic, _team, _parent, _uid, _body) RETURNING id INTO _id;
  INSERT INTO rsvp_attempts (key) VALUES (_key);
  IF _topic IS NOT NULL THEN UPDATE discussion_topics SET last_post_at = now() WHERE id = _topic;
    INSERT INTO topic_reads (topic_id, user_id) VALUES (_topic, _uid) ON CONFLICT (topic_id, user_id) DO UPDATE SET last_read_at = now(); END IF;
  SELECT full_name INTO _name FROM profiles WHERE id = _uid;
  IF p.id IS NOT NULL AND p.author_id <> _uid THEN
    PERFORM enqueue_message('push', p.author_id::text, coalesce((SELECT language FROM profiles WHERE id = p.author_id),'en'), 'comment_reply', 'conversation',
      jsonb_build_object('name', _name, 'title', _title, 'url', _url, 'snippet', left(_body, 120)), now(), _event, NULL, p.author_id, _team);
  END IF;
  FOREACH _m IN ARRAY coalesce(_mentions, '{}'::uuid[]) LOOP
    IF _m <> _uid AND _m IS DISTINCT FROM p.author_id AND is_member_of(_team, _m) THEN
      PERFORM enqueue_message('push', _m::text, coalesce((SELECT language FROM profiles WHERE id = _m),'en'), 'comment_mention', 'conversation',
        jsonb_build_object('name', _name, 'title', _title, 'url', _url, 'snippet', left(_body, 120)), now(), _event, NULL, _m, _team);
    END IF;
  END LOOP;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.is_member_of(_team uuid, _user uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM team_members WHERE team_id = _team AND user_id = _user);
$$;

CREATE OR REPLACE FUNCTION public.delete_comment(_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM comments WHERE id = _id AND (author_id = auth.uid() OR can_moderate_comment(_id))) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  DELETE FROM comments WHERE id = _id;
END $$;

CREATE OR REPLACE FUNCTION public.moderate_comment(_id uuid, _pinned boolean, _hidden boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT can_moderate_comment(_id) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  UPDATE comments SET pinned = coalesce(_pinned, pinned), hidden = coalesce(_hidden, hidden) WHERE id = _id;
END $$;

CREATE OR REPLACE FUNCTION public.toggle_comment_reaction(_id uuid, _kind text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _kind NOT IN ('heart','clap','highfive') OR NOT can_read_comment(_id) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  DELETE FROM comment_reactions WHERE comment_id = _id AND user_id = auth.uid() AND kind = _kind;
  IF FOUND THEN RETURN false; END IF;
  INSERT INTO comment_reactions (comment_id, user_id, kind) VALUES (_id, auth.uid(), _kind);
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.create_topic(_team uuid, _title text, _body text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid;
BEGIN
  IF NOT is_team_member(_team, ARRAY['leader']) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  _title := trim(coalesce(_title,'')); IF length(_title) NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION 'invalid_title'; END IF;
  IF has_blocked_claim(_title) THEN RAISE EXCEPTION 'blocked_claim'; END IF;
  INSERT INTO discussion_topics (team_id, title, created_by) VALUES (_team, _title, auth.uid()) RETURNING id INTO _id;
  IF length(trim(coalesce(_body,''))) > 0 THEN PERFORM post_comment(NULL, _id, NULL, _body, NULL); END IF;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.manage_topic(_id uuid, _pinned boolean, _delete boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _team uuid;
BEGIN
  SELECT team_id INTO _team FROM discussion_topics WHERE id = _id;
  IF _team IS NULL OR NOT is_team_member(_team, ARRAY['leader']) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  IF coalesce(_delete, false) THEN DELETE FROM discussion_topics WHERE id = _id; RETURN; END IF;
  UPDATE discussion_topics SET pinned = coalesce(_pinned, pinned) WHERE id = _id;
END $$;

CREATE OR REPLACE FUNCTION public.mark_topic_read(_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM discussion_topics WHERE id = _id AND is_team_member(team_id, ARRAY['leader','host','member'])) THEN RETURN; END IF;
  INSERT INTO topic_reads (topic_id, user_id) VALUES (_id, auth.uid()) ON CONFLICT (topic_id, user_id) DO UPDATE SET last_read_at = now();
END $$;

-- Reports for comments
ALTER TABLE public.reports DROP CONSTRAINT reports_target_type_check;
ALTER TABLE public.reports ADD CONSTRAINT reports_target_type_check CHECK (target_type = ANY (ARRAY['event','shoutout','photo','activity','announcement','comment']));
DO $do$ DECLARE d text; n text; BEGIN
  d := pg_get_functiondef('public.report_content(text,uuid,text,text)'::regprocedure);
  n := replace(d, '  ELSE RAISE EXCEPTION ''invalid_type''; END IF;', '  ELSIF _type = ''comment'' THEN
    SELECT team_id, author_id INTO _team, _author FROM comments WHERE id = _id;
    _ok := _uid IS NOT NULL AND can_read_comment(_id);
  ELSE RAISE EXCEPTION ''invalid_type''; END IF;');
  IF n = d THEN RAISE EXCEPTION 'patch failed'; END IF; EXECUTE n;
END $do$;

ALTER TABLE public.comments REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comments, public.comment_reactions, public.discussion_topics;

REVOKE ALL ON FUNCTION public.can_join_conversation(uuid), public.can_moderate_comment(uuid), public.can_read_comment(uuid), public.is_member_of(uuid,uuid),
  public.post_comment(uuid,uuid,uuid,text,uuid[]), public.delete_comment(uuid), public.moderate_comment(uuid,boolean,boolean), public.toggle_comment_reaction(uuid,text),
  public.create_topic(uuid,text,text), public.manage_topic(uuid,boolean,boolean), public.mark_topic_read(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.can_join_conversation(uuid), public.can_moderate_comment(uuid), public.can_read_comment(uuid),
  public.post_comment(uuid,uuid,uuid,text,uuid[]), public.delete_comment(uuid), public.moderate_comment(uuid,boolean,boolean), public.toggle_comment_reaction(uuid,text),
  public.create_topic(uuid,text,text), public.manage_topic(uuid,boolean,boolean), public.mark_topic_read(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.is_member_of(uuid,uuid) FROM authenticated;