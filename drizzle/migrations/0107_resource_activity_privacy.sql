ALTER POLICY resource_runs_scoped ON public.resource_journey_runs USING(public.team_capability(team_id,'messages') AND public.can_access_offer_participants(offer_id));
CREATE OR REPLACE FUNCTION public.guard_resource_template_channel() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.channel<>'in_app' AND EXISTS(SELECT 1 FROM message_journey_steps s JOIN message_journeys j ON j.id=s.journey_id WHERE s.config->>'template_id'=NEW.id::text AND j.start_trigger='resource_enrollment' AND j.status='active') THEN RAISE EXCEPTION 'setup_required_email'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_resource_template_channel BEFORE UPDATE OF channel ON public.message_templates FOR EACH ROW EXECUTE FUNCTION public.guard_resource_template_channel();
CREATE OR REPLACE FUNCTION public.guard_resource_send_step() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.kind='send' AND EXISTS(SELECT 1 FROM message_journeys j JOIN message_templates t ON t.id=(NEW.config->>'template_id')::uuid WHERE j.id=NEW.journey_id AND j.start_trigger='resource_enrollment' AND j.status='active' AND t.channel<>'in_app') THEN RAISE EXCEPTION 'setup_required_email'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_resource_send_step BEFORE INSERT OR UPDATE ON public.message_journey_steps FOR EACH ROW EXECUTE FUNCTION public.guard_resource_send_step();