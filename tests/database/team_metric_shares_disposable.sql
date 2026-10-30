-- DISPOSABLE DATABASE ONLY. Never run against production or preview (see tests/database/README.md).
-- Row 95: per-coach, per-team metric consent; sole leader read; revocation and removal.
BEGIN;
DO $$
DECLARE leader uuid := gen_random_uuid(); coach uuid := gen_random_uuid(); other uuid := gen_random_uuid(); t1 uuid := gen_random_uuid(); t2 uuid := gen_random_uuid(); r jsonb; ok boolean;
BEGIN
  INSERT INTO auth.users(id, email) VALUES (leader,'zz-l@test.invalid'),(coach,'zz-c@test.invalid'),(other,'zz-o@test.invalid');
  INSERT INTO public.teams(id,name,slug,owner_id) VALUES (t1,'ZZ-TEST T1','zz-t1-'||left(t1::text,8),leader),(t2,'ZZ-TEST T2','zz-t2-'||left(t2::text,8),other);
  INSERT INTO public.team_members(team_id,user_id,role) VALUES (t1,leader,'leader'),(t1,coach,'host'),(t1,other,'host'),(t2,other,'leader'),(t2,coach,'host');
  PERFORM set_config('request.jwt.claims', json_build_object('sub',leader,'role','authenticated')::text, true);
  r := public.team_member_insights(t1, coach);
  ASSERT jsonb_array_length(r->'shared') = 0, 'membership alone must share nothing';
  PERFORM set_config('request.jwt.claims', json_build_object('sub',coach,'role','authenticated')::text, true);
  PERFORM public.set_team_metric_share(t1, ARRAY['registrations']);
  PERFORM set_config('request.jwt.claims', json_build_object('sub',other,'role','authenticated')::text, true);
  ok := false; BEGIN PERFORM public.team_member_insights(t1, coach); EXCEPTION WHEN others THEN ok := true; END;
  ASSERT ok, 'non-leader member must be denied';
  r := public.team_member_insights(t2, coach);
  ASSERT jsonb_array_length(r->'shared') = 0, 'sharing with team 1 must not reach team 2 leader';
  PERFORM set_config('request.jwt.claims', json_build_object('sub',leader,'role','authenticated')::text, true);
  ASSERT (public.team_member_insights(t1, coach)->'shared') ? 'registrations', 'leader sees opted-in metric';
  DELETE FROM public.team_members WHERE team_id = t1 AND user_id = coach;
  ok := false; BEGIN PERFORM public.team_member_insights(t1, coach); EXCEPTION WHEN others THEN ok := true; END;
  ASSERT ok, 'removed member insights must be denied';
END $$;
ROLLBACK;
