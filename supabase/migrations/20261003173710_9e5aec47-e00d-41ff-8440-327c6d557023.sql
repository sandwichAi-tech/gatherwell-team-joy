-- ============ TABLES ============
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  avatar_url text,
  phone text,
  language text NOT NULL DEFAULT 'en' CHECK (language IN ('en','es')),
  city text,
  bio text,
  shop_url text,
  role_intent text CHECK (role_intent IN ('leader','host','member')),
  onboarded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  parent_team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  cover_url text,
  brand_color text,
  join_code text NOT NULL UNIQUE DEFAULT upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free','growth','pro','team')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (parent_team_id IS NULL OR parent_team_id <> id)
);

CREATE TABLE public.team_members (
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('leader','host','member')),
  custom_badge text,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, user_id)
);

CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  host_id uuid NOT NULL DEFAULT auth.uid(),
  title text NOT NULL,
  description_en text,
  description_es text,
  cover_url text,
  theme text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  timezone text NOT NULL DEFAULT 'UTC',
  location_name text,
  address text,
  lat double precision,
  lng double precision,
  online_url text,
  capacity integer CHECK (capacity IS NULL OR capacity > 0),
  visibility text NOT NULL DEFAULT 'team' CHECK (visibility IN ('public','team')),
  recurrence text NOT NULL DEFAULT 'none' CHECK (recurrence IN ('none','weekly')),
  template_id uuid,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR ends_at >= starts_at)
);

CREATE TABLE public.rsvps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid,
  guest_name text,
  guest_phone text,
  guest_email text,
  language text NOT NULL DEFAULT 'en' CHECK (language IN ('en','es')),
  plus_ones integer NOT NULL DEFAULT 0 CHECK (plus_ones BETWEEN 0 AND 10),
  status text NOT NULL DEFAULT 'going' CHECK (status IN ('going','maybe','waitlist','cancelled')),
  sms_opt_in boolean NOT NULL DEFAULT false,
  email_opt_in boolean NOT NULL DEFAULT false,
  checkin_code text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text,'-',''),
  checked_in_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (user_id IS NOT NULL OR guest_name IS NOT NULL)
);

CREATE TABLE public.activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  actor_id uuid,
  type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============ GRANTS ============
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT SELECT ON public.events TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rsvps TO authenticated;
GRANT INSERT ON public.rsvps TO anon;
GRANT SELECT ON public.activity TO authenticated;
GRANT ALL ON public.profiles, public.teams, public.team_members, public.events, public.rsvps, public.activity TO service_role;

-- ============ RLS ON ============
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity ENABLE ROW LEVEL SECURITY;

-- ============ INDEXES ============
CREATE INDEX idx_teams_parent ON public.teams(parent_team_id);
CREATE INDEX idx_team_members_user ON public.team_members(user_id);
CREATE INDEX idx_events_team_id ON public.events(team_id);
CREATE INDEX idx_events_starts_at ON public.events(starts_at);
CREATE INDEX idx_events_public ON public.events(starts_at) WHERE visibility = 'public' AND status = 'published';
CREATE INDEX idx_rsvps_event_id ON public.rsvps(event_id);
CREATE INDEX idx_rsvps_user_id ON public.rsvps(user_id);
CREATE INDEX idx_activity_team_id ON public.activity(team_id, created_at DESC);

-- ============ HELPER FUNCTIONS ============
CREATE OR REPLACE FUNCTION public.is_team_member(_team_id uuid, _roles text[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH RECURSIVE ancestors AS (
    SELECT t.parent_team_id AS id, 1 AS depth FROM public.teams t WHERE t.id = _team_id
    UNION ALL
    SELECT t.parent_team_id, a.depth + 1 FROM public.teams t JOIN ancestors a ON t.id = a.id
    WHERE a.id IS NOT NULL AND a.depth < 20
  )
  SELECT auth.uid() IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.team_members m
            WHERE m.team_id = _team_id AND m.user_id = auth.uid()
              AND m.role = ANY(_roles))
    OR EXISTS (SELECT 1 FROM public.team_members m JOIN ancestors a ON m.team_id = a.id
               WHERE m.user_id = auth.uid() AND m.role = 'leader')
  );
$$;

CREATE OR REPLACE FUNCTION public.shares_team_with(_other uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members theirs
    WHERE theirs.user_id = _other
      AND public.is_team_member(theirs.team_id, ARRAY['leader','host','member'])
  );
$$;

-- ============ PROFILES ============
CREATE POLICY "Read own or teammates' profiles" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.shares_team_with(id));
CREATE POLICY "Insert own profile" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
CREATE POLICY "Update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, language)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url',
    CASE WHEN NEW.raw_user_meta_data->>'language' = 'es' THEN 'es' ELSE 'en' END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ TEAMS ============
CREATE POLICY "Members read their teams" ON public.teams FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.is_team_member(id, ARRAY['leader','host','member']));
CREATE POLICY "Signed-in users create teams" ON public.teams FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid()
    AND (parent_team_id IS NULL OR public.is_team_member(parent_team_id, ARRAY['leader'])));
CREATE POLICY "Leaders update their team" ON public.teams FOR UPDATE TO authenticated
  USING (public.is_team_member(id, ARRAY['leader']))
  WITH CHECK (public.is_team_member(id, ARRAY['leader'])
    AND (parent_team_id IS NULL OR public.is_team_member(parent_team_id, ARRAY['leader'])));
CREATE POLICY "Owner deletes team" ON public.teams FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

CREATE OR REPLACE FUNCTION public.handle_new_team()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.team_members (team_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'leader')
  ON CONFLICT (team_id, user_id) DO UPDATE SET role = 'leader';
  INSERT INTO public.activity (team_id, actor_id, type, payload)
  VALUES (NEW.id, NEW.owner_id, 'team_created', jsonb_build_object('name', NEW.name));
  RETURN NEW;
END; $$;
CREATE TRIGGER on_team_created AFTER INSERT ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_team();

-- ============ TEAM MEMBERS ============
CREATE POLICY "Members read team roster" ON public.team_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_team_member(team_id, ARRAY['leader','host','member']));
CREATE POLICY "Leaders add members" ON public.team_members FOR INSERT TO authenticated
  WITH CHECK (public.is_team_member(team_id, ARRAY['leader']));
CREATE POLICY "Leaders update members" ON public.team_members FOR UPDATE TO authenticated
  USING (public.is_team_member(team_id, ARRAY['leader']))
  WITH CHECK (public.is_team_member(team_id, ARRAY['leader']));
CREATE POLICY "Leaders remove members or members leave" ON public.team_members FOR DELETE TO authenticated
  USING (public.is_team_member(team_id, ARRAY['leader']) OR user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.join_team_by_code(_code text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _team uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT id INTO _team FROM public.teams WHERE join_code = upper(trim(_code));
  IF _team IS NULL THEN RAISE EXCEPTION 'Invalid join code'; END IF;
  INSERT INTO public.team_members (team_id, user_id, role) VALUES (_team, auth.uid(), 'member')
  ON CONFLICT (team_id, user_id) DO NOTHING;
  INSERT INTO public.activity (team_id, actor_id, type) VALUES (_team, auth.uid(), 'member_joined');
  RETURN _team;
END; $$;

-- ============ EVENTS ============
CREATE POLICY "Team members read team events" ON public.events FOR SELECT TO authenticated
  USING (public.is_team_member(team_id, ARRAY['leader','host','member']));
CREATE POLICY "Anyone reads public published events" ON public.events FOR SELECT TO anon, authenticated
  USING (visibility = 'public' AND status = 'published');
CREATE POLICY "Hosts and leaders create events" ON public.events FOR INSERT TO authenticated
  WITH CHECK (host_id = auth.uid() AND public.is_team_member(team_id, ARRAY['leader','host']));
CREATE POLICY "Hosts and leaders edit events" ON public.events FOR UPDATE TO authenticated
  USING (public.is_team_member(team_id, ARRAY['leader'])
         OR (host_id = auth.uid() AND public.is_team_member(team_id, ARRAY['host'])))
  WITH CHECK (public.is_team_member(team_id, ARRAY['leader','host']));
CREATE POLICY "Hosts and leaders delete events" ON public.events FOR DELETE TO authenticated
  USING (public.is_team_member(team_id, ARRAY['leader'])
         OR (host_id = auth.uid() AND public.is_team_member(team_id, ARRAY['host'])));

CREATE OR REPLACE FUNCTION public.log_event_published()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'published' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'published') THEN
    INSERT INTO public.activity (team_id, actor_id, type, payload)
    VALUES (NEW.team_id, auth.uid(), 'event_published', jsonb_build_object('event_id', NEW.id, 'title', NEW.title));
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_event_published AFTER INSERT OR UPDATE OF status ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.log_event_published();

-- ============ RSVPS ============
-- Contact details are visible only to the event host, team leaders, and the RSVP owner.
CREATE OR REPLACE FUNCTION public.can_manage_event(_event_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.events e WHERE e.id = _event_id
      AND (e.host_id = auth.uid() OR public.is_team_member(e.team_id, ARRAY['leader']))
  );
$$;

CREATE OR REPLACE FUNCTION public.can_rsvp_event(_event_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.events e WHERE e.id = _event_id AND e.status = 'published'
      AND (e.visibility = 'public' OR public.is_team_member(e.team_id, ARRAY['leader','host','member']))
  );
$$;

CREATE POLICY "Own RSVPs, hosts and leaders read" ON public.rsvps FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.can_manage_event(event_id));
CREATE POLICY "Guests RSVP to public published events" ON public.rsvps FOR INSERT TO anon
  WITH CHECK (user_id IS NULL AND checked_in_at IS NULL AND guest_name IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id
                AND e.visibility = 'public' AND e.status = 'published'));
CREATE POLICY "Signed-in users RSVP" ON public.rsvps FOR INSERT TO authenticated
  WITH CHECK ((user_id = auth.uid() OR (user_id IS NULL AND guest_name IS NOT NULL))
    AND checked_in_at IS NULL AND public.can_rsvp_event(event_id));
CREATE POLICY "Own RSVP or host/leader update" ON public.rsvps FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.can_manage_event(event_id))
  WITH CHECK (user_id = auth.uid() OR public.can_manage_event(event_id));
CREATE POLICY "Host or leader delete RSVP" ON public.rsvps FOR DELETE TO authenticated
  USING (public.can_manage_event(event_id));

-- Guest helpers keyed by checkin_code (no contact details returned to anonymous callers beyond their own).
CREATE OR REPLACE FUNCTION public.create_guest_rsvp(
  _event_id uuid, _guest_name text, _guest_phone text DEFAULT NULL, _guest_email text DEFAULT NULL,
  _language text DEFAULT 'en', _plus_ones integer DEFAULT 0,
  _sms_opt_in boolean DEFAULT false, _email_opt_in boolean DEFAULT false)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _code text;
BEGIN
  IF coalesce(trim(_guest_name),'') = '' OR length(_guest_name) > 120 THEN RAISE EXCEPTION 'Name required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.events WHERE id = _event_id AND visibility = 'public' AND status = 'published') THEN
    RAISE EXCEPTION 'Event not open for RSVPs';
  END IF;
  INSERT INTO public.rsvps (event_id, guest_name, guest_phone, guest_email, language, plus_ones, sms_opt_in, email_opt_in)
  VALUES (_event_id, trim(_guest_name), nullif(trim(_guest_phone),''), nullif(trim(_guest_email),''),
          CASE WHEN _language = 'es' THEN 'es' ELSE 'en' END, greatest(0, least(coalesce(_plus_ones,0), 10)),
          coalesce(_sms_opt_in,false), coalesce(_email_opt_in,false))
  RETURNING checkin_code INTO _code;
  RETURN _code;
END; $$;

CREATE OR REPLACE FUNCTION public.get_rsvp_by_code(_code text)
RETURNS TABLE (id uuid, event_id uuid, guest_name text, guest_phone text, guest_email text, language text,
               plus_ones integer, status text, sms_opt_in boolean, email_opt_in boolean,
               checked_in_at timestamptz, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, r.event_id, r.guest_name, r.guest_phone, r.guest_email, r.language, r.plus_ones,
         r.status, r.sms_opt_in, r.email_opt_in, r.checked_in_at, r.created_at
  FROM public.rsvps r WHERE r.checkin_code = _code AND length(_code) >= 16;
$$;

CREATE OR REPLACE FUNCTION public.cancel_rsvp_by_code(_code text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF length(coalesce(_code,'')) < 16 THEN RETURN false; END IF;
  UPDATE public.rsvps SET status = 'cancelled' WHERE checkin_code = _code AND status <> 'cancelled';
  RETURN FOUND;
END; $$;

CREATE OR REPLACE FUNCTION public.event_going_count(_event_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN public.can_rsvp_event(_event_id) OR public.can_manage_event(_event_id)
    THEN (SELECT coalesce(sum(1 + plus_ones),0)::int FROM public.rsvps WHERE event_id = _event_id AND status = 'going')
    ELSE 0 END;
$$;

CREATE OR REPLACE FUNCTION public.log_rsvp()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _team uuid;
BEGIN
  SELECT team_id INTO _team FROM public.events WHERE id = NEW.event_id;
  INSERT INTO public.activity (team_id, actor_id, type, payload)
  VALUES (_team, NEW.user_id, 'rsvp_created', jsonb_build_object('event_id', NEW.event_id, 'status', NEW.status));
  RETURN NEW;
END; $$;
CREATE TRIGGER on_rsvp_created AFTER INSERT ON public.rsvps
  FOR EACH ROW EXECUTE FUNCTION public.log_rsvp();

-- ============ ACTIVITY ============
CREATE POLICY "Team members read activity" ON public.activity FOR SELECT TO authenticated
  USING (public.is_team_member(team_id, ARRAY['leader','host','member']));

-- ============ FUNCTION EXECUTE PERMISSIONS ============
REVOKE EXECUTE ON FUNCTION public.handle_new_user(), public.handle_new_team(), public.log_event_published(), public.log_rsvp() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.join_team_by_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_team_by_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_guest_rsvp(uuid,text,text,text,text,integer,boolean,boolean), public.get_rsvp_by_code(text), public.cancel_rsvp_by_code(text), public.event_going_count(uuid) TO anon, authenticated;