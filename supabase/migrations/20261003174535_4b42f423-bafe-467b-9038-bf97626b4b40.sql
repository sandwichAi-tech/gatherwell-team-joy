-- Storage: people manage files in their own folder; teammates can view them.
CREATE POLICY "Upload to own media folder" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Update own media" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Delete own media" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Read own or teammates' media" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'media' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.shares_team_with(((storage.foldername(name))[1])::uuid)
  ));

-- Join with a chosen role (member or host only).
DROP FUNCTION IF EXISTS public.join_team_by_code(text);
CREATE OR REPLACE FUNCTION public.join_team_by_code(_code text, _role text DEFAULT 'member')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _team uuid; _r text := CASE WHEN _role = 'host' THEN 'host' ELSE 'member' END;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT id INTO _team FROM public.teams WHERE join_code = upper(trim(coalesce(_code,'')));
  IF _team IS NULL THEN RAISE EXCEPTION 'invalid_code'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.team_members WHERE team_id = _team AND user_id = auth.uid()) THEN
    INSERT INTO public.team_members (team_id, user_id, role) VALUES (_team, auth.uid(), _r);
    INSERT INTO public.activity (team_id, actor_id, type) VALUES (_team, auth.uid(), 'member_joined');
  END IF;
  RETURN _team;
END; $$;
REVOKE EXECUTE ON FUNCTION public.join_team_by_code(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_team_by_code(text, text) TO authenticated;

-- Invite preview: team name and leader's name for a valid code (no other data).
CREATE OR REPLACE FUNCTION public.get_team_invite(_code text)
RETURNS TABLE (team_id uuid, team_name text, leader_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.id, t.name, p.full_name
  FROM public.teams t LEFT JOIN public.profiles p ON p.id = t.owner_id
  WHERE length(coalesce(_code,'')) >= 6 AND t.join_code = upper(trim(_code));
$$;
GRANT EXECUTE ON FUNCTION public.get_team_invite(text) TO anon, authenticated;

-- Create a team with a unique slug; the existing trigger adds the creator as leader.
CREATE OR REPLACE FUNCTION public.create_team(_name text)
RETURNS TABLE (id uuid, slug text, join_code text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _base text; _slug text; _n int := 0; _row public.teams;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF coalesce(trim(_name),'') = '' OR length(_name) > 80 THEN RAISE EXCEPTION 'invalid_name'; END IF;
  _base := trim(both '-' from regexp_replace(lower(trim(_name)), '[^a-z0-9]+', '-', 'g'));
  IF _base = '' THEN _base := 'team'; END IF;
  _slug := _base;
  WHILE EXISTS (SELECT 1 FROM public.teams t WHERE t.slug = _slug) LOOP
    _n := _n + 1; _slug := _base || '-' || substr(md5(random()::text), 1, 4);
    EXIT WHEN _n > 20;
  END LOOP;
  INSERT INTO public.teams (name, slug, owner_id) VALUES (trim(_name), _slug, auth.uid()) RETURNING * INTO _row;
  RETURN QUERY SELECT _row.id, _row.slug, _row.join_code;
END; $$;
REVOKE EXECUTE ON FUNCTION public.create_team(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_team(text) TO authenticated;