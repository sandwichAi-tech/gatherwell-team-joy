CREATE OR REPLACE FUNCTION public.checkin_blocker(_rsvp uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT CASE WHEN e.status <> 'published' THEN 'event_unavailable'
 WHEN r.merged_into_rsvp_id IS NOT NULL THEN 'not_found'
 WHEN r.status='cancelled' THEN 'cancelled' WHEN r.status='waitlist' THEN 'waitlist'
 WHEN r.status<>'going' THEN 'registration_required'
 WHEN (e.requires_waiver AND NOT EXISTS(SELECT 1 FROM public.waiver_acceptances a WHERE a.rsvp_id=r.id)) OR EXISTS(SELECT 1 FROM public.event_waivers w WHERE w.event_id=e.id AND w.required AND w.archived_at IS NULL AND NOT EXISTS(SELECT 1 FROM public.event_waiver_acceptances a WHERE a.rsvp_id=r.id AND a.waiver_id=w.id)) THEN 'waiver_required'
 ELSE NULL END FROM public.rsvps r JOIN public.events e ON e.id=r.event_id WHERE r.id=_rsvp
$$;
REVOKE ALL ON FUNCTION public.checkin_blocker(uuid) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.guard_confirmed_checkin() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b text;
BEGIN
 IF NEW.checked_in_at IS NULL OR (TG_OP='UPDATE' AND OLD.checked_in_at IS NOT NULL) THEN RETURN NEW; END IF;
 IF TG_OP='INSERT' THEN
  IF NOT EXISTS(SELECT 1 FROM public.events e WHERE e.id=NEW.event_id AND e.status='published') OR NEW.status<>'going' THEN RAISE EXCEPTION 'registration_required'; END IF;
  IF EXISTS(SELECT 1 FROM public.events e WHERE e.id=NEW.event_id AND e.requires_waiver) OR EXISTS(SELECT 1 FROM public.event_waivers w WHERE w.event_id=NEW.event_id AND w.required AND w.archived_at IS NULL) THEN RAISE EXCEPTION 'waiver_required'; END IF;
 ELSE
  b:=public.checkin_blocker(NEW.id); IF b IS NOT NULL THEN RAISE EXCEPTION '%',b; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER confirmed_checkin_guard BEFORE INSERT OR UPDATE OF checked_in_at ON public.rsvps FOR EACH ROW EXECUTE FUNCTION public.guard_confirmed_checkin();
CREATE OR REPLACE FUNCTION public.check_in_code(_event uuid,_code text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.rsvps%ROWTYPE; b text; k text; team uuid;
BEGIN
 IF NOT public.can_checkin_event(_event) THEN RAISE EXCEPTION 'not_allowed'; END IF;
 k:='checkin:'||_event::text||':'||auth.uid()::text;
 IF (SELECT count(*) FROM public.rsvp_attempts WHERE key=k AND created_at>now()-interval '1 minute')>=40 THEN RETURN jsonb_build_object('result','rate_limited'); END IF;
 INSERT INTO public.rsvp_attempts(key) VALUES(k);
 IF coalesce(_code,'') !~ '^[a-fA-F0-9 -]{6,80}$' THEN RETURN jsonb_build_object('result','not_found'); END IF;
 SELECT * INTO r FROM public.rsvps WHERE event_id=_event AND checkin_code=lower(regexp_replace(trim(_code),'[ -]','','g')) AND merged_into_rsvp_id IS NULL FOR UPDATE;
 IF NOT FOUND THEN
  IF EXISTS(SELECT 1 FROM public.rsvps x WHERE x.checkin_code=lower(regexp_replace(trim(_code),'[ -]','','g')) AND x.event_id<>_event AND x.merged_into_rsvp_id IS NULL) THEN RETURN jsonb_build_object('result','wrong_event'); END IF;
  RETURN jsonb_build_object('result','not_found');
 END IF;
 b:=public.checkin_blocker(r.id); IF b IS NOT NULL THEN RETURN jsonb_build_object('result',b); END IF;
 IF r.checked_in_at IS NOT NULL THEN RETURN jsonb_build_object('result','already','name',r.guest_name); END IF;
 UPDATE public.rsvps SET checked_in_at=now() WHERE id=r.id;
 SELECT team_id INTO team FROM public.events WHERE id=_event;
 IF team IS NOT NULL THEN INSERT INTO public.team_audit(team_id,actor,action,target,meta) VALUES(team,auth.uid(),'checkin',r.id,jsonb_build_object('event_id',_event,'via','code')); END IF;
 RETURN jsonb_build_object('result','ok','name',r.guest_name);
END $$;
CREATE OR REPLACE FUNCTION public.check_in_rsvp(_rsvp uuid,_undo boolean DEFAULT false) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.rsvps%ROWTYPE; b text; team uuid;
BEGIN
 SELECT * INTO r FROM public.rsvps WHERE id=_rsvp FOR UPDATE;
 IF NOT FOUND OR NOT public.can_checkin_event(r.event_id) THEN RAISE EXCEPTION 'not_allowed'; END IF;
 IF _undo THEN IF r.checked_in_at IS NULL THEN RETURN; END IF; UPDATE public.rsvps SET checked_in_at=NULL WHERE id=_rsvp;
 ELSE
  b:=public.checkin_blocker(_rsvp); IF b IS NOT NULL THEN RAISE EXCEPTION '%',b; END IF;
  IF r.checked_in_at IS NOT NULL THEN RETURN; END IF;
  UPDATE public.rsvps SET checked_in_at=now() WHERE id=_rsvp;
 END IF;
 SELECT team_id INTO team FROM public.events WHERE id=r.event_id;
 IF team IS NOT NULL THEN INSERT INTO public.team_audit(team_id,actor,action,target,meta) VALUES(team,auth.uid(),CASE WHEN _undo THEN 'checkin_undo' ELSE 'checkin' END,_rsvp,jsonb_build_object('event_id',r.event_id,'via','list')); END IF;
END $$;
CREATE OR REPLACE FUNCTION public.my_checkin_events() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT coalesce(jsonb_agg(row_to_json(x) ORDER BY x.starts_at),'[]'::jsonb) FROM (SELECT id,title,starts_at FROM public.events WHERE status='published' AND coalesce(ends_at,starts_at+interval '2 hours')>=now() AND public.can_checkin_event(id) ORDER BY starts_at LIMIT 6) x
$$;
REVOKE ALL ON FUNCTION public.my_checkin_events() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.my_checkin_events() TO authenticated;
REVOKE ALL ON FUNCTION public.check_in_code(uuid,text),public.check_in_rsvp(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.check_in_code(uuid,text),public.check_in_rsvp(uuid,boolean) TO authenticated;