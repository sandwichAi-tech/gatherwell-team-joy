ALTER TABLE public.events ADD COLUMN team_waiver_version int;
CREATE OR REPLACE FUNCTION public.pin_team_waiver() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.requires_waiver AND (TG_OP='INSERT' OR NOT OLD.requires_waiver OR NEW.team_waiver_version IS NULL) THEN
 SELECT version INTO NEW.team_waiver_version FROM public.waivers WHERE team_id=NEW.team_id;
 IF NEW.team_waiver_version IS NULL THEN RAISE EXCEPTION 'waiver_missing'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER events_pin_team_waiver BEFORE INSERT OR UPDATE OF requires_waiver ON public.events FOR EACH ROW EXECUTE FUNCTION public.pin_team_waiver();
CREATE OR REPLACE FUNCTION public.event_waiver(_event uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE e record;w record;en text;es text;
BEGIN
 SELECT id,team_id,requires_waiver,visibility,status,team_waiver_version INTO e FROM public.events WHERE id=_event;
 IF NOT FOUND OR NOT (((e.visibility='public' OR (e.visibility='invite' AND current_setting('gw.invite',true)=_event::text)) AND e.status IN('published','cancelled')) OR (auth.uid() IS NOT NULL AND public.can_view_event(_event))) THEN RETURN NULL; END IF;
 IF NOT e.requires_waiver THEN RETURN jsonb_build_object('required',false); END IF;
 SELECT * INTO w FROM public.waivers WHERE team_id=e.team_id;IF NOT FOUND THEN RAISE EXCEPTION 'waiver_missing'; END IF;
 SELECT body INTO en FROM public.consent_text_versions WHERE kind='waiver' AND team_id=e.team_id AND version=coalesce(e.team_waiver_version,w.version) AND locale='en';
 SELECT body INTO es FROM public.consent_text_versions WHERE kind='waiver' AND team_id=e.team_id AND version=coalesce(e.team_waiver_version,w.version) AND locale='es';
 RETURN jsonb_build_object('required',true,'version',coalesce(e.team_waiver_version,w.version),'draft',w.is_draft,'title_en',w.title_en,'title_es',w.title_es,'body_en',coalesce(en,w.body_en),'body_es',coalesce(es,w.body_es));
END $$;
CREATE OR REPLACE FUNCTION public.record_waiver(_rsvp uuid,_name text,_ip text,_source text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r record;v int;
BEGIN
 IF length(trim(coalesce(_name,''))) NOT BETWEEN 2 AND 120 THEN RAISE EXCEPTION 'waiver_required'; END IF;
 SELECT rs.id,e.id event_id,e.team_id,e.team_waiver_version INTO r FROM public.rsvps rs JOIN public.events e ON e.id=rs.event_id WHERE rs.id=_rsvp;
 IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
 SELECT coalesce(r.team_waiver_version,version) INTO v FROM public.waivers WHERE team_id=r.team_id;
 INSERT INTO public.waiver_acceptances(rsvp_id,event_id,team_id,version,full_name,ip,source) VALUES(_rsvp,r.event_id,r.team_id,v,trim(_name),left(_ip,64),_source) ON CONFLICT(rsvp_id) DO NOTHING;
END $$;
CREATE OR REPLACE FUNCTION public.checkin_blocker(_rsvp uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT CASE WHEN e.status<>'published' THEN 'event_unavailable' WHEN r.merged_into_rsvp_id IS NOT NULL THEN 'not_found' WHEN r.status='cancelled' THEN 'cancelled' WHEN r.status='waitlist' THEN 'waitlist' WHEN r.status<>'going' THEN 'registration_required'
 WHEN(e.requires_waiver AND NOT EXISTS(SELECT 1 FROM public.waiver_acceptances a WHERE a.rsvp_id=r.id AND a.event_id=e.id AND a.accepted_body_sha256 IS NOT NULL AND a.version=coalesce(e.team_waiver_version,a.version))) OR EXISTS(SELECT 1 FROM public.event_waivers w WHERE w.event_id=e.id AND w.required AND w.archived_at IS NULL AND NOT EXISTS(SELECT 1 FROM public.event_waiver_acceptances a JOIN public.event_waiver_versions v ON v.waiver_id=a.waiver_id AND v.version=a.version AND v.content_sha256=a.content_sha256 WHERE a.rsvp_id=r.id AND a.event_id=e.id AND a.waiver_id=w.id AND a.version=w.version)) THEN 'waiver_required' ELSE NULL END FROM public.rsvps r JOIN public.events e ON e.id=r.event_id WHERE r.id=_rsvp;
$$;
DROP POLICY IF EXISTS "Team members read the team waiver" ON public.waivers;
CREATE POLICY team_waiver_managers ON public.waivers FOR SELECT TO authenticated USING(public.team_capability(team_id,'events'));
CREATE OR REPLACE FUNCTION public.remove_library_attachment(_event uuid,_library uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.can_manage_event(_event) THEN RAISE EXCEPTION 'forbidden'; END IF;
 UPDATE public.event_waivers SET archived_at=now() WHERE event_id=_event AND library_id=_library AND archived_at IS NULL;
END $$;
REVOKE ALL ON FUNCTION public.remove_library_attachment(uuid,uuid) FROM PUBLIC,anon;GRANT EXECUTE ON FUNCTION public.remove_library_attachment(uuid,uuid) TO authenticated;