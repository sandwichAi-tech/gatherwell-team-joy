CREATE OR REPLACE FUNCTION public.guard_resource_journey_status() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.start_trigger='resource_enrollment' AND auth.uid() IS NOT NULL AND NOT public.can_access_offer_participants(NEW.offer_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
 IF NEW.start_trigger='resource_enrollment' AND NEW.status='active' AND EXISTS(SELECT 1 FROM message_journey_steps s JOIN message_templates t ON t.id=(s.config->>'template_id')::uuid WHERE s.journey_id=NEW.id AND s.kind='send' AND t.channel<>'in_app') THEN RAISE EXCEPTION 'setup_required_email'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_resource_journey_status BEFORE UPDATE ON public.message_journeys FOR EACH ROW EXECUTE FUNCTION public.guard_resource_journey_status();
CREATE OR REPLACE FUNCTION public.sync_resource_run_status() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.status='paused' THEN UPDATE resource_journey_runs SET status='paused' WHERE journey_id=NEW.id AND status='running';
 ELSIF NEW.status='active' THEN UPDATE resource_journey_runs SET status='running' WHERE journey_id=NEW.id AND status='paused'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER sync_resource_run_status AFTER UPDATE OF status ON public.message_journeys FOR EACH ROW EXECUTE FUNCTION public.sync_resource_run_status();
