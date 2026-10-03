-- Team settings
ALTER TABLE public.teams ADD COLUMN allow_host_subteams boolean NOT NULL DEFAULT false;

-- Sub-team leaders must be able to edit their own team; parent/plan changes are guarded by a trigger instead.
DROP POLICY "Leaders update their team" ON public.teams;
CREATE POLICY "Leaders update their team" ON public.teams FOR UPDATE TO authenticated
  USING (public.is_team_member(id, ARRAY['leader'])) WITH CHECK (public.is_team_member(id, ARRAY['leader']));

CREATE OR REPLACE FUNCTION public.guard_team_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF coalesce(auth.jwt()->>'role','') = 'service_role' OR auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF NEW.plan IS DISTINCT FROM OLD.plan THEN RAISE EXCEPTION 'plan_locked'; END IF;
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id AND current_setting('gatherwell.transfer', true) IS DISTINCT FROM 'on' THEN RAISE EXCEPTION 'owner_locked'; END IF;
  IF NEW.parent_team_id IS DISTINCT FROM OLD.parent_team_id AND NEW.parent_team_id IS NOT NULL
     AND NOT public.is_team_member(NEW.parent_team_id, ARRAY['leader']) THEN RAISE EXCEPTION 'parent_not_allowed'; END IF;
  IF NEW.brand_color IS NOT NULL AND NEW.brand_color !~ '^#[0-9A-Fa-f]{6}$' THEN RAISE EXCEPTION 'invalid_color'; END IF;
  IF coalesce(trim(NEW.name),'') = '' OR length(NEW.name) > 80 THEN RAISE EXCEPTION 'invalid_name'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER guard_team_update BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION public.guard_team_update();

-- Announcements
CREATE TABLE public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  author_id uuid NOT NULL DEFAULT auth.uid(),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  photo_url text,
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team members read announcements" ON public.announcements FOR SELECT TO authenticated
  USING (public.is_team_member(team_id, ARRAY['leader','host','member']));
CREATE POLICY "Leaders post announcements" ON public.announcements FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND public.is_team_member(team_id, ARRAY['leader']));
CREATE POLICY "Leaders edit announcements" ON public.announcements FOR UPDATE TO authenticated
  USING (public.is_team_member(team_id, ARRAY['leader'])) WITH CHECK (public.is_team_member(team_id, ARRAY['leader']));
CREATE POLICY "Leaders delete announcements" ON public.announcements FOR DELETE TO authenticated
  USING (public.is_team_member(team_id, ARRAY['leader']));
CREATE INDEX announcements_team_idx ON public.announcements(team_id, created_at DESC);
CREATE UNIQUE INDEX announcements_one_pinned ON public.announcements(team_id) WHERE pinned;

CREATE OR REPLACE FUNCTION public.unpin_other_announcements()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.pinned THEN UPDATE public.announcements SET pinned = false WHERE team_id = NEW.team_id AND id <> NEW.id AND pinned; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER unpin_other_announcements BEFORE INSERT OR UPDATE OF pinned ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.unpin_other_announcements();

CREATE OR REPLACE FUNCTION public.log_announcement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.activity (team_id, actor_id, type, payload)
  VALUES (NEW.team_id, NEW.author_id, 'announcement_posted', jsonb_build_object('announcement_id', NEW.id, 'body', left(NEW.body, 280)));
  RETURN NEW;
END; $$;
CREATE TRIGGER on_announcement_posted AFTER INSERT ON public.announcements FOR EACH ROW EXECUTE FUNCTION public.log_announcement();

-- Reactions on wins
CREATE TABLE public.activity_reactions (
  activity_id uuid NOT NULL REFERENCES public.activity(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  kind text NOT NULL CHECK (kind IN ('like','celebrate','heart')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (activity_id, user_id, kind)
);
GRANT SELECT, INSERT, DELETE ON public.activity_reactions TO authenticated;
GRANT ALL ON public.activity_reactions TO service_role;
ALTER TABLE public.activity_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team members read reactions" ON public.activity_reactions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.activity a WHERE a.id = activity_id AND public.is_team_member(a.team_id, ARRAY['leader','host','member'])));
CREATE POLICY "Team members react" ON public.activity_reactions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.activity a WHERE a.id = activity_id AND public.is_team_member(a.team_id, ARRAY['leader','host','member'])));
CREATE POLICY "Remove own reaction" ON public.activity_reactions FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE INDEX activity_team_created_idx ON public.activity(team_id, created_at DESC);

-- Member joined + milestones (logged by trigger; join_team_by_code no longer logs itself)
CREATE OR REPLACE FUNCTION public.log_member_joined()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _n int;
BEGIN
  IF NEW.role = 'leader' AND NEW.user_id = (SELECT owner_id FROM public.teams WHERE id = NEW.team_id) THEN RETURN NEW; END IF;
  INSERT INTO public.activity (team_id, actor_id, type) VALUES (NEW.team_id, NEW.user_id, 'member_joined');
  SELECT count(*) INTO _n FROM public.team_members WHERE team_id = NEW.team_id;
  IF _n IN (10, 25, 50, 100, 250, 500, 1000) THEN
    INSERT INTO public.activity (team_id, actor_id, type, payload) VALUES (NEW.team_id, NULL, 'milestone', jsonb_build_object('members', _n));
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_member_joined AFTER INSERT ON public.team_members FOR EACH ROW EXECUTE FUNCTION public.log_member_joined();

CREATE OR REPLACE FUNCTION public.join_team_by_code(_code text, _role text DEFAULT 'member'::text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _team uuid; _r text := CASE WHEN _role = 'host' THEN 'host' ELSE 'member' END;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT id INTO _team FROM public.teams WHERE join_code = upper(trim(coalesce(_code,'')));
  IF _team IS NULL THEN RAISE EXCEPTION 'invalid_code'; END IF;
  INSERT INTO public.team_members (team_id, user_id, role) VALUES (_team, auth.uid(), _r) ON CONFLICT (team_id, user_id) DO NOTHING;
  RETURN _team;
END; $$;

-- Check-ins
CREATE OR REPLACE FUNCTION public.log_checkin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _team uuid; _title text;
BEGIN
  IF OLD.checked_in_at IS NULL AND NEW.checked_in_at IS NOT NULL THEN
    SELECT team_id, title INTO _team, _title FROM public.events WHERE id = NEW.event_id;
    INSERT INTO public.activity (team_id, actor_id, type, payload)
    VALUES (_team, NEW.user_id, 'checked_in', jsonb_build_object('event_id', NEW.event_id, 'title', _title,
      'guest', CASE WHEN NEW.user_id IS NULL THEN split_part(coalesce(NEW.guest_name,''), ' ', 1) END));
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_rsvp_checked_in AFTER UPDATE OF checked_in_at ON public.rsvps FOR EACH ROW EXECUTE FUNCTION public.log_checkin();

-- A team always keeps at least one leader (checked at commit so transfers can swap roles).
CREATE OR REPLACE FUNCTION public.ensure_team_has_leader()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.teams WHERE id = OLD.team_id)
     AND NOT EXISTS (SELECT 1 FROM public.team_members WHERE team_id = OLD.team_id AND role = 'leader') THEN
    RAISE EXCEPTION 'last_leader';
  END IF;
  RETURN NULL;
END; $$;
CREATE CONSTRAINT TRIGGER team_keeps_a_leader AFTER UPDATE OR DELETE ON public.team_members
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.ensure_team_has_leader();

CREATE OR REPLACE FUNCTION public.guard_member_role()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.role NOT IN ('leader','host','member') THEN RAISE EXCEPTION 'invalid_role'; END IF;
  IF TG_OP = 'UPDATE' AND (NEW.team_id <> OLD.team_id OR NEW.user_id <> OLD.user_id) THEN RAISE EXCEPTION 'immutable'; END IF;
  IF NEW.custom_badge IS NOT NULL AND length(NEW.custom_badge) > 24 THEN RAISE EXCEPTION 'badge_too_long'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER guard_member_role BEFORE INSERT OR UPDATE ON public.team_members FOR EACH ROW EXECUTE FUNCTION public.guard_member_role();

-- Leader RPCs
CREATE OR REPLACE FUNCTION public.transfer_leadership(_team uuid, _to uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.team_members WHERE team_id = _team AND user_id = auth.uid() AND role = 'leader') THEN RAISE EXCEPTION 'not_leader'; END IF;
  IF _to = auth.uid() OR NOT EXISTS (SELECT 1 FROM public.team_members WHERE team_id = _team AND user_id = _to) THEN RAISE EXCEPTION 'not_member'; END IF;
  UPDATE public.team_members SET role = 'leader' WHERE team_id = _team AND user_id = _to;
  UPDATE public.team_members SET role = 'host' WHERE team_id = _team AND user_id = auth.uid();
  PERFORM set_config('gatherwell.transfer', 'on', true);
  UPDATE public.teams SET owner_id = _to WHERE id = _team AND owner_id = auth.uid();
  PERFORM set_config('gatherwell.transfer', 'off', true);
  INSERT INTO public.activity (team_id, actor_id, type, payload) VALUES (_team, _to, 'leader_changed', '{}'::jsonb);
END; $$;

CREATE OR REPLACE FUNCTION public.reset_join_code(_team uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _code text;
BEGIN
  IF NOT public.is_team_member(_team, ARRAY['leader']) THEN RAISE EXCEPTION 'not_leader'; END IF;
  UPDATE public.teams SET join_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)) WHERE id = _team RETURNING join_code INTO _code;
  RETURN _code;
END; $$;

CREATE OR REPLACE FUNCTION public.create_subteam(_parent uuid, _name text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _base text; _slug text; _n int := 0; _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF NOT (public.is_team_member(_parent, ARRAY['leader'])
          OR (public.is_team_member(_parent, ARRAY['host']) AND (SELECT allow_host_subteams FROM public.teams WHERE id = _parent))) THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;
  IF coalesce(trim(_name),'') = '' OR length(_name) > 80 THEN RAISE EXCEPTION 'invalid_name'; END IF;
  _base := trim(both '-' from regexp_replace(lower(trim(_name)), '[^a-z0-9]+', '-', 'g'));
  IF _base = '' THEN _base := 'team'; END IF;
  _slug := _base;
  WHILE EXISTS (SELECT 1 FROM public.teams t WHERE t.slug = _slug) LOOP
    _n := _n + 1; _slug := _base || '-' || substr(md5(random()::text), 1, 4); EXIT WHEN _n > 20;
  END LOOP;
  INSERT INTO public.teams (name, slug, owner_id, parent_team_id) VALUES (trim(_name), _slug, auth.uid(), _parent) RETURNING id INTO _id;
  INSERT INTO public.activity (team_id, actor_id, type, payload) VALUES (_parent, auth.uid(), 'subteam_created', jsonb_build_object('team_id', _id, 'name', trim(_name)));
  RETURN _id;
END; $$;

-- Team tree: everyone sees their own team; leaders also see sub-teams beneath it.
CREATE OR REPLACE FUNCTION public.team_tree(_root uuid)
RETURNS TABLE (id uuid, name text, parent_team_id uuid, depth int, leader_name text, member_count int, events_this_month int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH RECURSIVE tree AS (
    SELECT t.id, t.name, t.parent_team_id, 0 AS depth FROM public.teams t
    WHERE t.id = _root AND public.is_team_member(_root, ARRAY['leader','host','member'])
    UNION ALL
    SELECT c.id, c.name, c.parent_team_id, tree.depth + 1 FROM public.teams c JOIN tree ON c.parent_team_id = tree.id
    WHERE tree.depth < 10 AND public.is_team_member(_root, ARRAY['leader'])
  )
  SELECT tree.id, tree.name, tree.parent_team_id, tree.depth,
    (SELECT p.full_name FROM public.team_members m JOIN public.profiles p ON p.id = m.user_id WHERE m.team_id = tree.id AND m.role = 'leader' ORDER BY m.joined_at LIMIT 1),
    (SELECT count(*)::int FROM public.team_members m WHERE m.team_id = tree.id),
    (SELECT count(*)::int FROM public.events e WHERE e.team_id = tree.id AND e.status <> 'cancelled'
       AND e.starts_at >= date_trunc('month', now()) AND e.starts_at < date_trunc('month', now()) + interval '1 month')
  FROM tree ORDER BY tree.depth, tree.name;
$$;

REVOKE EXECUTE ON FUNCTION public.transfer_leadership(uuid, uuid), public.reset_join_code(uuid), public.create_subteam(uuid, text), public.team_tree(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transfer_leadership(uuid, uuid), public.reset_join_code(uuid), public.create_subteam(uuid, text), public.team_tree(uuid) TO authenticated;