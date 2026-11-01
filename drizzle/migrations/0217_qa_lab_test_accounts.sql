ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

-- Only backend code (service role) can flag or unflag a test account; test accounts are never publicly listed.
CREATE OR REPLACE FUNCTION public.guard_profile_is_test() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.is_test IS DISTINCT FROM OLD.is_test
     AND coalesce(auth.role(), '') NOT IN ('service_role') AND current_user NOT IN ('postgres','supabase_admin') THEN
    NEW.is_test := OLD.is_test;
  END IF;
  IF TG_OP = 'INSERT' AND NEW.is_test AND coalesce(auth.role(), '') NOT IN ('service_role') AND current_user NOT IN ('postgres','supabase_admin') THEN
    NEW.is_test := false;
  END IF;
  IF NEW.is_test THEN NEW.host_public := false; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS profiles_is_test_guard ON public.profiles;
CREATE TRIGGER profiles_is_test_guard BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_is_test();

CREATE OR REPLACE FUNCTION public.is_test_user(_user uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT is_test FROM public.profiles WHERE id = _user), false)
$$;
GRANT EXECUTE ON FUNCTION public.is_test_user(uuid) TO authenticated, service_role;

-- Events hosted by a test account are always unlisted (invite-only).
CREATE OR REPLACE FUNCTION public.force_test_event_unlisted() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_test_user(NEW.host_id) AND NEW.visibility = 'public' THEN NEW.visibility := 'invite'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS events_test_unlisted ON public.events;
CREATE TRIGGER events_test_unlisted BEFORE INSERT OR UPDATE OF visibility, host_id ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.force_test_event_unlisted();

-- Hosts flagged as test are never publicly listed.
CREATE OR REPLACE FUNCTION public.host_publicly_listed(_host uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _host AND p.host_public AND NOT p.is_test)
     AND NOT EXISTS (SELECT 1 FROM public.user_suspensions s WHERE s.user_id = _host) $function$;

-- Teams owned by a test account have no public page; public member counts exclude test accounts.
CREATE OR REPLACE FUNCTION public.get_public_team(_slug text)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE t teams;
BEGIN
  SELECT * INTO t FROM teams WHERE slug = lower(_slug);
  IF t.id IS NULL OR public.is_test_user(t.owner_id) THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('id', t.id, 'name', t.name, 'cover_url', t.cover_url,
    'leader', (SELECT jsonb_build_object('name', full_name, 'slug', slug, 'avatar_url', avatar_url) FROM profiles WHERE id = t.owner_id),
    'members', (SELECT count(*) FROM team_members tm WHERE tm.team_id = t.id AND NOT public.is_test_user(tm.user_id)),
    'followers', (SELECT count(*) FROM follows WHERE target_kind = 'team' AND target_id = t.id),
    'following', auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM follows WHERE target_kind = 'team' AND target_id = t.id AND follower_id = auth.uid()),
    'upcoming', public.public_upcoming(NULL, t.id));
END $function$;

-- QA persona registry. Passwords are readable only by backend code (no client grants).
CREATE TABLE public.qa_test_accounts (
  persona text PRIMARY KEY,
  label text NOT NULL,
  user_id uuid,
  email text NOT NULL,
  phone text NOT NULL,
  password text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.qa_test_accounts TO service_role;
ALTER TABLE public.qa_test_accounts ENABLE ROW LEVEL SECURITY;

INSERT INTO public.feature_flags (key, enabled, description_en, description_es)
VALUES ('qa_lab', false, 'QA Lab test kit (admins only)', 'Laboratorio de pruebas (solo administradores)')
ON CONFLICT (key) DO NOTHING;