CREATE OR REPLACE FUNCTION public.admin_user_detail(_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM public.admin_safety_guard();
 RETURN (SELECT jsonb_build_object('id',p.id,'full_name',p.full_name,'created_at',p.created_at,'suspended',EXISTS(SELECT 1 FROM user_suspensions WHERE user_id=p.id)) FROM profiles p WHERE p.id=_id);
END $$;
CREATE OR REPLACE FUNCTION public.admin_team_detail(_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM public.admin_safety_guard();
 RETURN (SELECT jsonb_build_object('id',t.id,'name',t.name,'created_at',t.created_at,'members',(SELECT count(*) FROM team_members WHERE team_id=t.id),'suspended',EXISTS(SELECT 1 FROM team_suspensions WHERE team_id=t.id)) FROM teams t WHERE t.id=_id);
END $$;