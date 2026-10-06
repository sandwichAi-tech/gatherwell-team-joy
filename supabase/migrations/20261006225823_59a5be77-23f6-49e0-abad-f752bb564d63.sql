-- Public profile slugs
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS slug text;
CREATE OR REPLACE FUNCTION public.make_profile_slug(_name text) RETURNS text LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _base text; _s text;
BEGIN
  _base := trim(both '-' from regexp_replace(lower(translate(coalesce(_name,''), 'áéíóúñüÁÉÍÓÚÑÜ', 'aeiounuAEIOUNU')), '[^a-z0-9]+', '-', 'g'));
  IF _base = '' THEN _base := 'host'; END IF;
  _base := left(_base, 40);
  LOOP
    _s := _base || '-' || substr(md5(gen_random_uuid()::text), 1, 4);
    EXIT WHEN NOT EXISTS (SELECT 1 FROM profiles WHERE slug = _s);
  END LOOP;
  RETURN _s;
END $$;
UPDATE public.profiles SET slug = public.make_profile_slug(full_name) WHERE slug IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_slug_key ON public.profiles(slug);
CREATE OR REPLACE FUNCTION public.profile_slug_default() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN IF NEW.slug IS NULL THEN NEW.slug := public.make_profile_slug(NEW.full_name); END IF; RETURN NEW; END $$;
DROP TRIGGER IF EXISTS profile_slug_default ON public.profiles;
CREATE TRIGGER profile_slug_default BEFORE INSERT OR UPDATE OF full_name ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.profile_slug_default();
REVOKE ALL ON FUNCTION public.make_profile_slug(text) FROM public, anon, authenticated;

-- Follows
CREATE TABLE public.follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_kind text NOT NULL CHECK (target_kind IN ('host','team')),
  target_id uuid NOT NULL,
  follower_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email text CHECK (email IS NULL OR email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  language text NOT NULL DEFAULT 'en',
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((follower_id IS NULL) <> (email IS NULL))
);
CREATE UNIQUE INDEX follows_user_key ON public.follows(target_kind, target_id, follower_id) WHERE follower_id IS NOT NULL;
CREATE UNIQUE INDEX follows_email_key ON public.follows(target_kind, target_id, lower(email)) WHERE email IS NOT NULL;
GRANT SELECT, DELETE ON public.follows TO authenticated;
GRANT ALL ON public.follows TO service_role;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "People see their own follows" ON public.follows FOR SELECT TO authenticated USING (follower_id = auth.uid());
CREATE POLICY "People remove their own follows" ON public.follows FOR DELETE TO authenticated USING (follower_id = auth.uid());

-- Private calendar feeds
CREATE TABLE public.calendar_feeds (
  token uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope text NOT NULL CHECK (scope IN ('me','team')),
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX calendar_feeds_owner ON public.calendar_feeds(user_id, scope, coalesce(team_id, '00000000-0000-0000-0000-000000000000'::uuid));
GRANT SELECT ON public.calendar_feeds TO authenticated;
GRANT ALL ON public.calendar_feeds TO service_role;
ALTER TABLE public.calendar_feeds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read their feeds" ON public.calendar_feeds FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Public pages
CREATE OR REPLACE FUNCTION public.public_upcoming(_host uuid, _team uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'title', e.title, 'starts_at', e.starts_at, 'timezone', e.timezone, 'location_name', e.location_name, 'category', e.category, 'online', e.online_url IS NOT NULL, 'cover_style', e.cover_style) ORDER BY e.starts_at), '[]'::jsonb)
  FROM (SELECT * FROM events WHERE status = 'published' AND visibility = 'public' AND starts_at > now() - interval '2 hours'
    AND ((_host IS NOT NULL AND host_id = _host) OR (_team IS NOT NULL AND team_id = _team)) ORDER BY starts_at LIMIT 20) e
$$;
REVOKE ALL ON FUNCTION public.public_upcoming(uuid, uuid) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_public_host(_slug text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE p profiles;
BEGIN
  SELECT * INTO p FROM profiles WHERE slug = lower(_slug);
  IF p.id IS NULL THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('id', p.id, 'name', p.full_name, 'avatar_url', p.avatar_url, 'city', p.city, 'bio', p.bio, 'shop_url', p.shop_url,
    'followers', (SELECT count(*) FROM follows WHERE target_kind = 'host' AND target_id = p.id),
    'following', auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM follows WHERE target_kind = 'host' AND target_id = p.id AND follower_id = auth.uid()),
    'upcoming', public.public_upcoming(p.id, NULL));
END $$;

CREATE OR REPLACE FUNCTION public.get_public_team(_slug text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE t teams;
BEGIN
  SELECT * INTO t FROM teams WHERE slug = lower(_slug);
  IF t.id IS NULL THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('id', t.id, 'name', t.name, 'cover_url', t.cover_url,
    'leader', (SELECT jsonb_build_object('name', full_name, 'slug', slug, 'avatar_url', avatar_url) FROM profiles WHERE id = t.owner_id),
    'members', (SELECT count(*) FROM team_members WHERE team_id = t.id),
    'followers', (SELECT count(*) FROM follows WHERE target_kind = 'team' AND target_id = t.id),
    'following', auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM follows WHERE target_kind = 'team' AND target_id = t.id AND follower_id = auth.uid()),
    'upcoming', public.public_upcoming(NULL, t.id));
END $$;
GRANT EXECUTE ON FUNCTION public.get_public_host(text), public.get_public_team(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.follow_target(_kind text, _target uuid, _email text DEFAULT NULL, _lang text DEFAULT 'en') RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _l text := CASE WHEN _lang = 'es' THEN 'es' ELSE 'en' END;
BEGIN
  IF _kind NOT IN ('host','team') THEN RAISE EXCEPTION 'invalid_target'; END IF;
  IF (_kind = 'host' AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = _target)) OR (_kind = 'team' AND NOT EXISTS (SELECT 1 FROM teams WHERE id = _target)) THEN RAISE EXCEPTION 'invalid_target'; END IF;
  IF auth.uid() IS NOT NULL THEN
    IF _kind = 'host' AND _target = auth.uid() THEN RAISE EXCEPTION 'self_follow'; END IF;
    INSERT INTO follows (target_kind, target_id, follower_id, language) VALUES (_kind, _target, auth.uid(), _l) ON CONFLICT DO NOTHING;
  ELSE
    IF _email IS NULL OR _email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR length(_email) > 254 THEN RAISE EXCEPTION 'invalid_email'; END IF;
    IF (SELECT count(*) FROM follows WHERE lower(email) = lower(trim(_email)) AND created_at > now() - interval '1 hour') >= 20 THEN RAISE EXCEPTION 'rate_limited'; END IF;
    INSERT INTO follows (target_kind, target_id, email, language) VALUES (_kind, _target, lower(trim(_email)), _l) ON CONFLICT DO NOTHING;
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.follow_target(text, uuid, text, text) TO anon, authenticated;

-- Notify followers when a public gathering is published
CREATE OR REPLACE FUNCTION public.notify_followers() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE f record; _p jsonb; _host text; _team text;
BEGIN
  IF NEW.status <> 'published' OR NEW.visibility <> 'public' OR NEW.starts_at < now() THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'published' AND OLD.visibility = 'public' THEN RETURN NEW; END IF;
  SELECT full_name INTO _host FROM profiles WHERE id = NEW.host_id;
  SELECT name INTO _team FROM teams WHERE id = NEW.team_id;
  _p := public.event_payload(NEW.id, NULL) || jsonb_build_object('host', _host, 'team', _team);
  FOR f IN SELECT DISTINCT ON (coalesce(follower_id::text, lower(email))) follower_id, email, language FROM follows
    WHERE (target_kind = 'host' AND target_id = NEW.host_id) OR (target_kind = 'team' AND target_id = NEW.team_id)
  LOOP
    IF f.follower_id IS NOT NULL THEN
      IF f.follower_id <> NEW.host_id THEN
        PERFORM enqueue_message('push', f.follower_id::text, coalesce((SELECT language FROM profiles WHERE id = f.follower_id), f.language), 'followed_gathering', 'announcements', _p, now(), NEW.id, NULL, f.follower_id, NEW.team_id);
      END IF;
    ELSE
      PERFORM enqueue_message('email', f.email, f.language, 'followed_gathering', 'announcements', _p, now(), NEW.id, NULL, NULL, NEW.team_id);
    END IF;
  END LOOP;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.notify_followers() FROM public, anon, authenticated;
CREATE TRIGGER notify_followers AFTER INSERT OR UPDATE OF status, visibility ON public.events FOR EACH ROW EXECUTE FUNCTION public.notify_followers();

-- Calendar feeds
CREATE OR REPLACE FUNCTION public.my_calendar_feeds() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _team uuid; _me uuid; _t uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  INSERT INTO calendar_feeds (user_id, scope) VALUES (_uid, 'me') ON CONFLICT DO NOTHING;
  SELECT token INTO _me FROM calendar_feeds WHERE user_id = _uid AND scope = 'me';
  SELECT active_team_id INTO _team FROM profiles WHERE id = _uid;
  IF _team IS NOT NULL AND is_team_member(_team, ARRAY['leader','host','member']) THEN
    INSERT INTO calendar_feeds (user_id, scope, team_id) VALUES (_uid, 'team', _team) ON CONFLICT DO NOTHING;
    SELECT token INTO _t FROM calendar_feeds WHERE user_id = _uid AND scope = 'team' AND team_id = _team;
  END IF;
  RETURN jsonb_build_object('me', _me, 'team', _t);
END $$;
CREATE OR REPLACE FUNCTION public.reset_calendar_feeds() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  DELETE FROM calendar_feeds WHERE user_id = auth.uid();
  RETURN public.my_calendar_feeds();
END $$;
GRANT EXECUTE ON FUNCTION public.my_calendar_feeds(), public.reset_calendar_feeds() TO authenticated;

CREATE OR REPLACE FUNCTION public.calendar_feed(_token uuid) RETURNS TABLE(id uuid, title text, starts_at timestamptz, ends_at timestamptz, location text, online boolean, status text, role text, updated timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE f calendar_feeds;
BEGIN
  SELECT * INTO f FROM calendar_feeds c WHERE c.token = _token;
  IF f.token IS NULL THEN RETURN; END IF;
  IF f.scope = 'me' THEN
    RETURN QUERY SELECT e.id, e.title, e.starts_at, e.ends_at, coalesce(nullif(concat_ws(', ', e.location_name, e.address), ''), NULL), e.online_url IS NOT NULL, e.status,
      CASE WHEN e.host_id = f.user_id THEN 'host' WHEN EXISTS (SELECT 1 FROM event_cohosts c WHERE c.event_id = e.id AND c.user_id = f.user_id) THEN 'cohost' ELSE 'guest' END, e.created_at
    FROM events e WHERE e.status IN ('published','cancelled') AND e.starts_at > now() - interval '60 days'
      AND (e.host_id = f.user_id OR EXISTS (SELECT 1 FROM event_cohosts c WHERE c.event_id = e.id AND c.user_id = f.user_id)
        OR EXISTS (SELECT 1 FROM rsvps r WHERE r.event_id = e.id AND r.user_id = f.user_id AND r.status IN ('going','waitlist')))
    ORDER BY e.starts_at LIMIT 500;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM team_members m WHERE m.team_id = f.team_id AND m.user_id = f.user_id) THEN RETURN; END IF;
    RETURN QUERY SELECT e.id, e.title, e.starts_at, e.ends_at, coalesce(nullif(concat_ws(', ', e.location_name, e.address), ''), NULL), e.online_url IS NOT NULL, e.status, 'team'::text, e.created_at
    FROM events e WHERE e.team_id = f.team_id AND e.status IN ('published','cancelled') AND e.visibility <> 'invite' AND e.starts_at > now() - interval '60 days'
    ORDER BY e.starts_at LIMIT 500;
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.calendar_feed(uuid) TO anon, authenticated;