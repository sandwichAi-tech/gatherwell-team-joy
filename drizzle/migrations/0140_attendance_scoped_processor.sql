CREATE OR REPLACE FUNCTION public.process_attendance_journey(_journey uuid) RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE j record; r record; tpl record; run uuid; n int:=0; subject text; body text; host text;
BEGIN
 FOR j IN SELECT x.*,e.title,e.timezone,e.host_id,e.starts_at FROM public.message_journeys x JOIN public.events e ON e.id=x.event_id WHERE x.id=_journey AND x.attendance_audience IS NOT NULL AND x.status='active' AND coalesce(e.ends_at,e.starts_at+interval '1 hour')<=now() AND x.attendance_send_at<=now() ORDER BY x.attendance_send_at LIMIT 1 FOR UPDATE OF x SKIP LOCKED LOOP
 SELECT t.* INTO tpl FROM public.message_journey_steps s JOIN public.message_templates t ON t.id=(s.config->>'template_id')::uuid WHERE s.journey_id=j.id AND s.kind='send' AND NOT t.archived LIMIT 1;
 IF NOT FOUND THEN CONTINUE; END IF;
 SELECT coalesce(full_name,'') INTO host FROM public.profiles WHERE id=j.host_id;
 FOR r IN SELECT * FROM public.rsvps WHERE event_id=j.event_id AND public.attendance_message_eligible(id,j.attendance_audience,tpl.channel) LOOP
 run:=NULL;
 INSERT INTO public.message_journey_runs(journey_id,team_id,event_id,rsvp_id,status,steps_snapshot,attendance_delivery,note) VALUES(j.id,j.team_id,j.event_id,r.id,'completed','[]',true,'attendance_followup') ON CONFLICT(journey_id,rsvp_id) WHERE attendance_delivery DO NOTHING RETURNING id INTO run;
 IF run IS NULL THEN CONTINUE; END IF;
 subject:=public.render_message_vars(coalesce(tpl.subject,''),r.guest_name,j.title,to_char(j.starts_at AT TIME ZONE j.timezone,'YYYY-MM-DD HH24:MI')||' '||j.timezone,host);
 body:=public.render_message_vars(tpl.body,r.guest_name,j.title,to_char(j.starts_at AT TIME ZONE j.timezone,'YYYY-MM-DD HH24:MI')||' '||j.timezone,host);
 IF tpl.channel='in_app' THEN
 INSERT INTO public.notifications(user_id,kind,title,body,link) VALUES(r.user_id,'followups',subject,body,'/e/'||j.event_id);
 ELSE
 INSERT INTO public.notification_outbox(team_id,event_id,rsvp_id,user_id,channel,recipient,language,template,kind,payload,send_after) VALUES(j.team_id,j.event_id,r.id,r.user_id,tpl.channel,CASE WHEN tpl.channel='email' THEN r.guest_email ELSE r.guest_phone END,coalesce(r.language,tpl.language),'custom_message','followups',jsonb_build_object('subject',subject,'body',body,'title',subject,'attendance_audience',j.attendance_audience,'rsvp_id',r.id,'journey_id',j.id,'journey_run_id',run),now());
 END IF;
 n:=n+1;
 END LOOP;
 END LOOP;
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.process_attendance_journey(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.process_attendance_journey(uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.process_attendance_journeys(_limit int DEFAULT 50) RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE j uuid; n int:=0;
BEGIN
 FOR j IN SELECT id FROM public.message_journeys WHERE attendance_audience IS NOT NULL AND status='active' AND attendance_send_at<=now() ORDER BY attendance_send_at LIMIT greatest(1,least(_limit,100)) LOOP
 n:=n+public.process_attendance_journey(j);
 END LOOP;
 RETURN n;
END $$;