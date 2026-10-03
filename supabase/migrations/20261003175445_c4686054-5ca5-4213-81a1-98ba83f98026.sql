ALTER TABLE public.profiles ADD COLUMN active_team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_bio_len CHECK (bio IS NULL OR char_length(bio) <= 160);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_shop_https CHECK (shop_url IS NULL OR shop_url ~* '^https://[^\s/]+\.[^\s]+$');

-- Returns names of teams where the caller is the only leader (blocks account deletion).
CREATE OR REPLACE FUNCTION public.my_sole_leader_teams()
RETURNS TABLE (team_id uuid, team_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.id, t.name FROM public.team_members m JOIN public.teams t ON t.id = m.team_id
  WHERE m.user_id = auth.uid() AND m.role = 'leader'
    AND NOT EXISTS (SELECT 1 FROM public.team_members o WHERE o.team_id = m.team_id AND o.role = 'leader' AND o.user_id <> auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF EXISTS (SELECT 1 FROM public.my_sole_leader_teams()) THEN RAISE EXCEPTION 'sole_leader'; END IF;
  DELETE FROM public.team_members WHERE user_id = auth.uid();
  UPDATE public.rsvps SET user_id = NULL, guest_name = coalesce(guest_name, 'Former member'), guest_phone = NULL, guest_email = NULL WHERE user_id = auth.uid();
  DELETE FROM public.profiles WHERE id = auth.uid();
END; $$;

REVOKE EXECUTE ON FUNCTION public.my_sole_leader_teams(), public.delete_my_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_sole_leader_teams(), public.delete_my_account() TO authenticated;