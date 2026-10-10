CREATE OR REPLACE FUNCTION public.evaluate_milestones(_user uuid, _team uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _attended integer; _regulars integer;
BEGIN
  SELECT count(*) INTO _attended FROM public.rsvps r JOIN public.events e ON e.id = r.event_id
    WHERE r.user_id = _user AND e.team_id = _team AND r.checked_in_at IS NOT NULL;
  IF _attended >= 10 THEN PERFORM public.grant_auto_badge(_user, _team, 'milestone_attended_10'); END IF;
  IF _attended >= 25 THEN PERFORM public.grant_auto_badge(_user, _team, 'milestone_attended_25'); END IF;
  IF _attended >= 50 THEN PERFORM public.grant_auto_badge(_user, _team, 'milestone_attended_50'); END IF;
  IF _attended >= 100 THEN PERFORM public.grant_auto_badge(_user, _team, 'milestone_attended_100'); END IF;
  IF EXISTS (SELECT 1 FROM public.team_members WHERE team_id = _team AND user_id = _user AND joined_at <= now() - interval '1 year')
    THEN PERFORM public.grant_auto_badge(_user, _team, 'milestone_member_1yr'); END IF;
  IF EXISTS (SELECT 1 FROM public.events WHERE host_id = _user AND team_id = _team AND status = 'published')
    THEN PERFORM public.grant_auto_badge(_user, _team, 'milestone_first_host'); END IF;
  SELECT count(*) INTO _regulars FROM (
    SELECT DISTINCT coalesce(r.user_id::text, lower(r.email), r.phone) AS g
    FROM public.rsvps r JOIN public.events e ON e.id = r.event_id
    WHERE e.host_id = _user AND e.team_id = _team AND r.checked_in_at IS NOT NULL
    GROUP BY 1 HAVING count(*) >= 3) s;
  IF _regulars >= 10 THEN PERFORM public.grant_auto_badge(_user, _team, 'milestone_regulars_10'); END IF;
END $$;