ALTER TABLE public.message_journeys ADD COLUMN event_id uuid REFERENCES public.events(id);
ALTER POLICY "Members read team journeys" ON public.message_journeys USING(public.team_capability(team_id,'messages') AND (offer_id IS NULL OR public.can_access_offer_participants(offer_id)) AND (event_id IS NULL OR public.can_access_event_participants(event_id)));
CREATE OR REPLACE FUNCTION public.communication_offerings(_team uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF auth.uid() IS NULL OR NOT public.team_capability(_team,'messages') THEN RAISE EXCEPTION 'forbidden'; END IF;
 RETURN jsonb_build_object('events',(SELECT coalesce(jsonb_agg(x),'[]'::jsonb) FROM (SELECT id,title FROM events WHERE team_id=_team AND public.can_manage_event(id) ORDER BY starts_at DESC LIMIT 100)x),'resources',(SELECT coalesce(jsonb_agg(x),'[]'::jsonb) FROM (SELECT id,title_en,title_es FROM offers WHERE team_id=_team AND kind IN ('course','download') AND public.can_access_offer_participants(id) ORDER BY created_at DESC LIMIT 100)x)); END $$;
REVOKE ALL ON FUNCTION public.communication_offerings(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.communication_offerings(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.set_communication_event(_journey uuid,_event uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE j message_journeys;
BEGIN
 SELECT * INTO j FROM message_journeys WHERE id=_journey;
 IF auth.uid() IS NULL OR NOT public.team_capability(j.team_id,'messages') OR j.start_trigger='resource_enrollment' THEN RAISE EXCEPTION 'forbidden'; END IF;
 IF _event IS NOT NULL AND NOT EXISTS(SELECT 1 FROM events WHERE id=_event AND team_id=j.team_id AND public.can_manage_event(id)) THEN RAISE EXCEPTION 'forbidden'; END IF;
 UPDATE message_journeys SET event_id=_event WHERE id=j.id;
END $$;
REVOKE ALL ON FUNCTION public.set_communication_event(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_communication_event(uuid,uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.start_journey_run(_journey UUID,_rsvp UUID,_event UUID,_team UUID,_next timestamptz) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE steps jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM message_journeys WHERE id=_journey AND team_id=_team AND status='active' AND start_trigger<>'resource_enrollment' AND (event_id IS NULL OR event_id=_event)) THEN RETURN; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('kind',s.kind,'config',s.config) ORDER BY s.sort_order),'[]'::jsonb) INTO steps FROM message_journey_steps s WHERE journey_id=_journey;
 IF jsonb_array_length(steps)=0 THEN RETURN; END IF;
 INSERT INTO message_journey_runs(journey_id,team_id,rsvp_id,event_id,steps_snapshot,next_run_at) VALUES(_journey,_team,_rsvp,_event,steps,_next) ON CONFLICT ON CONSTRAINT message_journey_runs_live_uniq DO NOTHING;
END $$;
ALTER TABLE public.notifications ADD COLUMN resource_journey_run_id uuid REFERENCES public.resource_journey_runs(id) ON DELETE SET NULL;
ALTER TABLE public.notifications ADD COLUMN resource_journey_step integer;
CREATE UNIQUE INDEX notification_resource_step_unique ON public.notifications(resource_journey_run_id,resource_journey_step) WHERE resource_journey_run_id IS NOT NULL;
CREATE OR REPLACE FUNCTION public.advance_resource_journeys(_limit int DEFAULT 50) RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r record;s jsonb;t message_templates;o offers;n int:=0;i int;done boolean;title text;body text;subject text;active boolean;
BEGIN
 FOR r IN SELECT rr.* FROM resource_journey_runs rr JOIN message_journeys j ON j.id=rr.journey_id WHERE rr.status='running' AND rr.next_run_at<=now() AND j.status='active' ORDER BY rr.next_run_at LIMIT least(greatest(_limit,1),100) FOR UPDATE OF rr SKIP LOCKED LOOP
 i:=r.current_step;done:=false;
 SELECT EXISTS(SELECT 1 FROM entitlements WHERE id=r.entitlement_id AND user_id=r.user_id AND offer_id=r.offer_id AND revoked_at IS NULL AND starts_at<=now() AND(ends_at IS NULL OR ends_at>now())) INTO active;
 SELECT * INTO o FROM offers WHERE id=r.offer_id AND team_id=r.team_id;
 IF o.id IS NULL OR o.status<>'published' THEN UPDATE resource_journey_runs SET status='completed',note='resource_unavailable' WHERE id=r.id;n:=n+1;CONTINUE; END IF;
 WHILE NOT done AND i<=jsonb_array_length(r.steps_snapshot) LOOP
 s:=r.steps_snapshot->(i-1);
 IF NOT active THEN UPDATE resource_journey_runs SET status='completed',note='condition_skip' WHERE id=r.id;done:=true;
 ELSIF s->>'kind'='wait' THEN UPDATE resource_journey_runs SET current_step=i+1,next_run_at=now()+make_interval(hours=>(s->'config'->>'hours')::int) WHERE id=r.id;done:=true;
 ELSIF s->>'kind'='condition' THEN
 IF s->'config'->>'condition'<>'enrollment_active' THEN UPDATE resource_journey_runs SET status='failed',note='unknown_step' WHERE id=r.id;done:=true;ELSE i:=i+1;END IF;
 ELSIF s->>'kind'='send' THEN
 SELECT * INTO t FROM message_templates WHERE id=(s->'config'->>'template_id')::uuid AND NOT archived AND(team_id IS NULL OR team_id=r.team_id);
 IF t.id IS NULL THEN UPDATE resource_journey_runs SET status='failed',note='template_missing' WHERE id=r.id;done:=true;
 ELSIF t.channel<>'in_app' THEN UPDATE resource_journey_runs SET status='failed',note='setup_required_email' WHERE id=r.id;done:=true;
 ELSE
 title:=CASE WHEN t.language='es' THEN coalesce(nullif(o.title_es,''),o.title_en) ELSE o.title_en END;
 body:=replace(replace(t.body,'{{event}}',coalesce(title,'')),'{{resource}}',coalesce(title,''));subject:=replace(replace(coalesce(t.subject,''),'{{event}}',coalesce(title,'')),'{{resource}}',coalesce(title,''));
 body:=replace(body,'{{name}}',coalesce((SELECT full_name FROM profiles WHERE id=r.user_id),''));
 body:=replace(body,'{{host}}',coalesce((SELECT full_name FROM profiles WHERE id=o.host_id),''));
 subject:=replace(subject,'{{name}}',coalesce((SELECT full_name FROM profiles WHERE id=r.user_id),''));
 INSERT INTO notifications(user_id,kind,title,body,link,resource_journey_run_id,resource_journey_step) VALUES(r.user_id,'journey',coalesce(nullif(subject,''),title),body,'/offer/'||r.offer_id,r.id,i) ON CONFLICT(resource_journey_run_id,resource_journey_step) WHERE resource_journey_run_id IS NOT NULL DO NOTHING;
 i:=i+1;
 END IF;
 ELSE UPDATE resource_journey_runs SET status='failed',note='unknown_step' WHERE id=r.id;done:=true;END IF;
 END LOOP;
 IF NOT done THEN UPDATE resource_journey_runs SET current_step=i,status='completed' WHERE id=r.id;END IF;n:=n+1;
 END LOOP;RETURN n;
END $$;
CREATE OR REPLACE FUNCTION public.resource_journey_activity(_team uuid,_journey uuid DEFAULT NULL,_limit int DEFAULT 20) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF auth.uid() IS NULL OR NOT public.team_capability(_team,'messages') THEN RAISE EXCEPTION 'forbidden'; END IF;
 RETURN (SELECT coalesce(jsonb_agg(x),'[]'::jsonb) FROM (SELECT r.id,r.journey_id,j.name AS journey_name,o.title_en AS event_title,'resource'::text AS context,r.status,r.current_step,jsonb_array_length(r.steps_snapshot) AS step_count,r.next_run_at,r.note,r.created_at FROM resource_journey_runs r JOIN message_journeys j ON j.id=r.journey_id JOIN offers o ON o.id=r.offer_id WHERE r.team_id=_team AND(_journey IS NULL OR r.journey_id=_journey) AND public.can_access_offer_participants(r.offer_id) ORDER BY r.created_at DESC LIMIT least(greatest(_limit,1),100))x);
END $$;
REVOKE ALL ON FUNCTION public.resource_journey_activity(uuid,uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.resource_journey_activity(uuid,uuid,integer) TO authenticated;