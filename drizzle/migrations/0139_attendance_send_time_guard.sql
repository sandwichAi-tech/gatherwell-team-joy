CREATE OR REPLACE FUNCTION public.guard_attendance_outbox_claim() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.payload ? 'attendance_audience' THEN
 NEW.payload:=NEW.payload||jsonb_build_object('rsvp_id',NEW.rsvp_id);
 IF NEW.status='sending' AND NOT public.attendance_message_eligible(NEW.rsvp_id,NEW.payload->>'attendance_audience',NEW.channel) THEN
 NEW.status:='skipped'; NEW.error:='attendance_or_preference_changed'; NEW.locked_at:=NULL;
 END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER attendance_outbox_claim BEFORE INSERT OR UPDATE OF status ON public.notification_outbox FOR EACH ROW EXECUTE FUNCTION public.guard_attendance_outbox_claim();
CREATE OR REPLACE FUNCTION public.add_walk_in(_event uuid,_first text,_last text,_phone text,_email text,_sms boolean,_mail boolean,_language text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE name text:=trim(coalesce(_first,'')||' '||coalesce(_last,'')); id uuid; team uuid;
BEGIN
 IF NOT public.can_manage_event(_event) THEN RAISE EXCEPTION 'not_allowed'; END IF;
 IF coalesce(trim(_first),'')='' OR length(name)>120 THEN RAISE EXCEPTION 'name_required'; END IF;
 IF nullif(trim(_phone),'') IS NULL AND nullif(trim(_email),'') IS NULL THEN RAISE EXCEPTION 'contact_required'; END IF;
 IF length(coalesce(_phone,''))>30 OR length(coalesce(_email,''))>200 THEN RAISE EXCEPTION 'too_long'; END IF;
 IF EXISTS(SELECT 1 FROM public.event_waivers WHERE event_id=_event AND required AND archived_at IS NULL) THEN RAISE EXCEPTION 'waiver_required'; END IF;
 INSERT INTO public.rsvps(event_id,guest_name,guest_phone,guest_email,language,status,is_walk_in,sms_opt_in,email_opt_in) VALUES(_event,name,nullif(trim(_phone),''),nullif(trim(_email),''),CASE WHEN _language='es' THEN 'es' ELSE 'en' END,'going',true,coalesce(_sms,false),coalesce(_mail,false)) RETURNING rsvps.id INTO id;
 IF NOT EXISTS(SELECT 1 FROM public.events WHERE events.id=_event AND requires_waiver) THEN PERFORM public.check_in_rsvp(id,false); END IF;
 SELECT team_id INTO team FROM public.events WHERE events.id=_event;
 IF team IS NOT NULL THEN INSERT INTO public.team_audit(team_id,actor,action,target,meta) VALUES(team,auth.uid(),'walk_in',id,jsonb_build_object('event_id',_event)); END IF;
 RETURN id;
END $$;