-- Pending schema repair: apply ONLY with the migration tool once its target is confirmed disposable.
-- This is not an applied Drizzle migration. No shared database was changed in this sprint.
CREATE OR REPLACE FUNCTION public.team_member_active(_team uuid, _user uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT public.team_channel_access(_team, _user) AND EXISTS(SELECT 1 FROM public.team_members m WHERE m.team_id=_team AND m.user_id=_user AND m.suspended_at IS NULL AND m.role IN ('leader','host','member'))
$$;
CREATE OR REPLACE FUNCTION public.reset_team_metric_consent() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP='DELETE' THEN DELETE FROM public.team_metric_shares WHERE team_id=OLD.team_id AND user_id=OLD.user_id; RETURN OLD; END IF;
 IF TG_OP='INSERT' OR NEW.suspended_at IS DISTINCT FROM OLD.suspended_at OR NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.team_id IS DISTINCT FROM OLD.team_id THEN
  DELETE FROM public.team_metric_shares WHERE team_id=NEW.team_id AND user_id=NEW.user_id;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER team_metric_consent_membership AFTER INSERT OR UPDATE OR DELETE ON public.team_members FOR EACH ROW EXECUTE FUNCTION public.reset_team_metric_consent();
REVOKE ALL ON FUNCTION public.reset_team_metric_consent() FROM PUBLIC, anon, authenticated;
CREATE POLICY metric_choices_active ON public.team_metric_shares AS RESTRICTIVE FOR SELECT TO authenticated USING(user_id=auth.uid() AND public.team_member_active(team_id,auth.uid()));
-- Keep existing allowlisted aggregate projection; replace only authority and attendance eligibility.
DO $$ DECLARE body text; BEGIN
 body:=pg_get_functiondef('public.team_member_insights(uuid,uuid)'::regprocedure);
 body:=replace(body, 'IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.teams WHERE id = _team AND owner_id = auth.uid())', 'IF auth.uid() IS NULL OR NOT public.team_channel_owner(_team)');
 body:=replace(body, 'r.checked_in_at IS NOT NULL AND r.merged_into_rsvp_id IS NULL', 'r.checked_in_at IS NOT NULL AND r.status IN (''going'',''maybe'') AND r.merged_into_rsvp_id IS NULL');
 EXECUTE body;
END $$;