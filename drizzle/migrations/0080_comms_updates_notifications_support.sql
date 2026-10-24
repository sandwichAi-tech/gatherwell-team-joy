-- In-app communications: host updates, notification center, discussion guards,
-- scoped moderation, blocks, contact-host threads, platform support tickets.

-- 1. Discussion toggles (default off; backfill on where comments already exist)
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS discussion_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS discussion_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.discussion_topics ADD COLUMN IF NOT EXISTS locked boolean NOT NULL DEFAULT false;
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS removed_at timestamptz;
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS removed_reason text;
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS removed_by uuid;
UPDATE public.events e SET discussion_enabled = true WHERE EXISTS (SELECT 1 FROM public.comments c WHERE c.event_id = e.id);

-- 2. Host updates (per offering; audience derived server-side at publish)
CREATE TABLE public.host_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid,
  author_id uuid NOT NULL,
  offering_kind text NOT NULL CHECK (offering_kind IN ('event','offer')),
  offering_id uuid NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  scheduled_at timestamptz,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.host_updates TO authenticated;
GRANT ALL ON public.host_updates TO service_role;
ALTER TABLE public.host_updates ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.update_reads (
  update_id uuid NOT NULL REFERENCES public.host_updates(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (update_id, user_id)
);
GRANT SELECT ON public.update_reads TO authenticated;
GRANT ALL ON public.update_reads TO service_role;
ALTER TABLE public.update_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY update_reads_own ON public.update_reads FOR SELECT TO authenticated USING (user_id = auth.uid());

-- 3. Notification center (idempotent via dedupe key)
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('announcement','conversation','moderation','ticket','learning','support')),
  title text NOT NULL,
  body text,
  link text,
  dedupe_key text UNIQUE,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON public.notifications (user_id, created_at DESC);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notifications_own_select ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY notifications_own_update ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 4. Community suspensions (scoped, not global) and user blocks
CREATE TABLE public.community_suspensions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL,
  user_id uuid NOT NULL,
  scope_type text NOT NULL CHECK (scope_type IN ('event','topic','team')),
  scope_id uuid,
  reason text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoked_by uuid
);
GRANT SELECT ON public.community_suspensions TO authenticated;
GRANT ALL ON public.community_suspensions TO service_role;
ALTER TABLE public.community_suspensions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_blocks (
  blocker_id uuid NOT NULL,
  blocked_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id)
);
GRANT SELECT, INSERT, DELETE ON public.user_blocks TO authenticated;
GRANT ALL ON public.user_blocks TO service_role;
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_blocks_own ON public.user_blocks FOR ALL TO authenticated USING (blocker_id = auth.uid()) WITH CHECK (blocker_id = auth.uid());

-- 5. Contact-host threads (tied to a registration/enrollment; no contact details exposed)
CREATE TABLE public.contact_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid,
  offer_id uuid,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((event_id IS NOT NULL)::int + (offer_id IS NOT NULL)::int = 1)
);
GRANT SELECT ON public.contact_threads TO authenticated;
GRANT ALL ON public.contact_threads TO service_role;
ALTER TABLE public.contact_threads ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.contact_threads(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.contact_messages TO authenticated;
GRANT ALL ON public.contact_messages TO service_role;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- 6. Platform support tickets (platform admins only — never routed to hosts)
CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  category text NOT NULL CHECK (category IN ('account','billing','safety','other')),
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','answered','closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY support_tickets_own ON public.support_tickets FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  is_staff boolean NOT NULL DEFAULT false,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.support_messages TO authenticated;
GRANT ALL ON public.support_messages TO service_role;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY support_messages_own ON public.support_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.support_tickets st WHERE st.id = ticket_id AND st.user_id = auth.uid()));

-- 7. Notification fan-out with dedupe + per-category preference respect
CREATE OR REPLACE FUNCTION public.notify_users(_user_ids uuid[], _kind text, _title text, _body text, _link text, _dedupe text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _n int;
BEGIN
  INSERT INTO public.notifications (user_id, kind, title, body, link, dedupe_key)
  SELECT u, _kind, left(_title, 140), left(coalesce(_body,''), 200), _link, _dedupe || ':' || u::text
  FROM unnest(_user_ids) AS u
  WHERE u IS NOT NULL
    AND coalesce((SELECT (p.notify_prefs ->> CASE _kind
        WHEN 'announcement' THEN 'announcements'
        WHEN 'conversation' THEN 'conversation'
        WHEN 'moderation' THEN 'announcements'
        WHEN 'ticket' THEN 'reminders'
        WHEN 'learning' THEN 'announcements'
        ELSE 'announcements' END)::boolean FROM public.profiles p WHERE p.id = u), true)
  ON CONFLICT (dedupe_key) DO NOTHING;
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END $$;

-- 8. Community guards on posting: adult-only, discussion toggle, locks, suspensions, blocks
CREATE OR REPLACE FUNCTION public.comments_community_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _host uuid; _parent_author uuid; _team uuid;
BEGIN
  IF NOT public.is_adult(NEW.author_id) THEN RAISE EXCEPTION 'adult_required'; END IF;
  IF NEW.event_id IS NOT NULL THEN
    SELECT e.team_id, e.host_id INTO _team, _host FROM public.events e WHERE e.id = NEW.event_id;
    IF NOT (SELECT discussion_enabled FROM public.events WHERE id = NEW.event_id) THEN RAISE EXCEPTION 'discussion_disabled'; END IF;
  ELSIF NEW.topic_id IS NOT NULL THEN
    SELECT t.team_id INTO _team FROM public.discussion_topics t WHERE t.id = NEW.topic_id;
    IF (SELECT locked FROM public.discussion_topics WHERE id = NEW.topic_id) THEN RAISE EXCEPTION 'topic_locked'; END IF;
  END IF;
  IF NEW.parent_id IS NOT NULL THEN
    SELECT c.author_id INTO _parent_author FROM public.comments c WHERE c.id = NEW.parent_id;
    IF (SELECT locked FROM public.discussion_topics t JOIN public.comments c ON c.topic_id = t.id WHERE c.id = NEW.parent_id) THEN RAISE EXCEPTION 'topic_locked'; END IF;
  END IF;
  IF _team IS NOT NULL AND EXISTS (SELECT 1 FROM public.community_suspensions s
    WHERE s.team_id = _team AND s.user_id = NEW.author_id AND s.revoked_at IS NULL
      AND (s.scope_type = 'team' OR (s.scope_type = 'event' AND s.scope_id = NEW.event_id) OR (s.scope_type = 'topic' AND s.scope_id = NEW.topic_id))) THEN
    RAISE EXCEPTION 'suspended';
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_blocks b WHERE b.blocked_id = NEW.author_id AND (b.blocker_id = _parent_author OR b.blocker_id = _host)) THEN
    RAISE EXCEPTION 'blocked';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER comments_guard BEFORE INSERT ON public.comments FOR EACH ROW EXECUTE FUNCTION public.comments_community_guard();

-- 9. Feed: hide authors the viewer blocked; expose removed state
CREATE OR REPLACE FUNCTION public.comment_feed(_event uuid, _topic uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _ok boolean; _mod boolean;
BEGIN
  IF _event IS NOT NULL THEN _ok := can_join_conversation(_event); _mod := can_manage_event(_event);
  ELSE SELECT is_team_member(team_id, ARRAY['leader','host','member']), is_team_member(team_id, ARRAY['leader']) INTO _ok, _mod FROM discussion_topics WHERE id = _topic; END IF;
  IF NOT coalesce(_ok,false) THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('can_moderate', coalesce(_mod,false), 'items', coalesce((SELECT jsonb_agg(jsonb_build_object(
    'id', c.id, 'parent_id', c.parent_id, 'author_id', c.author_id, 'name', p.full_name, 'avatar_url', p.avatar_url, 'body', c.body,
    'pinned', c.pinned, 'hidden', c.hidden, 'removed', c.removed_at IS NOT NULL, 'created_at', c.created_at,
    'reactions', (SELECT coalesce(jsonb_object_agg(k, n), '{}'::jsonb) FROM (SELECT kind k, count(*) n FROM comment_reactions WHERE comment_id = c.id GROUP BY kind) x),
    'mine', (SELECT coalesce(jsonb_agg(kind), '[]'::jsonb) FROM comment_reactions WHERE comment_id = c.id AND user_id = auth.uid())
  ) ORDER BY c.created_at) FROM comments c LEFT JOIN profiles p ON p.id = c.author_id
    WHERE (c.event_id = _event OR c.topic_id = _topic) AND (NOT c.hidden OR c.author_id = auth.uid() OR coalesce(_mod,false))
      AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE b.blocker_id = auth.uid() AND b.blocked_id = c.author_id)), '[]'::jsonb));
END $$;

-- 10. Moderation: pin/hide/lock/remove (reason required) with safe audit + author notice
CREATE OR REPLACE FUNCTION public.moderate_comment(_id uuid, _pinned boolean DEFAULT NULL, _hidden boolean DEFAULT NULL, _locked boolean DEFAULT NULL, _remove_reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _c public.comments; _team uuid;
BEGIN
  IF NOT can_moderate_comment(_id) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  SELECT * INTO _c FROM public.comments WHERE id = _id;
  IF _c.id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF _remove_reason IS NOT NULL AND length(trim(_remove_reason)) < 3 THEN RAISE EXCEPTION 'reason_required'; END IF;
  UPDATE public.comments SET
    pinned = coalesce(_pinned, pinned),
    hidden = coalesce(_hidden, hidden),
    removed_at = CASE WHEN _remove_reason IS NOT NULL THEN now() ELSE removed_at END,
    removed_reason = coalesce(_remove_reason, removed_reason),
    removed_by = CASE WHEN _remove_reason IS NOT NULL THEN auth.uid() ELSE removed_by END
  WHERE id = _id;
  IF _locked IS NOT NULL AND _c.topic_id IS NOT NULL THEN
    UPDATE public.discussion_topics SET locked = _locked WHERE id = _c.topic_id;
  END IF;
  _team := _c.team_id;
  IF _team IS NOT NULL THEN
    INSERT INTO public.team_audit (team_id, actor, action, target, meta)
    VALUES (_team, auth.uid(), CASE WHEN _remove_reason IS NOT NULL THEN 'comment_remove' WHEN coalesce(_hidden, false) THEN 'comment_hide' WHEN _hidden IS NOT NULL THEN 'comment_unhide' WHEN _locked IS NOT NULL THEN 'topic_lock' ELSE 'comment_pin' END,
      _id, jsonb_build_object('scope', coalesce(_c.event_id::text, _c.topic_id::text)));
  END IF;
  IF _remove_reason IS NOT NULL AND _c.author_id IS DISTINCT FROM auth.uid() THEN
    PERFORM public.notify_users(ARRAY[_c.author_id], 'moderation', 'A post was removed', NULL,
      CASE WHEN _c.event_id IS NOT NULL THEN '/event/' || _c.event_id ELSE '/team?topic=' || _c.topic_id END, 'mod-remove:' || _id::text);
  END IF;
END $$;

-- 11. Resolve/dismiss reports (reporter identity never returned)
CREATE OR REPLACE FUNCTION public.resolve_report(_id uuid, _action text, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _r public.reports;
BEGIN
  IF _action NOT IN ('resolved','dismissed') THEN RAISE EXCEPTION 'invalid_action'; END IF;
  SELECT * INTO _r FROM public.reports WHERE id = _id;
  IF _r.id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF NOT (public.team_capability(_r.team_id, 'moderate')
    OR public.has_workspace_assignment(_r.team_id, auth.uid(), 'moderation', _r.target_id)
    OR public.has_role(auth.uid(), 'admin')) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  UPDATE public.reports SET status = _action, resolved_by = auth.uid(), resolved_at = now(), resolution_note = nullif(left(trim(coalesce(_note,'')), 500), '') WHERE id = _id;
  IF _r.team_id IS NOT NULL THEN
    INSERT INTO public.team_audit (team_id, actor, action, target, meta) VALUES (_r.team_id, auth.uid(), 'report_' || _action, _id, jsonb_build_object('target_type', _r.target_type));
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.resolve_report(uuid, text, text) TO authenticated;

-- 12. Scoped community suspension (never global)
CREATE OR REPLACE FUNCTION public.suspend_community(_team uuid, _user uuid, _scope_type text, _scope_id uuid, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid;
BEGIN
  IF _scope_type NOT IN ('event','topic','team') THEN RAISE EXCEPTION 'invalid_scope'; END IF;
  IF length(trim(coalesce(_reason,''))) < 3 THEN RAISE EXCEPTION 'reason_required'; END IF;
  IF NOT (public.team_capability(_team, 'moderate') OR (_scope_type <> 'team' AND public.has_workspace_assignment(_team, auth.uid(), 'moderation', _scope_id))) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  INSERT INTO public.community_suspensions (team_id, user_id, scope_type, scope_id, reason, created_by)
  VALUES (_team, _user, _scope_type, CASE WHEN _scope_type = 'team' THEN NULL ELSE _scope_id END, left(trim(_reason), 500), auth.uid())
  RETURNING id INTO _id;
  INSERT INTO public.team_audit (team_id, actor, action, target, meta) VALUES (_team, auth.uid(), 'community_suspend', _id, jsonb_build_object('scope_type', _scope_type));
  PERFORM public.notify_users(ARRAY[_user], 'moderation', 'Community access limited', NULL, '/me', 'suspend:' || _id::text);
  RETURN _id;
END $$;
GRANT EXECUTE ON FUNCTION public.suspend_community(uuid, uuid, text, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.revoke_community_suspension(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _s public.community_suspensions;
BEGIN
  SELECT * INTO _s FROM public.community_suspensions WHERE id = _id;
  IF _s.id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF NOT public.team_capability(_s.team_id, 'moderate') THEN RAISE EXCEPTION 'not_allowed'; END IF;
  UPDATE public.community_suspensions SET revoked_at = now(), revoked_by = auth.uid() WHERE id = _id;
  INSERT INTO public.team_audit (team_id, actor, action, target, meta) VALUES (_s.team_id, auth.uid(), 'community_unsuspend', _id, '{}'::jsonb);
END $$;
GRANT EXECUTE ON FUNCTION public.revoke_community_suspension(uuid) TO authenticated;

-- 13. Block / unblock
CREATE OR REPLACE FUNCTION public.block_user(_user uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _user = auth.uid() THEN RAISE EXCEPTION 'invalid'; END IF;
  INSERT INTO public.user_blocks (blocker_id, blocked_id) VALUES (auth.uid(), _user) ON CONFLICT DO NOTHING;
END $$;
GRANT EXECUTE ON FUNCTION public.block_user(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.unblock_user(_user uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN DELETE FROM public.user_blocks WHERE blocker_id = auth.uid() AND blocked_id = _user; END $$;
GRANT EXECUTE ON FUNCTION public.unblock_user(uuid) TO authenticated;