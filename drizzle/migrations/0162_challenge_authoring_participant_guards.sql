ALTER TABLE public.challenges ADD COLUMN currency text NOT NULL DEFAULT 'usd', ADD COLUMN addons jsonb NOT NULL DEFAULT '[]';
ALTER TABLE public.challenges DROP CONSTRAINT challenges_is_paid_check;
ALTER TABLE public.challenge_members ADD COLUMN access_status text NOT NULL DEFAULT 'active', ADD COLUMN source text NOT NULL DEFAULT 'free', ADD COLUMN payment_id uuid REFERENCES public.payments(id), ADD COLUMN extras jsonb NOT NULL DEFAULT '[]';
CREATE TABLE public.challenge_invites (challenge_id uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE, user_id uuid NOT NULL REFERENCES public.profiles(id), created_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz, PRIMARY KEY(challenge_id,user_id));
GRANT SELECT,INSERT,UPDATE,DELETE ON public.challenge_invites TO authenticated;
GRANT ALL ON public.challenge_invites TO service_role;
ALTER TABLE public.challenge_invites ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.can_manage_challenge(_c uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM challenges c WHERE c.id=_c AND c.created_by=auth.uid()); $$;
CREATE POLICY challenge_invites_owner ON public.challenge_invites FOR ALL TO authenticated USING(public.can_manage_challenge(challenge_id)) WITH CHECK(public.can_manage_challenge(challenge_id));
CREATE POLICY challenge_invites_self ON public.challenge_invites FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE OR REPLACE FUNCTION public.challenge_member_active(_c uuid,_user uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM challenge_members m JOIN challenges c ON c.id=m.challenge_id WHERE c.id=_c AND m.user_id=_user AND m.access_status='active' AND c.status='published'
 AND EXISTS(SELECT 1 FROM team_members tm WHERE tm.team_id=c.team_id AND tm.user_id=_user AND tm.suspended_at IS NULL)
 AND NOT EXISTS(SELECT 1 FROM team_suspensions s WHERE s.team_id=c.team_id)
 AND NOT EXISTS(SELECT 1 FROM user_suspensions s WHERE s.user_id=_user)
 AND (NOT c.is_paid OR (m.source='payment' AND EXISTS(SELECT 1 FROM payments p WHERE p.id=m.payment_id AND p.challenge_id=c.id AND p.status='paid' AND p.stripe_payment_intent IS NOT NULL AND p.buyer_key=_user::text)))); $$;
CREATE OR REPLACE FUNCTION public.can_read_challenge(_c uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT auth.uid() IS NOT NULL AND (public.can_manage_challenge(_c) OR public.challenge_member_active(_c,auth.uid())); $$;
CREATE OR REPLACE FUNCTION public.challenge_can_enroll(_c uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT auth.uid() IS NOT NULL AND public.is_adult() AND EXISTS(SELECT 1 FROM challenges c WHERE c.id=_c AND c.status='published' AND (now() AT TIME ZONE coalesce(c.timezone,'UTC'))::date<=c.ends_on AND public.team_channel_access(c.team_id) AND (c.enrollment='open' OR EXISTS(SELECT 1 FROM challenge_invites i WHERE i.challenge_id=c.id AND i.user_id=auth.uid() AND i.revoked_at IS NULL))); $$;
DROP POLICY "Team and sub-team read challenges" ON public.challenges;
CREATE POLICY challenge_definition_read ON public.challenges FOR SELECT TO authenticated USING(public.can_read_challenge(id) OR (status='published' AND public.team_channel_access(team_id)));
DROP POLICY "Leaders edit challenges" ON public.challenges;
CREATE POLICY challenge_owner_update ON public.challenges FOR UPDATE TO authenticated USING(created_by=auth.uid()) WITH CHECK(created_by=auth.uid());
DROP POLICY "Leaders delete challenges" ON public.challenges;
CREATE POLICY challenge_owner_delete ON public.challenges FOR DELETE TO authenticated USING(created_by=auth.uid());
DROP POLICY "Read challenge activities" ON public.challenge_activities;
DROP POLICY "Leaders manage challenge activities" ON public.challenge_activities;
CREATE POLICY challenge_activities_read ON public.challenge_activities FOR SELECT TO authenticated USING(public.can_read_challenge(challenge_id));
CREATE POLICY challenge_activities_owner ON public.challenge_activities FOR ALL TO authenticated USING(public.can_manage_challenge(challenge_id)) WITH CHECK(public.can_manage_challenge(challenge_id));
DROP POLICY "Read challenge messages" ON public.challenge_messages;
DROP POLICY "Leaders manage challenge messages" ON public.challenge_messages;
CREATE POLICY challenge_messages_read ON public.challenge_messages FOR SELECT TO authenticated USING(public.can_read_challenge(challenge_id) AND (public.can_manage_challenge(challenge_id) OR (kind='welcome' AND enabled AND NOT paused)));
CREATE POLICY challenge_messages_owner ON public.challenge_messages FOR ALL TO authenticated USING(public.can_manage_challenge(challenge_id)) WITH CHECK(public.can_manage_challenge(challenge_id));
DROP POLICY "Read own check-ins" ON public.challenge_checkins;
CREATE POLICY challenge_progress_self ON public.challenge_checkins FOR SELECT TO authenticated USING(user_id=auth.uid() AND public.can_read_challenge(challenge_id));
DROP POLICY "Read own membership" ON public.challenge_members;
CREATE POLICY challenge_members_self ON public.challenge_members FOR SELECT TO authenticated USING(user_id=auth.uid() AND access_status='active' AND public.can_read_challenge(challenge_id));
DROP POLICY "Join readable challenges" ON public.challenge_members;
REVOKE INSERT ON public.challenge_members FROM authenticated;
CREATE OR REPLACE FUNCTION public.guard_paid_challenge_join() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NEW.source NOT IN ('free','payment') OR NEW.access_status NOT IN ('active','revoked','refunded') THEN RAISE EXCEPTION 'not_allowed'; END IF;
 IF EXISTS(SELECT 1 FROM challenges WHERE id=NEW.challenge_id AND is_paid) AND (NEW.source<>'payment' OR NOT EXISTS(SELECT 1 FROM payments p WHERE p.id=NEW.payment_id AND p.challenge_id=NEW.challenge_id AND p.status='paid' AND p.stripe_payment_intent IS NOT NULL AND p.buyer_key=NEW.user_id::text)) THEN RAISE EXCEPTION 'payment_required'; END IF;
 RETURN NEW; END; $$;
DROP TRIGGER block_unpaid_selling ON public.challenges;
CREATE OR REPLACE FUNCTION public.guard_challenge_definition() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE a jsonb; seen text[]:='{}'; BEGIN
 IF TG_OP='UPDATE' AND (NEW.created_by<>OLD.created_by OR NEW.team_id<>OLD.team_id) THEN RAISE EXCEPTION 'not_allowed'; END IF;
 IF NEW.currency<>'usd' OR (NEW.is_paid AND (NEW.price_cents IS NULL OR NEW.price_cents<50 OR NEW.price_cents>100000)) OR (NOT NEW.is_paid AND coalesce(NEW.price_cents,0)<>0) THEN RAISE EXCEPTION 'invalid_price'; END IF;
 IF NEW.goal_target IS NOT NULL AND (NEW.goal_target<1 OR NEW.goal_target>1000) OR NEW.capacity IS NOT NULL AND (NEW.capacity<1 OR NEW.capacity>10000) THEN RAISE EXCEPTION 'invalid_rules'; END IF;
 IF NEW.timezone IS NULL THEN NEW.timezone:='UTC'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=NEW.timezone) THEN RAISE EXCEPTION 'invalid_schedule'; END IF;
 IF jsonb_typeof(NEW.addons)<>'array' OR jsonb_array_length(NEW.addons)>8 THEN RAISE EXCEPTION 'invalid_addons'; END IF;
 FOR a IN SELECT * FROM jsonb_array_elements(NEW.addons) LOOP
  IF coalesce(a->>'id','')='' OR a->>'id'=ANY(seen) OR length(trim(coalesce(a->>'name','')))=0 OR length(a->>'name')>60 OR coalesce((a->>'price_cents')::int,-1)<0 OR (a->>'price_cents')::int>100000 OR length(coalesce(a->>'description',''))>500 OR coalesce((a->>'max_quantity')::int,1) NOT BETWEEN 1 AND 20 OR (a->>'inventory') IS NOT NULL AND (a->>'inventory')::int<0 THEN RAISE EXCEPTION 'invalid_addons'; END IF;
  seen:=array_append(seen,a->>'id');
  IF nullif(a->>'image_path','') IS NOT NULL AND (split_part(a->>'image_path','/',1)<>NEW.created_by::text OR a->>'image_path' !~ '^[a-f0-9-]{36}/addon-[a-f0-9-]+\.webp$' OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='media' AND name=a->>'image_path')) THEN RAISE EXCEPTION 'not_allowed'; END IF;
 END LOOP;
 IF NEW.status='published' AND NEW.is_paid THEN RAISE EXCEPTION 'checkout_setup_required'; END IF;
 IF NEW.status='published' AND (length(trim(NEW.title_en))=0 AND length(trim(NEW.title_es))=0 OR NEW.model='goal' AND NEW.goal_target IS NULL) THEN RAISE EXCEPTION 'invalid_rules'; END IF;
 RETURN NEW; END; $$;
CREATE TRIGGER challenge_definition_guard BEFORE INSERT OR UPDATE ON public.challenges FOR EACH ROW EXECUTE FUNCTION public.guard_challenge_definition();
CREATE OR REPLACE FUNCTION public.enroll_challenge(_c uuid,_extras jsonb DEFAULT '[]') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE c public.challenges; a jsonb; s jsonb; chosen jsonb:='[]'; cost int:=0; used int; seen text[]:='{}'; qty int; BEGIN
 SELECT * INTO c FROM challenges WHERE id=_c FOR UPDATE;
 IF NOT FOUND OR NOT public.challenge_can_enroll(_c) THEN RAISE EXCEPTION 'not_allowed'; END IF;
 IF public.challenge_member_active(_c,auth.uid()) THEN RETURN jsonb_build_object('enrolled',true,'already',true); END IF;
 IF EXISTS(SELECT 1 FROM challenge_members WHERE challenge_id=_c AND user_id=auth.uid()) THEN RAISE EXCEPTION 'access_revoked'; END IF;
 IF c.is_paid THEN RAISE EXCEPTION 'checkout_setup_required'; END IF;
 IF c.capacity IS NOT NULL AND (SELECT count(*) FROM challenge_members m WHERE m.challenge_id=_c AND public.challenge_member_active(_c,m.user_id))>=c.capacity THEN RAISE EXCEPTION 'challenge_full'; END IF;
 IF jsonb_typeof(_extras)<>'array' OR jsonb_array_length(_extras)>8 THEN RAISE EXCEPTION 'invalid_addons'; END IF;
 FOR s IN SELECT * FROM jsonb_array_elements(_extras) LOOP
  SELECT x INTO a FROM jsonb_array_elements(c.addons) x WHERE x->>'id'=s->>'id'; qty:=(s->>'quantity')::int;
  IF a IS NULL OR s->>'id'=ANY(seen) OR coalesce((a->>'available')::boolean,true)=false OR qty IS NULL OR qty<1 OR qty>coalesce((a->>'max_quantity')::int,1) THEN RAISE EXCEPTION 'invalid_addons'; END IF;
  seen:=array_append(seen,s->>'id'); cost:=cost+(a->>'price_cents')::int*qty;
  SELECT coalesce(sum((x->>'quantity')::int),0) INTO used FROM challenge_members m CROSS JOIN LATERAL jsonb_array_elements(m.extras) x WHERE m.challenge_id=_c AND m.access_status='active' AND x->>'id'=s->>'id';
  IF a->>'inventory' IS NOT NULL AND used+qty>(a->>'inventory')::int THEN RAISE EXCEPTION 'addon_sold_out'; END IF;
  chosen:=chosen||jsonb_build_array(jsonb_build_object('id',a->>'id','name',a->>'name','description',a->>'description','quantity',qty,'unit_cents',(a->>'price_cents')::int));
 END LOOP;
 IF cost>0 THEN RAISE EXCEPTION 'checkout_setup_required'; END IF;
 INSERT INTO challenge_members(challenge_id,user_id,extras) VALUES(_c,auth.uid(),chosen);
 RETURN jsonb_build_object('enrolled',true,'extras',chosen); END; $$;
REVOKE ALL ON FUNCTION public.enroll_challenge(uuid,jsonb) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.enroll_challenge(uuid,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.challenge_leaderboard(_c uuid,_tz text DEFAULT 'UTC') RETURNS TABLE(user_id uuid,full_name text,checkins integer,current_streak integer,best_streak integer,rank integer) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ DECLARE c public.challenges; day date; BEGIN
 SELECT * INTO c FROM challenges WHERE id=_c;
 IF NOT FOUND OR NOT public.can_read_challenge(_c) THEN RAISE EXCEPTION 'not_allowed'; END IF;
 IF NOT c.leaderboard_on THEN RETURN; END IF;
 day:=(now() AT TIME ZONE coalesce(c.timezone,'UTC'))::date;
 RETURN QUERY WITH scored AS(SELECT m.user_id uid,p.full_name name,s.checkins total,s.current_streak cur,s.best_streak best,
 CASE WHEN c.model='streak' THEN s.current_streak WHEN c.model='goal' THEN least(s.checkins,c.goal_target) ELSE s.checkins END score
 FROM challenge_members m LEFT JOIN profiles p ON p.id=m.user_id CROSS JOIN LATERAL public.challenge_streaks(_c,m.user_id,day) s WHERE m.challenge_id=_c AND public.challenge_member_active(_c,m.user_id))
 SELECT uid,name,total,cur,best,(rank() OVER(ORDER BY score DESC))::int FROM scored ORDER BY 6,name NULLS LAST; END; $$;
CREATE OR REPLACE FUNCTION public.challenge_counts(_ids uuid[]) RETURNS TABLE(challenge_id uuid,members integer) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT c.id,(SELECT count(*)::int FROM challenge_members m WHERE m.challenge_id=c.id AND public.challenge_member_active(c.id,m.user_id)) FROM challenges c WHERE c.id=ANY(_ids) AND (public.can_read_challenge(c.id) OR public.team_channel_access(c.team_id)); $$;
CREATE OR REPLACE FUNCTION public.my_challenges() RETURNS SETOF public.challenges LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT c.* FROM challenges c WHERE auth.uid() IS NOT NULL AND public.challenge_member_active(c.id,auth.uid()) ORDER BY c.starts_on DESC; $$;
REVOKE ALL ON FUNCTION public.my_challenges() FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.my_challenges() TO authenticated;
CREATE OR REPLACE FUNCTION public.challenge_check_in(_c uuid,_date date,_tz text,_note text DEFAULT NULL,_photo text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE c public.challenges; loc timestamp; s record; previous date; BEGIN
 SELECT * INTO c FROM challenges WHERE id=_c FOR UPDATE;
 IF NOT FOUND OR NOT public.challenge_member_active(_c,auth.uid()) THEN RAISE EXCEPTION 'not_joined'; END IF;
 loc:=now() AT TIME ZONE coalesce(c.timezone,'UTC');
 IF NOT(_date=loc::date OR(_date=loc::date-1 AND loc::time<time '12:00')) THEN RAISE EXCEPTION 'date_closed'; END IF;
 IF _date<c.starts_on OR _date>c.ends_on THEN RAISE EXCEPTION 'out_of_range'; END IF;
 IF _photo IS NOT NULL AND split_part(_photo,'/',1)<>auth.uid()::text THEN RAISE EXCEPTION 'not_allowed'; END IF;
 IF EXISTS(SELECT 1 FROM challenge_activities a WHERE a.challenge_id=_c AND (a.day_offset IS NULL OR a.day_offset=_date-c.starts_on+1) AND a.requires_note) AND length(trim(coalesce(_note,'')))=0 THEN RAISE EXCEPTION 'note_required'; END IF;
 IF c.frequency='weekly' THEN
  SELECT checkin_date INTO previous FROM challenge_checkins WHERE challenge_id=_c AND user_id=auth.uid() AND (checkin_date-c.starts_on)/7=(_date-c.starts_on)/7 ORDER BY checkin_date LIMIT 1;
  IF previous IS NOT NULL THEN _date:=previous; END IF;
 END IF;
 INSERT INTO challenge_checkins(challenge_id,user_id,checkin_date,note,photo_path) VALUES(_c,auth.uid(),_date,nullif(left(trim(coalesce(_note,'')),280),''),_photo) ON CONFLICT(challenge_id,user_id,checkin_date) DO NOTHING;
 SELECT * INTO s FROM public.challenge_streaks(_c,auth.uid(),loc::date);
 RETURN jsonb_build_object('checkins',s.checkins,'current',s.current_streak,'best',s.best_streak); END; $$;
DO $$ DECLARE d text; BEGIN SELECT pg_get_functiondef('public.challenge_stats(uuid,text)'::regprocedure) INTO d; d:=replace(d,'NOT public.is_team_member(_ch.team_id, ARRAY[''leader''])','NOT public.can_manage_challenge(_c)'); EXECUTE d; END $$;
REVOKE ALL ON FUNCTION public.can_manage_challenge(uuid),public.challenge_member_active(uuid,uuid),public.challenge_can_enroll(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_manage_challenge(uuid),public.challenge_can_enroll(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.challenge_member_active(uuid,uuid) FROM authenticated;
CREATE OR REPLACE FUNCTION public.save_challenge(_id uuid,_team uuid,_p jsonb,_activities jsonb,_messages jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE cid uuid; c public.challenges; a jsonb; m jsonb; n int:=0; BEGIN
 IF auth.uid() IS NULL OR NOT public.is_adult() THEN RAISE EXCEPTION 'not_allowed'; END IF;
 IF _id IS NOT NULL THEN SELECT * INTO c FROM challenges WHERE id=_id FOR UPDATE; IF NOT FOUND OR c.created_by<>auth.uid() THEN RAISE EXCEPTION 'not_allowed'; END IF;
 ELSE IF NOT public.is_team_member(_team,ARRAY['leader']) OR NOT public.team_channel_access(_team) THEN RAISE EXCEPTION 'not_allowed'; END IF; END IF;
 IF jsonb_typeof(_activities)<>'array' OR jsonb_array_length(_activities)>30 OR jsonb_typeof(_messages)<>'array' OR jsonb_array_length(_messages)>6 THEN RAISE EXCEPTION 'invalid_rules'; END IF;
 IF _id IS NULL THEN INSERT INTO challenges(team_id,created_by,title_en,title_es,starts_on,ends_on,status) VALUES(_team,auth.uid(),coalesce(_p->>'title_en',''),coalesce(_p->>'title_es',''),(_p->>'starts_on')::date,(_p->>'ends_on')::date,'draft') RETURNING id INTO cid; ELSE cid:=_id; END IF;
 UPDATE challenges SET title_en=coalesce(_p->>'title_en',''),title_es=coalesce(_p->>'title_es',''),description_en=_p->>'description_en',description_es=_p->>'description_es',daily_prompt_en=_p->>'daily_prompt_en',daily_prompt_es=_p->>'daily_prompt_es',starts_on=(_p->>'starts_on')::date,ends_on=(_p->>'ends_on')::date,model=_p->>'model',goal_target=(_p->>'goal_target')::int,goal_unit=_p->>'goal_unit',frequency=_p->>'frequency',enrollment=_p->>'enrollment',capacity=(_p->>'capacity')::int,timezone=coalesce(_p->>'timezone','UTC'),leaderboard_on=(_p->>'leaderboard_on')::boolean,is_paid=(_p->>'is_paid')::boolean,price_cents=(_p->>'price_cents')::int,currency=coalesce(_p->>'currency','usd'),addons=coalesce(_p->'addons','[]'),cover_url=_p->>'cover_url',cover_style=coalesce((_p->>'cover_style')::smallint,0),status=_p->>'status' WHERE id=cid RETURNING * INTO c;
 DELETE FROM challenge_activities WHERE challenge_id=cid;
 FOR a IN SELECT * FROM jsonb_array_elements(_activities) LOOP
  IF length(trim(coalesce(a->>'title_en','')||coalesce(a->>'title_es','')))=0 OR a->>'day_offset' IS NOT NULL AND (a->>'day_offset')::int NOT BETWEEN 1 AND c.ends_on-c.starts_on+1 OR a->>'due_hour' IS NOT NULL AND (a->>'due_hour')::int NOT BETWEEN 0 AND 23 OR nullif(a->>'link_url','') IS NOT NULL AND a->>'link_url' !~ '^https://[^[:space:]]+$' THEN RAISE EXCEPTION 'invalid_activities'; END IF;
  IF a->>'resource_id' IS NOT NULL AND NOT ((a->>'resource_kind'='track' AND EXISTS(SELECT 1 FROM tracks WHERE id=(a->>'resource_id')::uuid AND team_id=c.team_id)) OR (a->>'resource_kind'='offer' AND EXISTS(SELECT 1 FROM offers WHERE id=(a->>'resource_id')::uuid AND host_id=auth.uid()))) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  IF nullif(a->>'file_path','') IS NOT NULL AND split_part(a->>'file_path','/',1)<>c.team_id::text THEN RAISE EXCEPTION 'not_allowed'; END IF;
  INSERT INTO challenge_activities(challenge_id,title_en,title_es,instructions_en,instructions_es,day_offset,sort_order,requires_checkin,requires_note,due_hour,link_url,resource_kind,resource_id,file_path) VALUES(cid,coalesce(a->>'title_en',''),coalesce(a->>'title_es',''),a->>'instructions_en',a->>'instructions_es',(a->>'day_offset')::int,n,coalesce((a->>'requires_checkin')::boolean,false),coalesce((a->>'requires_note')::boolean,false),(a->>'due_hour')::int,nullif(a->>'link_url',''),a->>'resource_kind',(a->>'resource_id')::uuid,a->>'file_path'); n:=n+1;
 END LOOP;
 DELETE FROM challenge_messages WHERE challenge_id=cid; n:=0;
 FOR m IN SELECT * FROM jsonb_array_elements(_messages) LOOP
  IF (m->>'send_hour')::int NOT BETWEEN 0 AND 23 OR (m->>'send_offset_days')::int NOT BETWEEN -7 AND c.ends_on-c.starts_on+1 OR (m->>'enabled')::boolean AND (length(trim(coalesce(m->>'body_en','')||coalesce(m->>'body_es','')))=0 OR (m->>'kind'<>'welcome')) THEN RAISE EXCEPTION 'invalid_messages'; END IF;
  INSERT INTO challenge_messages(challenge_id,kind,send_offset_days,send_hour,title_en,title_es,body_en,body_es,channel,enabled,paused,sort_order) VALUES(cid,m->>'kind',(m->>'send_offset_days')::int,(m->>'send_hour')::int,coalesce(m->>'title_en',''),coalesce(m->>'title_es',''),coalesce(m->>'body_en',''),coalesce(m->>'body_es',''),'in_app',coalesce((m->>'enabled')::boolean,false),coalesce((m->>'paused')::boolean,false),n); n:=n+1;
 END LOOP;
 RETURN cid; END; $$;
REVOKE ALL ON FUNCTION public.save_challenge(uuid,uuid,jsonb,jsonb,jsonb) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.save_challenge(uuid,uuid,jsonb,jsonb,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.guard_challenge_definition() FROM PUBLIC,anon,authenticated;