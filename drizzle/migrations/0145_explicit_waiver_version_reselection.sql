CREATE OR REPLACE FUNCTION public.attach_library_waiver(_event uuid,_waiver uuid,_version int) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e public.events;w public.waiver_library;v public.waiver_library_versions;id uuid;
BEGIN
 SELECT * INTO e FROM public.events WHERE events.id=_event;
 IF NOT public.can_manage_event(_event) THEN RAISE EXCEPTION 'forbidden'; END IF;
 SELECT * INTO w FROM public.waiver_library WHERE waiver_library.id=_waiver AND team_id=e.team_id AND NOT archived;
 IF NOT FOUND OR NOT public.team_capability(w.team_id,'events') THEN RAISE EXCEPTION 'forbidden'; END IF;
 SELECT * INTO v FROM public.waiver_library_versions WHERE waiver_id=w.id AND version=_version;
 IF NOT FOUND THEN RAISE EXCEPTION 'waiver_stale'; END IF;
 SELECT event_waivers.id INTO id FROM public.event_waivers WHERE event_id=e.id AND library_id=w.id AND archived_at IS NULL;
 IF id IS NOT NULL THEN
 UPDATE public.event_waivers SET library_version=v.version,title_en=v.name,title_es=v.name,body_en=v.body_en,body_es=v.body_es WHERE event_waivers.id=id AND library_version IS DISTINCT FROM v.version;
 RETURN id;
 END IF;
 INSERT INTO public.event_waivers(event_id,library_id,library_version,title_en,title_es,body_en,body_es,required) VALUES(e.id,w.id,v.version,v.name,v.name,v.body_en,v.body_es,true) RETURNING event_waivers.id INTO id;
 RETURN id;
END $$;