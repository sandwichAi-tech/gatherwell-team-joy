ALTER TABLE public.events ADD COLUMN experience_sessions jsonb NOT NULL DEFAULT '[]'::jsonb;
COMMENT ON COLUMN public.events.experience_sessions IS 'Whole-experience schedule; one registration/ticket/check-in for the parent event, not per-session admission.';
CREATE OR REPLACE FUNCTION public.validate_experience_sessions() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE s jsonb; a timestamptz; b timestamptz; prev timestamptz;
BEGIN
 IF jsonb_typeof(NEW.experience_sessions)<>'array' OR jsonb_array_length(NEW.experience_sessions)>20 OR jsonb_array_length(NEW.experience_sessions)=1 THEN RAISE EXCEPTION 'invalid_sessions'; END IF;
 IF jsonb_array_length(NEW.experience_sessions)>0 THEN
  IF NEW.retreat IS NOT NULL OR NEW.series_id IS NOT NULL THEN RAISE EXCEPTION 'incompatible_sessions'; END IF;
  FOR s IN SELECT * FROM jsonb_array_elements(NEW.experience_sessions) LOOP
   IF jsonb_typeof(s)<>'object' OR length(coalesce(s->>'title','')) NOT BETWEEN 1 AND 100 OR length(coalesce(s->>'place',''))>300 OR public.has_blocked_claim(coalesce(s->>'title','')) THEN RAISE EXCEPTION 'invalid_sessions'; END IF;
   a:=(s->>'starts_at')::timestamptz; b:=(s->>'ends_at')::timestamptz;
   IF a IS NULL OR b IS NULL OR b<=a OR a<NEW.starts_at OR b>NEW.starts_at+interval '31 days' OR (prev IS NOT NULL AND a<prev) THEN RAISE EXCEPTION 'invalid_sessions'; END IF;
   prev:=b;
  END LOOP;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER validate_experience_sessions BEFORE INSERT OR UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.validate_experience_sessions();
CREATE OR REPLACE FUNCTION public.set_event_sessions(_event uuid,_sessions jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e public.events; last_end timestamptz;
BEGIN
 IF NOT public.can_manage_event(_event) THEN RAISE EXCEPTION 'forbidden'; END IF;
 SELECT * INTO e FROM public.events WHERE id=_event FOR UPDATE;
 IF _sessions IS NULL OR jsonb_typeof(_sessions)<>'array' THEN RAISE EXCEPTION 'invalid_sessions'; END IF;
 IF jsonb_array_length(_sessions)>0 THEN last_end:=(_sessions->(jsonb_array_length(_sessions)-1)->>'ends_at')::timestamptz; ELSE last_end:=e.ends_at; END IF;
 UPDATE public.events SET experience_sessions=_sessions,ends_at=last_end WHERE id=_event;
END $$;
REVOKE ALL ON FUNCTION public.set_event_sessions(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_event_sessions(uuid,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.public_event_sessions(_event uuid,_token text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF _token IS NOT NULL THEN PERFORM public.unlock_invite(_event,_token); END IF;
 IF NOT public.can_view_event(_event) THEN RETURN '[]'::jsonb; END IF;
 RETURN coalesce((SELECT experience_sessions FROM public.events WHERE id=_event),'[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.public_event_sessions(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_event_sessions(uuid,text) TO anon,authenticated;
