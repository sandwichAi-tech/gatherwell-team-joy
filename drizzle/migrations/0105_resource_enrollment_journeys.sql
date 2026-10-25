ALTER TABLE public.message_journeys ADD COLUMN offer_id uuid REFERENCES public.offers(id);
ALTER TABLE public.message_journeys DROP CONSTRAINT message_journeys_trigger_check;
ALTER TABLE public.message_journeys ADD CONSTRAINT message_journeys_trigger_check CHECK(start_trigger IN ('registration_confirmation','event_reminder','event_cancellation','resource_enrollment'));
ALTER TABLE public.message_journey_runs ADD COLUMN entitlement_id uuid REFERENCES public.entitlements(id);
CREATE TABLE public.resource_journey_runs(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),journey_id uuid NOT NULL REFERENCES public.message_journeys(id) ON DELETE CASCADE,entitlement_id uuid NOT NULL REFERENCES public.entitlements(id) ON DELETE CASCADE,offer_id uuid NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
 user_id uuid NOT NULL,team_id uuid NOT NULL,steps_snapshot jsonb NOT NULL,status text NOT NULL DEFAULT 'running',current_step integer NOT NULL DEFAULT 1,next_run_at timestamptz NOT NULL DEFAULT now(),note text,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(journey_id,entitlement_id));
GRANT SELECT ON public.resource_journey_runs TO authenticated;
GRANT ALL ON public.resource_journey_runs TO service_role;
ALTER TABLE public.resource_journey_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY resource_runs_scoped ON public.resource_journey_runs FOR SELECT TO authenticated USING(public.can_access_offer_participants(offer_id));
CREATE OR REPLACE FUNCTION public.save_resource_journey(_team uuid,_id uuid,_offer uuid,_name text,_steps jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result uuid;step jsonb;i int:=0;
BEGIN
 IF NOT public.team_capability(_team,'messages') OR NOT public.can_access_offer_participants(_offer) OR NOT EXISTS(SELECT 1 FROM offers WHERE id=_offer AND team_id=_team) THEN RAISE EXCEPTION 'forbidden'; END IF;
 IF length(trim(_name)) NOT BETWEEN 1 AND 120 OR jsonb_typeof(_steps)<>'array' OR jsonb_array_length(_steps) NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'invalid_steps'; END IF;
 FOR step IN SELECT * FROM jsonb_array_elements(_steps) LOOP
  IF step->>'kind'='wait' THEN IF coalesce((step->>'hours')::int,0) NOT BETWEEN 1 AND 720 THEN RAISE EXCEPTION 'invalid_wait'; END IF;
  ELSIF step->>'kind'='send' THEN IF NOT EXISTS(SELECT 1 FROM message_templates WHERE id=(step->>'template_id')::uuid AND NOT archived AND(team_id IS NULL OR team_id=_team) AND channel IN ('email','in_app')) THEN RAISE EXCEPTION 'template_not_found'; END IF;
  ELSIF step->>'kind'='condition' THEN IF step->>'condition'<>'enrollment_active' THEN RAISE EXCEPTION 'invalid_condition'; END IF;
  ELSE RAISE EXCEPTION 'invalid_step_kind'; END IF;
 END LOOP;
 IF _id IS NULL THEN INSERT INTO message_journeys(team_id,offer_id,name,start_trigger,created_by) VALUES(_team,_offer,trim(_name),'resource_enrollment',auth.uid()) RETURNING id INTO result;
 ELSE UPDATE message_journeys SET offer_id=_offer,name=trim(_name),start_trigger='resource_enrollment',updated_at=now() WHERE id=_id AND team_id=_team AND created_by=auth.uid() RETURNING id INTO result;IF result IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;DELETE FROM message_journey_steps WHERE journey_id=result; END IF;
 FOR step IN SELECT * FROM jsonb_array_elements(_steps) LOOP i:=i+1;INSERT INTO message_journey_steps(journey_id,sort_order,kind,config) VALUES(result,i,step->>'kind',step-'kind');END LOOP;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.save_resource_journey(uuid,uuid,uuid,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_resource_journey(uuid,uuid,uuid,text,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.resource_enrollment_journeys() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o offers;j record;s jsonb;
BEGIN
 IF NEW.offer_id IS NULL OR NEW.source NOT IN ('free','order','subscription') OR NEW.revoked_at IS NOT NULL OR NEW.starts_at>now() THEN RETURN NEW; END IF;
 SELECT * INTO o FROM offers WHERE id=NEW.offer_id AND status='published';IF o.id IS NULL THEN RETURN NEW; END IF;
 FOR j IN SELECT * FROM message_journeys WHERE offer_id=o.id AND start_trigger='resource_enrollment' AND status='active' LOOP
 SELECT jsonb_agg(jsonb_build_object('kind',ms.kind,'config',ms.config) ORDER BY ms.sort_order) INTO s FROM message_journey_steps ms WHERE journey_id=j.id;
 INSERT INTO resource_journey_runs(journey_id,entitlement_id,offer_id,user_id,team_id,steps_snapshot) VALUES(j.id,NEW.id,o.id,NEW.user_id,o.team_id,s) ON CONFLICT DO NOTHING;
 END LOOP;RETURN NEW;
END $$;
CREATE TRIGGER resource_enrollment_journeys AFTER INSERT ON public.entitlements FOR EACH ROW EXECUTE FUNCTION public.resource_enrollment_journeys();
CREATE OR REPLACE FUNCTION public.advance_resource_journeys(_limit int DEFAULT 50) RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r record;s jsonb;t message_templates;n int:=0;i int;done boolean;title text;body text;subject text;recipient text;active boolean;
BEGIN
 FOR r IN SELECT rr.* FROM resource_journey_runs rr JOIN message_journeys j ON j.id=rr.journey_id WHERE rr.status='running' AND rr.next_run_at<=now() AND j.status='active' ORDER BY rr.next_run_at LIMIT least(greatest(_limit,1),100) FOR UPDATE OF rr SKIP LOCKED LOOP
 i:=r.current_step;done:=false;
 SELECT EXISTS(SELECT 1 FROM entitlements WHERE id=r.entitlement_id AND revoked_at IS NULL AND(ends_at IS NULL OR ends_at>now())) INTO active;
 SELECT title_en INTO title FROM offers WHERE id=r.offer_id;
 WHILE NOT done AND i<=jsonb_array_length(r.steps_snapshot) LOOP
 s:=r.steps_snapshot->(i-1);
 IF NOT active THEN UPDATE resource_journey_runs SET status='completed',note='condition_skip' WHERE id=r.id;done:=true;
 ELSIF s->>'kind'='wait' THEN UPDATE resource_journey_runs SET current_step=i+1,next_run_at=now()+make_interval(hours=>(s->'config'->>'hours')::int) WHERE id=r.id;done:=true;
 ELSIF s->>'kind'='condition' THEN i:=i+1;
 ELSIF s->>'kind'='send' THEN
 SELECT * INTO t FROM message_templates WHERE id=(s->'config'->>'template_id')::uuid AND NOT archived AND(team_id IS NULL OR team_id=r.team_id);
 IF t.id IS NULL THEN UPDATE resource_journey_runs SET status='failed',note='template_missing' WHERE id=r.id;done:=true;
 ELSE
 body:=replace(t.body,'{{event}}',coalesce(title,''));subject:=replace(coalesce(t.subject,''),'{{event}}',coalesce(title,''));
 body:=replace(body,'{{resource}}',coalesce(title,''));subject:=replace(subject,'{{resource}}',coalesce(title,''));
 body:=replace(body,'{{name}}',coalesce((SELECT full_name FROM profiles WHERE id=r.user_id),''));
 IF t.channel='in_app' THEN INSERT INTO notifications(user_id,kind,title,body,link) VALUES(r.user_id,'journey',subject,body,'/offer/'||r.offer_id);
 ELSE recipient:=public.user_email(r.user_id);IF recipient IS NOT NULL THEN PERFORM enqueue_message('email',recipient,t.language,'custom_message','transactional',jsonb_build_object('subject',subject,'body',body,'offer_id',r.offer_id,'journey_run_id',r.id),now(),NULL,NULL,r.user_id,r.team_id,NULL);END IF;END IF;
 i:=i+1;
 END IF;
 ELSE UPDATE resource_journey_runs SET status='failed',note='unknown_step' WHERE id=r.id;done:=true;END IF;
 END LOOP;
 IF NOT done THEN UPDATE resource_journey_runs SET current_step=i,status='completed' WHERE id=r.id;END IF;n:=n+1;
 END LOOP;RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.advance_resource_journeys(int) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.advance_resource_journeys(int) TO service_role;
