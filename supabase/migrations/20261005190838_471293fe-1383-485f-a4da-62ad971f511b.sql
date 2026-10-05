DROP POLICY "Team can read license" ON public.team_licenses;
CREATE POLICY "Team can read license" ON public.team_licenses FOR SELECT TO authenticated USING (public.is_team_member(team_id, ARRAY['leader','host','member']));
REVOKE EXECUTE ON FUNCTION public.effective_plan(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.gatherings_this_month(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.storage_used_bytes(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.guest_cap(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_gathering_limit() FROM PUBLIC, anon, authenticated;