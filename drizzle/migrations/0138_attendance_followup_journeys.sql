ALTER TABLE public.message_journeys ADD COLUMN attendance_audience text, ADD COLUMN attendance_send_at timestamptz;
ALTER TABLE public.message_journeys ADD CONSTRAINT attendance_audience_valid CHECK(attendance_audience IS NULL OR attendance_audience IN ('attended','absent'));
ALTER TABLE public.message_journey_runs ADD COLUMN attendance_delivery boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX attendance_journey_once ON public.message_journey_runs(journey_id,rsvp_id) WHERE attendance_delivery;
CREATE OR REPLACE FUNCTION public.save_attendance_journey(_event uuid,_id uuid,_name text,_template uuid,_audience text,_local timestamp without time zone) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e public.events%ROWTYPE; j uuid; scheduled timestamptz;
BEGIN
 SELECT * INTO e FROM public.events WHERE id=_event;
 IF NOT FOUND OR NOT public.can_manage_event(_event) OR NOT public.team_capability(e.team_id,'messages') THEN RAISE EXCEPTION 'forbidden'; END IF;
 IF _audience NOT IN ('attended','absent') THEN RAISE EXCEPTION 'invalid_audience'; END IF;
 scheduled:=_local AT TIME ZONE e.timezone;
 IF scheduled IS NULL OR scheduled<=coalesce(e.ends_at,e.starts_at+interval '1 hour') OR scheduled<=now() THEN RAISE EXCEPTION 'invalid_schedule'; END IF;
 IF _id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.message_journeys WHERE id=_id AND event_id=_event AND attendance_audience IS NOT NULL) THEN RAISE EXCEPTION 'forbidden'; END IF;
 j:=public.save_event_communication_journey(e.team_id,_id,_event,_name,'event_reminder',jsonb_build_array(jsonb_build_object('kind','send','template_id',_template)));
 UPDATE public.message_journeys SET attendance_audience=_audience,attendance_send_at=scheduled,status='draft' WHERE id=j;
 RETURN j;
END $$;
REVOKE ALL ON FUNCTION public.save_attendance_journey(uuid,uuid,text,uuid,text,timestamp) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_attendance_journey(uuid,uuid,text,uuid,text,timestamp) TO authenticated;
CREATE OR REPLACE FUNCTION public.attendance_message_eligible(_rsvp uuid,_audience text,_channel text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT coalesce((SELECT e.status='published' AND r.status='going' AND r.merged_into_rsvp_id IS NULL
 AND CASE WHEN _audience='attended' THEN r.checked_in_at IS NOT NULL WHEN _audience='absent' THEN r.checked_in_at IS NULL ELSE false END
 AND CASE WHEN _channel='email' THEN r.email_opt_in AND nullif(r.guest_email,'') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.email_suppressions s WHERE s.email=lower(r.guest_email)) AND NOT EXISTS(SELECT 1 FROM public.email_prefs p WHERE p.email=lower(r.guest_email) AND (p.all_off OR NOT p.followups))
 WHEN _channel='sms' THEN r.sms_opt_in AND nullif(r.guest_phone,'') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.sms_optouts s WHERE s.phone=public.normalize_phone(r.guest_phone))
 WHEN _channel='in_app' THEN r.user_id IS NOT NULL ELSE false END
 AND NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=r.user_id AND (coalesce((p.notify_prefs->>_channel)::boolean,true)=false OR coalesce((p.notify_prefs->>'followups')::boolean,true)=false))
 FROM public.rsvps r JOIN public.events e ON e.id=r.event_id WHERE r.id=_rsvp),false)
$$;
REVOKE ALL ON FUNCTION public.attendance_message_eligible(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.attendance_message_eligible(uuid,text,text) TO service_role;
CREATE OR REPLACE FUNCTION public.process_attendance_journeys(_limit int DEFAULT 50) RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE j record; r record; tpl record; run uuid; n int:=0; subject text; body text; host text;
BEGIN
 FOR j IN SELECT x.*,e.title,e.timezone,e.host_id,e.starts_at FROM public.message_journeys x JOIN public.events e ON e.id=x.event_id WHERE x.attendance_audience IS NOT NULL AND x.status='active' AND x.attendance_send_at<=now() ORDER BY x.attendance_send_at LIMIT greatest(1,least(_limit,100)) FOR UPDATE OF x SKIP LOCKED LOOP
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
 INSERT INTO public.notification_outbox(team_id,event_id,rsvp_id,user_id,channel,recipient,language,template,kind,payload,send_after) VALUES(j.team_id,j.event_id,r.id,r.user_id,tpl.channel,CASE WHEN tpl.channel='email' THEN r.guest_email ELSE r.guest_phone END,tpl.language,'custom_message','followups',jsonb_build_object('subject',subject,'body',body,'title',subject,'attendance_audience',j.attendance_audience,'journey_id',j.id,'journey_run_id',run),now());
 END IF;
 n:=n+1;
 END LOOP;
 END LOOP;
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.process_attendance_journeys(int) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.process_attendance_journeys(int) TO service_role;
CREATE OR REPLACE FUNCTION public.journey_on_rsvp() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE j record; e public.events%ROWTYPE;
BEGIN
 SELECT * INTO e FROM public.events WHERE id=NEW.event_id;
 FOR j IN SELECT id,start_trigger FROM public.message_journeys WHERE team_id=e.team_id AND status='active' AND attendance_audience IS NULL AND (event_id IS NULL OR event_id=e.id) LOOP
 IF j.start_trigger='registration_confirmation' THEN PERFORM public.start_journey_run(j.id,NEW.id,e.id,e.team_id,now());
 ELSIF j.start_trigger='event_reminder' THEN PERFORM public.start_journey_run(j.id,NEW.id,e.id,e.team_id,greatest(now(),e.starts_at-interval '24 hours')); END IF;
 END LOOP;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.guard_attendance_journey_activation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.attendance_audience IS NOT NULL AND NEW.status='active' THEN
 IF NEW.event_id IS NULL OR NEW.attendance_send_at IS NULL OR NOT public.can_manage_event(NEW.event_id) OR NOT public.team_capability(NEW.team_id,'messages') THEN RAISE EXCEPTION 'forbidden'; END IF;
 IF NEW.attendance_send_at<=now() THEN RAISE EXCEPTION 'invalid_schedule'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER attendance_journey_activation BEFORE UPDATE OF status ON public.message_journeys FOR EACH ROW WHEN (NEW.attendance_audience IS NOT NULL AND NEW.status='active') EXECUTE FUNCTION public.guard_attendance_journey_activation();