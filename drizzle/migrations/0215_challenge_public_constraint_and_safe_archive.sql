ALTER TABLE public.challenges DROP CONSTRAINT IF EXISTS challenges_enrollment_values;
ALTER TABLE public.challenges ADD CONSTRAINT challenges_enrollment_values CHECK(enrollment IN('open','invite','public'));
ALTER TABLE public.challenges DROP CONSTRAINT IF EXISTS challenges_status_values;
ALTER TABLE public.challenges ADD CONSTRAINT challenges_status_values CHECK(status IN('draft','published','archived'));
CREATE OR REPLACE FUNCTION public.set_challenge_status(_c uuid,_status text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF _status NOT IN('draft','published','archived') OR NOT public.can_manage_challenge(_c) THEN RAISE EXCEPTION 'not_allowed'; END IF;
 PERFORM 1 FROM challenges WHERE id=_c FOR UPDATE;
 UPDATE challenges SET status=_status WHERE id=_c;
END $$;
REVOKE ALL ON FUNCTION public.set_challenge_status(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_challenge_status(uuid,text) TO authenticated;
DO $$ DECLARE d text; BEGIN d:=pg_get_functiondef('public.challenge_counts(uuid[])'::regprocedure); d:=replace(d,'public.can_read_challenge(c.id) OR public.team_channel_access(c.team_id)','public.can_read_challenge(c.id) OR public.challenge_can_enroll(c.id)'); EXECUTE d; END $$;
COMMENT ON FUNCTION public.set_challenge_status(uuid,text) IS 'Owner-only unpublish/archive/restore through existing definition guards; restore is draft, history and payments retained.';