-- Explicit invocation ONLY on an empty disposable database with Teams functions installed.
-- Never run on shared preview/production. All ZZ-TEST fixtures roll back.
BEGIN;
DO $$
DECLARE l1 uuid:=gen_random_uuid(); l2 uuid:=gen_random_uuid(); c uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid(); empty_user uuid:=gen_random_uuid(); pending uuid:=gen_random_uuid(); t1 uuid:=gen_random_uuid(); t2 uuid:=gen_random_uuid(); ev uuid:=gen_random_uuid(); r jsonb; denied boolean;
BEGIN
 INSERT INTO profiles(id,full_name) VALUES(l1,'ZZ-TEST Leader A'),(l2,'ZZ-TEST Leader B'),(c,'ZZ-TEST Coach'),(outsider,'ZZ-TEST Outsider'),(empty_user,'ZZ-TEST Empty'),(pending,'ZZ-TEST Pending');
 INSERT INTO teams(id,name,slug,owner_id) VALUES(t1,'ZZ-TEST Team A','zz-a',l1),(t2,'ZZ-TEST Team B','zz-b',l2);
 INSERT INTO team_members(team_id,user_id,role) VALUES(t1,l1,'leader'),(t2,l2,'leader'),(t1,c,'host'),(t2,c,'host');
 INSERT INTO team_join_requests VALUES(t1,pending,'pending',now(),null);
 INSERT INTO events VALUES(ev,c,'ZZ-TEST Event',now()-interval '1 day','UTC','private','published');
 INSERT INTO rsvps VALUES(ev,'going',1,now(),null),(ev,'cancelled',5,now(),null),(ev,'going',10,now(),gen_random_uuid());
 PERFORM set_config('request.jwt.claims',json_build_object('sub',c)::text,true);
 ASSERT jsonb_array_length(my_team_states())=2,'coach belongs to both teams';
 UPDATE profiles SET active_team_id=t2 WHERE id=c;
 ASSERT (SELECT active_team_id=t2 FROM profiles WHERE id=c),'saved choice persists per account';
 PERFORM set_team_metric_share(t1,ARRAY['attendance']);
 PERFORM set_config('request.jwt.claims',json_build_object('sub',l1)::text,true);
 r:=team_member_insights(t1,c);
 ASSERT (r->'events'->0->>'checked_in')::int=2,'cancelled and merged attendees must not inflate opted-in check-ins';
 ASSERT NOT (r::text ~ 'email|phone|revenue|purchase|waiver|customer'),'aggregate projection contains no sensitive fields';
 ASSERT jsonb_array_length(team_member_management(t1)->'requests')=1,'exact team request roster';
 PERFORM set_config('request.jwt.claims',json_build_object('sub',l2)::text,true);
 ASSERT jsonb_array_length(team_member_insights(t2,c)->'shared')=0,'team A consent never reaches team B';
 PERFORM set_config('request.jwt.claims',json_build_object('sub',outsider)::text,true);
 denied:=false; BEGIN PERFORM team_member_insights(t1,c); EXCEPTION WHEN others THEN denied:=true; END; ASSERT denied,'outsider direct ID denied';
 denied:=false; BEGIN PERFORM team_member_management(t1); EXCEPTION WHEN others THEN denied:=true; END; ASSERT denied,'outsider roster denied';
 ASSERT jsonb_array_length(my_team_states())=0,'unrelated account has no teams';
 PERFORM set_config('request.jwt.claims',json_build_object('sub',empty_user)::text,true); ASSERT jsonb_array_length(my_team_states())=0,'empty new account';
 PERFORM set_config('request.jwt.claims',json_build_object('sub',pending)::text,true);
 ASSERT NOT (my_team_states()->0->>'access')::boolean,'pending shares no private access';
 denied:=false; BEGIN PERFORM set_team_metric_share(t1,ARRAY['attendance']); EXCEPTION WHEN others THEN denied:=true; END; ASSERT denied,'pending cannot share';
 PERFORM set_config('request.jwt.claims',json_build_object('sub',c)::text,true); PERFORM set_team_metric_share(t1,'{}');
 PERFORM set_config('request.jwt.claims',json_build_object('sub',l1)::text,true); ASSERT jsonb_array_length(team_member_insights(t1,c)->'shared')=0,'revocation immediate at RPC';
 PERFORM set_config('request.jwt.claims',json_build_object('sub',c)::text,true); PERFORM set_team_metric_share(t1,ARRAY['registrations']);
 DELETE FROM team_members WHERE team_id=t1 AND user_id=c; INSERT INTO team_members(team_id,user_id,role) VALUES(t1,c,'host');
 PERFORM set_config('request.jwt.claims',json_build_object('sub',l1)::text,true); ASSERT jsonb_array_length(team_member_insights(t1,c)->'shared')=0,'rejoin never resurrects old consent';
 INSERT INTO user_suspensions VALUES(l1);
 denied:=false; BEGIN PERFORM team_member_insights(t1,c); EXCEPTION WHEN others THEN denied:=true; END; ASSERT denied,'suspended leader denied';
 DELETE FROM user_suspensions;
 INSERT INTO community_suspensions VALUES(t1,c,null,'team');
 denied:=false; BEGIN PERFORM team_member_insights(t1,c); EXCEPTION WHEN others THEN denied:=true; END; ASSERT denied,'community suspended coach denied';
 PERFORM set_config('request.jwt.claims','{}',true);
 denied:=false; BEGIN PERFORM team_member_insights(t1,c); EXCEPTION WHEN others THEN denied:=true; END; ASSERT denied,'signed-out direct ID denied';
END $$;
ROLLBACK;