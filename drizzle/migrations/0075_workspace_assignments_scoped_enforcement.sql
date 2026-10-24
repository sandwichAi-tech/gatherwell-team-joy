-- 0. Fix set_member_suspension: it wrote now() into workspace_role (rejected by guard trigger) instead of suspended_at
CREATE OR REPLACE FUNCTION public.set_member_suspension(_team uuid, _user uuid, _suspend boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.team_capability(_team, 'members') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF EXISTS (SELECT 1 FROM teams WHERE id = _team AND owner_id = _user) THEN RAISE EXCEPTION 'owner_role_fixed'; END IF;
  UPDATE team_members SET suspended_at = CASE WHEN _suspend THEN now() ELSE NULL END WHERE team_id = _team AND user_id = _user;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_member'; END IF;
  PERFORM public.team_log(_team, CASE WHEN _suspend THEN 'member_suspended' ELSE 'member_reactivated' END, _user, '{}');
END $$;

-- 1. Suspended memberships lose every legacy team capability too (is_team_member is used by many policies)
CREATE OR REPLACE FUNCTION public.is_team_member(_team_id uuid, _roles text[]) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH RECURSIVE ancestors AS (
    SELECT t.parent_team_id AS id, 1 AS depth FROM public.teams t WHERE t.id = _team_id
    UNION ALL
    SELECT t.parent_team_id, a.depth + 1 FROM public.teams t JOIN ancestors a ON t.id = a.id
    WHERE a.id IS NOT NULL AND a.depth < 20
  )
  SELECT auth.uid() IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.team_members m
            WHERE m.team_id = _team_id AND m.user_id = auth.uid()
              AND m.role = ANY(_roles) AND m.suspended_at IS NULL)
    OR EXISTS (SELECT 1 FROM public.team_members m JOIN ancestors a ON m.team_id = a.id
               WHERE m.user_id = auth.uid() AND m.role = 'leader' AND m.suspended_at IS NULL)
  );
$$;

-- 2. Scoped assignments: owner/admin delegate a specific event, content item, or moderation scope to a member
CREATE TABLE public.workspace_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  scope_type text NOT NULL,
  scope_id uuid NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoked_by uuid,
  CONSTRAINT workspace_assignments_scope_type CHECK (scope_type IN ('event', 'content', 'moderation'))
);
CREATE UNIQUE INDEX workspace_assignments_active_unique ON public.workspace_assignments (team_id, user_id, scope_type, scope_id) WHERE revoked_at IS NULL;
CREATE INDEX workspace_assignments_user_idx ON public.workspace_assignments (user_id) WHERE revoked_at IS NULL;
GRANT SELECT ON public.workspace_assignments TO authenticated;
GRANT ALL ON public.workspace_assignments TO service_role;
ALTER TABLE public.workspace_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Assignees and managers read assignments" ON public.workspace_assignments FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.team_capability(team_id, 'assign'));

-- 3. Active-assignment helper (assignee must be an active, unsuspended member)
CREATE OR REPLACE FUNCTION public.has_workspace_assignment(_team uuid, _user uuid, _scope_type text, _scope_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_assignments a
    JOIN team_members m ON m.team_id = a.team_id AND m.user_id = a.user_id AND m.suspended_at IS NULL
    WHERE a.team_id = _team AND a.user_id = _user AND a.scope_type = _scope_type AND a.scope_id = _scope_id AND a.revoked_at IS NULL)
$$;

-- 4. Create an assignment: owner/admin only, server-validated scope ownership and role compatibility
CREATE OR REPLACE FUNCTION public.assign_workspace_scope(_team uuid, _user uuid, _scope_type text, _scope_id uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _role text; _id uuid;
BEGIN
  IF NOT public.team_capability(_team, 'assign') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _scope_type NOT IN ('event', 'content', 'moderation') THEN RAISE EXCEPTION 'invalid_scope_type'; END IF;
  SELECT workspace_role INTO _role FROM team_members WHERE team_id = _team AND user_id = _user AND suspended_at IS NULL;
  IF _role IS NULL THEN RAISE EXCEPTION 'not_member'; END IF;
  IF _role IN ('owner', 'admin') THEN RAISE EXCEPTION 'role_needs_no_assignment'; END IF;
  IF (_scope_type = 'event' AND _role NOT IN ('host', 'checkin'))
     OR (_scope_type = 'content' AND _role NOT IN ('content_editor', 'host'))
     OR (_scope_type = 'moderation' AND _role NOT IN ('moderator')) THEN RAISE EXCEPTION 'invalid_scope_for_role'; END IF;
  IF _scope_type = 'event' AND NOT EXISTS (SELECT 1 FROM events WHERE id = _scope_id AND team_id = _team) THEN RAISE EXCEPTION 'scope_not_found'; END IF;
  IF _scope_type = 'content' AND NOT EXISTS (SELECT 1 FROM tracks WHERE id = _scope_id AND team_id = _team) AND NOT EXISTS (SELECT 1 FROM offers WHERE id = _scope_id AND team_id = _team) THEN RAISE EXCEPTION 'scope_not_found'; END IF;
  IF _scope_type = 'moderation' AND NOT EXISTS (SELECT 1 FROM events WHERE id = _scope_id AND team_id = _team) AND NOT EXISTS (SELECT 1 FROM discussion_topics WHERE id = _scope_id AND team_id = _team) THEN RAISE EXCEPTION 'scope_not_found'; END IF;
  INSERT INTO workspace_assignments (team_id, user_id, scope_type, scope_id, created_by) VALUES (_team, _user, _scope_type, _scope_id, auth.uid()) RETURNING id INTO _id;
  PERFORM public.team_log(_team, 'assignment_created', _user, jsonb_build_object('scope_type', _scope_type, 'scope_id', _scope_id));
  RETURN _id;
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'already_assigned';
END $$;
GRANT EXECUTE ON FUNCTION public.assign_workspace_scope(uuid, uuid, text, uuid) TO authenticated;

-- 5. Revoke or reactivate an assignment (owner/admin only, audited)
CREATE OR REPLACE FUNCTION public.set_workspace_assignment_active(_id uuid, _active boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _a workspace_assignments;
BEGIN
  SELECT * INTO _a FROM workspace_assignments WHERE id = _id;
  IF _a.id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF NOT public.team_capability(_a.team_id, 'assign') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _active THEN
    UPDATE workspace_assignments SET revoked_at = NULL, revoked_by = NULL WHERE id = _id;
    PERFORM public.team_log(_a.team_id, 'assignment_reactivated', _a.user_id, jsonb_build_object('scope_type', _a.scope_type, 'scope_id', _a.scope_id));
  ELSE
    UPDATE workspace_assignments SET revoked_at = now(), revoked_by = auth.uid() WHERE id = _id AND revoked_at IS NULL;
    PERFORM public.team_log(_a.team_id, 'assignment_revoked', _a.user_id, jsonb_build_object('scope_type', _a.scope_type, 'scope_id', _a.scope_id));
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.set_workspace_assignment_active(uuid, boolean) TO authenticated;

-- 6. List assignments with scope labels (owner/admin only)
CREATE OR REPLACE FUNCTION public.workspace_assignments_list(_team uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.team_capability(_team, 'assign') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', a.id, 'user_id', a.user_id, 'name', p.full_name, 'role', m.workspace_role,
    'scope_type', a.scope_type, 'scope_id', a.scope_id,
    'scope_label', coalesce(ev.title, tr.title_en, ofr.title_en, dt.title),
    'active', a.revoked_at IS NULL, 'created_at', a.created_at) ORDER BY a.created_at DESC), '[]'::jsonb)
    FROM workspace_assignments a
    JOIN team_members m ON m.team_id = a.team_id AND m.user_id = a.user_id
    LEFT JOIN profiles p ON p.id = a.user_id
    LEFT JOIN events ev ON a.scope_type IN ('event', 'moderation') AND ev.id = a.scope_id
    LEFT JOIN tracks tr ON a.scope_type = 'content' AND tr.id = a.scope_id
    LEFT JOIN offers ofr ON a.scope_type = 'content' AND ofr.id = a.scope_id
    LEFT JOIN discussion_topics dt ON a.scope_type = 'moderation' AND dt.id = a.scope_id
    WHERE a.team_id = _team);
END $$;
GRANT EXECUTE ON FUNCTION public.workspace_assignments_list(uuid) TO authenticated;

-- 7. Assignee reads own assignments (for interface-level gating)
CREATE OR REPLACE FUNCTION public.my_workspace_assignments(_team uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('scope_type', a.scope_type, 'scope_id', a.scope_id)), '[]'::jsonb)
  FROM workspace_assignments a WHERE a.team_id = _team AND a.user_id = auth.uid() AND a.revoked_at IS NULL
$$;
GRANT EXECUTE ON FUNCTION public.my_workspace_assignments(uuid) TO authenticated;

-- 8. Check-in access: event managers, or check-in staff with an active assignment to this event
CREATE OR REPLACE FUNCTION public.can_checkin_event(_event uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM events e WHERE e.id = _event AND (
    public.can_manage_event(e.id)
    OR (EXISTS (SELECT 1 FROM team_members m WHERE m.team_id = e.team_id AND m.user_id = auth.uid() AND m.workspace_role = 'checkin' AND m.suspended_at IS NULL)
        AND public.has_workspace_assignment(e.team_id, auth.uid(), 'event', e.id))))
$$;
GRANT EXECUTE ON FUNCTION public.can_checkin_event(uuid) TO authenticated;

-- 9. Rewire check-in writes to the check-in capability (was: full manage)
CREATE OR REPLACE FUNCTION public.check_in_rsvp(_rsvp uuid, _undo boolean DEFAULT false) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _ev uuid;
BEGIN
  SELECT event_id INTO _ev FROM public.rsvps WHERE id = _rsvp;
  IF _ev IS NULL OR NOT public.can_checkin_event(_ev) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  IF _undo THEN UPDATE public.rsvps SET checked_in_at = NULL WHERE id = _rsvp;
  ELSE UPDATE public.rsvps SET checked_in_at = coalesce(checked_in_at, now()), status = 'going' WHERE id = _rsvp; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.check_in_code(_event uuid, _code text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  IF NOT public.can_checkin_event(_event) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  SELECT id, guest_name, status, checked_in_at, plus_ones INTO r FROM public.rsvps WHERE event_id = _event AND checkin_code = trim(_code);
  IF NOT FOUND THEN RETURN jsonb_build_object('result', 'not_found'); END IF;
  IF r.checked_in_at IS NOT NULL THEN RETURN jsonb_build_object('result', 'already', 'name', r.guest_name, 'at', r.checked_in_at); END IF;
  UPDATE public.rsvps SET checked_in_at = now(), status = 'going' WHERE id = r.id;
  RETURN jsonb_build_object('result', 'ok', 'name', r.guest_name, 'plus_ones', r.plus_ones);
END $$;

-- 10. Minimal guest list for check-in: admission fields only, no contact/waiver/guardian/payment data.
--     Managers additionally get belonging fields used by the host check-in screen.
CREATE OR REPLACE FUNCTION public.checkin_guest_list(_event uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _manage boolean;
BEGIN
  IF NOT public.can_checkin_event(_event) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  _manage := public.can_manage_event(_event);
  RETURN (SELECT coalesce(jsonb_agg(row_to_json(x)::jsonb ORDER BY x.guest_name), '[]'::jsonb) FROM (
    SELECT r.id, r.guest_name, r.status, r.plus_ones, r.checked_in_at, r.is_walk_in,
      CASE WHEN _manage THEN r.wants_buddy ELSE NULL END AS wants_buddy,
      CASE WHEN _manage THEN r.small_group ELSE NULL END AS small_group,
      CASE WHEN _manage THEN r.buddy_rsvp_id ELSE NULL END AS buddy_rsvp_id
    FROM rsvps r WHERE r.event_id = _event AND r.status IN ('going', 'maybe', 'waitlist')) x);
END $$;
GRANT EXECUTE ON FUNCTION public.checkin_guest_list(uuid) TO authenticated;

-- 11. Workspace roles manage team events (owner/admin/host via 'events' capability; legacy leader/host rules unchanged)
CREATE OR REPLACE FUNCTION public.can_manage_event(_event_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.events e WHERE e.id = _event_id
      AND (e.host_id = auth.uid() OR public.is_team_member(e.team_id, ARRAY['leader'])
           OR public.team_capability(e.team_id, 'events')
           OR EXISTS (SELECT 1 FROM public.event_cohosts c WHERE c.event_id = e.id AND c.user_id = auth.uid()))
  );
$$;

-- 12. Participant contact details: host, co-host, or workspace event managers of the team (never check-in staff or content editors)
CREATE OR REPLACE FUNCTION public.can_access_event_participants(_event uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.events e WHERE e.id = _event
      AND (e.host_id = auth.uid() OR public.team_capability(e.team_id, 'events')
           OR EXISTS (SELECT 1 FROM public.event_cohosts c WHERE c.event_id = e.id AND c.user_id = auth.uid())));
$$;

-- 13. Workspace content roles edit team tracks (owner/admin/host/content_editor via 'content'; legacy leader unchanged)
CREATE OR REPLACE FUNCTION public.can_edit_track(_track uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.tracks t WHERE t.id = _track
    AND (public.is_team_member(t.team_id, ARRAY['leader']) OR public.team_capability(t.team_id, 'content')));
$$;

-- 14. Moderation: owner/admin via 'moderate', or a moderator with an active assignment to the comment's event/topic
CREATE OR REPLACE FUNCTION public.can_moderate_comment(_c uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM comments c WHERE c.id = _c AND (
    (c.event_id IS NOT NULL AND can_manage_event(c.event_id))
    OR (c.team_id IS NOT NULL AND public.team_capability(c.team_id, 'moderate'))
    OR (c.event_id IS NOT NULL AND public.has_workspace_assignment(c.team_id, auth.uid(), 'moderation', c.event_id))
    OR (c.topic_id IS NOT NULL AND public.has_workspace_assignment(c.team_id, auth.uid(), 'moderation', c.topic_id))
    OR (c.topic_id IS NOT NULL AND is_team_member(c.team_id, ARRAY['leader']))));
$$;

-- 15. Minimal moderation queue shell: comment excerpts with report counts per scope, assignment-aware
CREATE OR REPLACE FUNCTION public.moderation_queue(_team uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _full boolean;
BEGIN
  _full := public.team_capability(_team, 'moderate');
  IF NOT _full AND NOT EXISTS (SELECT 1 FROM workspace_assignments a JOIN team_members m ON m.team_id = a.team_id AND m.user_id = a.user_id AND m.suspended_at IS NULL
    WHERE a.team_id = _team AND a.user_id = auth.uid() AND a.scope_type = 'moderation' AND a.revoked_at IS NULL) THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'excerpt', left(c.body, 140), 'scope', CASE WHEN c.event_id IS NOT NULL THEN 'event' ELSE 'topic' END,
      'scope_id', coalesce(c.event_id, c.topic_id), 'reports', coalesce(rep.n, 0), 'created_at', c.created_at) ORDER BY c.created_at DESC), '[]'::jsonb)
    FROM comments c
    LEFT JOIN (SELECT target_id, count(*) AS n FROM reports WHERE target_kind = 'comment' GROUP BY target_id) rep ON rep.target_id = c.id
    WHERE c.team_id = _team AND c.deleted_at IS NULL
      AND (_full OR public.has_workspace_assignment(_team, auth.uid(), 'moderation', coalesce(c.event_id, c.topic_id))));
END $$;
GRANT EXECUTE ON FUNCTION public.moderation_queue(uuid) TO authenticated;

-- 16. Analyst surface: aggregate counts only, never row-level identities
CREATE OR REPLACE FUNCTION public.team_analytics_summary(_team uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.team_capability(_team, 'analytics') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN jsonb_build_object(
    'events_total', (SELECT count(*) FROM events WHERE team_id = _team AND status <> 'cancelled'),
    'events_upcoming', (SELECT count(*) FROM events WHERE team_id = _team AND status = 'published' AND starts_at > now()),
    'registrations_total', (SELECT count(*) FROM rsvps r JOIN events e ON e.id = r.event_id WHERE e.team_id = _team AND r.status IN ('going', 'maybe')),
    'checkins_total', (SELECT count(*) FROM rsvps r JOIN events e ON e.id = r.event_id WHERE e.team_id = _team AND r.checked_in_at IS NOT NULL),
    'members_active', (SELECT count(*) FROM team_members WHERE team_id = _team AND suspended_at IS NULL),
    'content_published', (SELECT count(*) FROM offers WHERE team_id = _team AND status = 'published'));
END $$;
GRANT EXECUTE ON FUNCTION public.team_analytics_summary(uuid) TO authenticated;

-- 17. RLS additions so workspace capabilities reach the Data API (legacy policies unchanged)
CREATE POLICY "Workspace event managers create events" ON public.events FOR INSERT TO authenticated WITH CHECK (public.team_capability(team_id, 'events'));
CREATE POLICY "Workspace event managers edit events" ON public.events FOR UPDATE TO authenticated USING (public.team_capability(team_id, 'events'));
CREATE POLICY "Workspace event managers delete events" ON public.events FOR DELETE TO authenticated USING (public.team_capability(team_id, 'events'));
CREATE POLICY "Workspace content editors create tracks" ON public.tracks FOR INSERT TO authenticated WITH CHECK (public.team_capability(team_id, 'content'));
CREATE POLICY "Workspace content editors edit tracks" ON public.tracks FOR UPDATE TO authenticated USING (public.team_capability(team_id, 'content'));
CREATE POLICY "Workspace content editors delete tracks" ON public.tracks FOR DELETE TO authenticated USING (public.team_capability(team_id, 'content'));
CREATE POLICY "Workspace content editors create team offers" ON public.offers FOR INSERT TO authenticated WITH CHECK (public.team_capability(team_id, 'content'));
CREATE POLICY "Workspace content editors edit team offers" ON public.offers FOR UPDATE TO authenticated USING (public.team_capability(team_id, 'content'));
CREATE POLICY "Workspace content editors create lessons" ON public.lessons FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM tracks t WHERE t.id = track_id AND public.team_capability(t.team_id, 'content')));

COMMENT ON TABLE public.workspace_assignments IS 'Owner/admin-delegated scopes (event, content, moderation) for limited workspace roles; writes only via assign_workspace_scope / set_workspace_assignment_active.';