REVOKE EXECUTE ON FUNCTION public.guard_team_update(), public.unpin_other_announcements(), public.log_announcement(), public.log_member_joined(), public.log_checkin(), public.ensure_team_has_leader() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.join_team_by_code(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_team_by_code(text, text) TO authenticated;