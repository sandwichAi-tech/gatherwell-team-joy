DO $$ DECLARE d text; marker text := 'AND EXISTS(SELECT 1 FROM team_members WHERE team_id=c.team_id AND user_id=_user AND suspended_at IS NULL)'; BEGIN
 d:=pg_get_functiondef('public.challenge_member_active(uuid,uuid)'::regprocedure);
 IF position(marker in d)=0 THEN RAISE EXCEPTION 'challenge_membership_shape_changed'; END IF;
 d:=replace(d,marker,'AND (c.enrollment=''public'' OR (EXISTS(SELECT 1 FROM team_members WHERE team_id=c.team_id AND user_id=_user AND suspended_at IS NULL) AND (c.enrollment=''open'' OR EXISTS(SELECT 1 FROM challenge_invites WHERE challenge_id=c.id AND user_id=_user AND revoked_at IS NULL))))'); EXECUTE d;
 d:=pg_get_functiondef('public.challenge_can_enroll(uuid)'::regprocedure);
 d:=replace(d,'AND public.is_adult() AND EXISTS','AND public.is_adult() AND NOT EXISTS(SELECT 1 FROM user_suspensions WHERE user_id=auth.uid()) AND EXISTS'); EXECUTE d;
 d:=pg_get_functiondef('public.get_public_challenge(uuid)'::regprocedure);
 d:=replace(d,'c.enrollment=''public'' AND p.host_public','c.enrollment=''public'' AND (NOT c.is_paid OR public.flag_on(''feature_selling'')) AND p.host_public');
 d:=replace(d,'m.access_status=''active''','public.challenge_member_active(c.id,m.user_id)'); EXECUTE d;
 d:=pg_get_functiondef('public.public_host_challenges(uuid)'::regprocedure); d:=replace(d,'m.access_status=''active''','public.challenge_member_active(c.id,m.user_id)'); EXECUTE d;
 d:=pg_get_functiondef('public.create_challenge_order(uuid,uuid,jsonb,text)'::regprocedure);
 d:=replace(d,'FROM challenge_members WHERE challenge_id=_c AND access_status=''active''','FROM challenge_members m WHERE challenge_id=_c AND public.challenge_member_active(_c,m.user_id)');
 d:=replace(d,'IF total=0 THEN','IF total>0 AND NOT public.flag_on(''feature_selling'') THEN RAISE EXCEPTION ''checkout_setup_required''; END IF; IF total=0 THEN');
 IF position('IF total>0 AND NOT public.flag_on' in d)=0 THEN RAISE EXCEPTION 'challenge_order_shape_changed'; END IF; EXECUTE d;
END $$;
DROP POLICY IF EXISTS challenge_definition_read ON public.challenges;
CREATE POLICY challenge_definition_read ON public.challenges FOR SELECT TO authenticated USING(public.can_read_challenge(id) OR public.challenge_can_enroll(id));
CREATE OR REPLACE FUNCTION public.challenge_history_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NOT NULL AND (EXISTS(SELECT 1 FROM public.challenge_members WHERE challenge_id=OLD.id) OR EXISTS(SELECT 1 FROM public.challenge_checkins WHERE challenge_id=OLD.id) OR EXISTS(SELECT 1 FROM public.orders WHERE challenge_id=OLD.id) OR EXISTS(SELECT 1 FROM public.payments WHERE challenge_id=OLD.id)) THEN RAISE EXCEPTION 'challenge_history_requires_archive'; END IF;
 RETURN OLD;
END $$;
CREATE TRIGGER challenge_preserve_history BEFORE DELETE ON public.challenges FOR EACH ROW EXECUTE FUNCTION public.challenge_history_guard();
CREATE OR REPLACE FUNCTION public.challenge_member_history_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN IF auth.uid() IS NOT NULL THEN RAISE EXCEPTION 'use_leave_challenge'; END IF; RETURN OLD; END $$;
CREATE TRIGGER challenge_members_preserve_history BEFORE DELETE ON public.challenge_members FOR EACH ROW EXECUTE FUNCTION public.challenge_member_history_guard();
CREATE OR REPLACE FUNCTION public.leave_challenge(_c uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_allowed'; END IF; PERFORM 1 FROM challenges WHERE id=_c FOR UPDATE; UPDATE challenge_members SET access_status='revoked' WHERE challenge_id=_c AND user_id=auth.uid(); END $$;
REVOKE ALL ON FUNCTION public.leave_challenge(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.leave_challenge(uuid) TO authenticated;
COMMENT ON FUNCTION public.leave_challenge(uuid) IS 'Caller-only leave revokes access, preserves enrollment/check-in/order history and does not silently re-enroll revoked users.';