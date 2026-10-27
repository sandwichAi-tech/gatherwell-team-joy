ALTER TABLE public.rsvps ADD COLUMN walkin_request_id uuid;
CREATE UNIQUE INDEX rsvps_walkin_request_unique ON public.rsvps(event_id,walkin_request_id) WHERE walkin_request_id IS NOT NULL;
COMMENT ON COLUMN public.rsvps.walkin_request_id IS 'Door-operation retry identity, event-bound; not an attendance or payment credential.';
CREATE OR REPLACE FUNCTION public.can_checkin_event(_event uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM events e WHERE e.id=_event AND (e.host_id=auth.uid() OR EXISTS(SELECT 1 FROM event_cohosts c WHERE c.event_id=e.id AND c.user_id=auth.uid()) OR EXISTS(SELECT 1 FROM team_members m JOIN workspace_assignments a ON a.team_id=m.team_id AND a.user_id=m.user_id WHERE m.team_id=e.team_id AND m.user_id=auth.uid() AND m.suspended_at IS NULL AND m.workspace_role IN ('checkin','host','admin','owner') AND a.scope_type='event' AND a.scope_id=e.id AND a.revoked_at IS NULL)))
$$;
CREATE OR REPLACE FUNCTION public.walk_in_admit(_event uuid,_request uuid,_first text,_last text,_phone text,_email text,_language text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e public.events; r public.rsvps; n text:=trim(coalesce(_first,'')||' '||coalesce(_last,'')); em text:=lower(nullif(trim(_email),'')); ph text:=nullif(regexp_replace(coalesce(_phone,''),'[^0-9+]','','g'),''); uid uuid; used integer;
BEGIN
 IF NOT public.can_checkin_event(_event) THEN RAISE EXCEPTION 'not_allowed'; END IF;
 SELECT * INTO e FROM events WHERE id=_event FOR UPDATE;
 IF e.status<>'published' THEN RAISE EXCEPTION 'not_open'; END IF;
 IF _request IS NULL THEN RAISE EXCEPTION 'request_required'; END IF;
 SELECT * INTO r FROM rsvps WHERE event_id=_event AND walkin_request_id=_request;
 IF FOUND THEN RETURN jsonb_build_object('result','confirmed','rsvp_id',r.id,'status',r.status,'checked_in',r.checked_in_at IS NOT NULL); END IF;
 IF coalesce(trim(_first),'')='' OR length(n)>120 THEN RAISE EXCEPTION 'name_required'; END IF;
 IF em IS NULL AND ph IS NULL THEN RAISE EXCEPTION 'contact_required'; END IF;
 IF length(coalesce(_email,''))>200 OR length(coalesce(_phone,''))>30 THEN RAISE EXCEPTION 'too_long'; END IF;
 IF em IS NOT NULL AND em !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'invalid_email'; END IF;
 SELECT id INTO uid FROM profiles WHERE em IS NOT NULL AND lower(email)=em LIMIT 1;
 SELECT * INTO r FROM rsvps WHERE event_id=_event AND merged_into_rsvp_id IS NULL AND ((em IS NOT NULL AND lower(trim(guest_email))=em) OR (ph IS NOT NULL AND regexp_replace(coalesce(guest_phone,''),'[^0-9+]','','g')=ph) OR (uid IS NOT NULL AND user_id=uid)) ORDER BY created_at LIMIT 1;
 IF FOUND THEN RETURN jsonb_build_object('result',CASE WHEN r.checked_in_at IS NOT NULL THEN 'already' ELSE 'existing' END,'rsvp_id',r.id,'status',r.status,'checked_in',r.checked_in_at IS NOT NULL); END IF;
 IF coalesce(e.price_cents,0)>0 OR e.offer_id IS NOT NULL THEN RAISE EXCEPTION 'payment_required'; END IF;
 IF jsonb_array_length(e.ticket_tiers)>0 THEN RAISE EXCEPTION 'tier_required'; END IF;
 IF e.requires_waiver OR EXISTS(SELECT 1 FROM event_waivers w WHERE w.event_id=_event AND w.required AND w.archived_at IS NULL) THEN RAISE EXCEPTION 'waiver_required'; END IF;
 SELECT coalesce(sum(1+plus_ones),0) INTO used FROM rsvps WHERE event_id=_event AND status IN ('going','maybe') AND merged_into_rsvp_id IS NULL;
 IF e.capacity IS NOT NULL AND used>=e.capacity THEN RAISE EXCEPTION 'event_full'; END IF;
 INSERT INTO rsvps(event_id,user_id,guest_name,guest_phone,guest_email,language,status,is_walk_in,sms_opt_in,email_opt_in,walkin_request_id) VALUES(_event,uid,n,nullif(trim(_phone),''),em,CASE WHEN _language='es' THEN 'es' ELSE 'en' END,'going',true,false,false,_request) RETURNING * INTO r;
 PERFORM public.check_in_rsvp(r.id,false);
 IF e.team_id IS NOT NULL THEN INSERT INTO team_audit(team_id,actor,action,target,meta) VALUES(e.team_id,auth.uid(),'walk_in',r.id,jsonb_build_object('event_id',_event)); END IF;
 RETURN jsonb_build_object('result','confirmed','rsvp_id',r.id,'status','going','checked_in',true);
END $$;
REVOKE ALL ON FUNCTION public.walk_in_admit(uuid,uuid,text,text,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.walk_in_admit(uuid,uuid,text,text,text,text,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.add_walk_in(_event uuid,_first text,_last text,_phone text,_email text,_sms boolean,_mail boolean,_language text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE r jsonb; BEGIN r:=public.walk_in_admit(_event,gen_random_uuid(),_first,_last,_phone,_email,_language); IF r->>'result'<>'confirmed' THEN RAISE EXCEPTION 'already_registered'; END IF; RETURN (r->>'rsvp_id')::uuid; END $$;
CREATE OR REPLACE FUNCTION public.home_checkin_start(_event uuid,_at timestamptz) RETURNS timestamptz LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ DECLARE e public.events; z text; d date; a timestamptz; BEGIN SELECT * INTO e FROM events WHERE id=_event; IF NOT FOUND OR e.status<>'published' THEN RETURN NULL; END IF; SELECT name INTO z FROM pg_timezone_names WHERE name=e.timezone; z:=coalesce(z,'UTC'); d:=(_at AT TIME ZONE z)::date;
 IF jsonb_array_length(e.experience_sessions)>0 THEN SELECT min((s->>'starts_at')::timestamptz) INTO a FROM jsonb_array_elements(e.experience_sessions) s WHERE ((s->>'starts_at')::timestamptz AT TIME ZONE z)::date=d; RETURN a; END IF;
 IF d BETWEEN (e.starts_at AT TIME ZONE z)::date AND (coalesce(e.ends_at,e.starts_at) AT TIME ZONE z)::date THEN RETURN e.starts_at; END IF; RETURN NULL; END $$;
REVOKE ALL ON FUNCTION public.home_checkin_start(uuid,timestamptz) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.my_checkin_events() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ BEGIN IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF; RETURN (SELECT coalesce(jsonb_agg(row_to_json(x) ORDER BY x.starts_at),'[]'::jsonb) FROM (SELECT e.id,e.title,public.home_checkin_start(e.id,now()) starts_at,e.timezone FROM events e WHERE e.status='published' AND public.can_checkin_event(e.id) AND public.home_checkin_start(e.id,now()) IS NOT NULL) x); END $$;
DO $$ DECLARE definition text; BEGIN definition:=pg_get_functiondef('public.personal_home()'::regprocedure); definition:=replace(definition,'RETURN result;', 'IF hosting THEN result:=result || jsonb_build_object(''event_progress'',jsonb_build_object(''exists'',EXISTS(SELECT 1 FROM events WHERE host_id=uid),''draft'',(SELECT jsonb_build_object(''id'',id,''title'',title) FROM events WHERE host_id=uid AND status=''draft'' ORDER BY updated_at DESC,id LIMIT 1))); END IF; RETURN result;'); EXECUTE definition; END $$;
COMMENT ON FUNCTION public.my_checkin_events() IS 'Home only: event-local calendar day, concrete series occurrence rows, explicit session start days; continuous events on inclusive local start/end dates. Management and attendee QR are unchanged.';