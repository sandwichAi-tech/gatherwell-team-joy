CREATE OR REPLACE FUNCTION public.team_featured_gatherings(_team uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT is_team_member(_team, NULL) THEN RETURN '[]'::jsonb; END IF;
  RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object('id',e.id,'title',e.title,'starts_at',e.starts_at,'timezone',e.timezone,'location_name',e.location_name,'host_name',hp.full_name,'shared_by',fp.full_name,'shared_by_id',f.featured_by) ORDER BY e.starts_at)
    FROM network_features f JOIN events e ON e.id=f.event_id JOIN profiles hp ON hp.id=e.host_id JOIN profiles fp ON fp.id=f.featured_by
    WHERE f.team_id=_team AND e.status='published' AND e.starts_at > now() - interval '3 hours'),'[]');
END $$;