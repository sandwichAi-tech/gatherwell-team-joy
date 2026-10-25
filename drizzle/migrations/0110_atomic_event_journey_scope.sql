CREATE OR REPLACE FUNCTION public.save_event_communication_journey(_team uuid,_id uuid,_event uuid,_name text,_trigger text,_steps jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT public.team_capability(_team,'messages') THEN RAISE EXCEPTION 'forbidden'; END IF;
 IF _event IS NOT NULL AND NOT EXISTS(SELECT 1 FROM events WHERE id=_event AND team_id=_team AND public.can_manage_event(id)) THEN RAISE EXCEPTION 'forbidden'; END IF;
 IF _id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM message_journeys WHERE id=_id AND team_id=_team AND start_trigger<>'resource_enrollment') THEN RAISE EXCEPTION 'forbidden'; END IF;
 result:=public.save_message_journey(_team,_id,_name,_trigger,_steps);
 UPDATE message_journeys SET event_id=_event,offer_id=NULL WHERE id=result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.save_event_communication_journey(uuid,uuid,uuid,text,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_event_communication_journey(uuid,uuid,uuid,text,text,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.guard_communication_scope() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.start_trigger='resource_enrollment' AND (NEW.offer_id IS NULL OR NOT EXISTS(SELECT 1 FROM offers WHERE id=NEW.offer_id AND team_id=NEW.team_id)) THEN RAISE EXCEPTION 'resource_required'; END IF;
 IF NEW.start_trigger<>'resource_enrollment' AND NEW.offer_id IS NOT NULL THEN NEW.offer_id:=NULL; END IF;
 IF NEW.event_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM events WHERE id=NEW.event_id AND team_id=NEW.team_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_communication_scope BEFORE INSERT OR UPDATE ON public.message_journeys FOR EACH ROW EXECUTE FUNCTION public.guard_communication_scope();