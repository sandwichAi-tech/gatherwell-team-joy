CREATE OR REPLACE FUNCTION public.check_in_admission(_rsvp uuid, _undo boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.rsvps; already boolean;
BEGIN
 SELECT * INTO r FROM public.rsvps WHERE id=_rsvp FOR UPDATE;
 IF NOT FOUND OR NOT public.can_checkin_event(r.event_id) THEN RAISE EXCEPTION 'not_allowed'; END IF;
 already := r.checked_in_at IS NOT NULL;
 PERFORM public.check_in_rsvp(_rsvp,_undo);
 SELECT * INTO r FROM public.rsvps WHERE id=_rsvp;
 RETURN jsonb_build_object('result',CASE WHEN _undo THEN 'undone' WHEN r.checked_in_at IS NULL THEN 'error' WHEN already THEN 'already' ELSE 'ok' END,'name',r.guest_name,'checked_in',r.checked_in_at IS NOT NULL);
END $$;
REVOKE ALL ON FUNCTION public.check_in_admission(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.check_in_admission(uuid,boolean) TO authenticated;
DO $$ DECLARE d text; marker text := 'IF FOUND THEN RETURN jsonb_build_object(''result'',''confirmed'',''rsvp_id'',r.id,''status'',r.status,''checked_in'',r.checked_in_at IS NOT NULL); END IF;'; BEGIN
 d:=pg_get_functiondef('public.walk_in_admit(uuid,uuid,text,text,text,text,text)'::regprocedure);
 IF position(marker in d)=0 THEN RAISE EXCEPTION 'walk_in_definition_changed'; END IF;
 d:=replace(d,marker,'IF FOUND THEN IF r.status<>''going'' OR r.checked_in_at IS NULL THEN RETURN jsonb_build_object(''result'',''existing'',''rsvp_id'',r.id,''status'',r.status,''checked_in'',r.checked_in_at IS NOT NULL); END IF; IF public.checkin_blocker(r.id) IS NOT NULL THEN RAISE EXCEPTION ''%'',public.checkin_blocker(r.id); END IF; RETURN jsonb_build_object(''result'',''confirmed'',''rsvp_id'',r.id,''status'',r.status,''checked_in'',true); END IF;');
 EXECUTE d;
END $$;
CREATE OR REPLACE FUNCTION public.attendance_totals(_event uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE cap integer;
BEGIN
 IF NOT public.can_checkin_event(_event) THEN RAISE EXCEPTION 'not_allowed'; END IF;
 SELECT capacity INTO cap FROM public.events WHERE id=_event;
 RETURN (SELECT jsonb_build_object(
 'registered',coalesce(sum(1+coalesce(plus_ones,0)) FILTER (WHERE status IN ('going','maybe')),0),
 'checked_in',coalesce(sum(1+coalesce(plus_ones,0)) FILTER (WHERE status='going' AND checked_in_at IS NOT NULL),0),
 'walk_ins',coalesce(sum(1+coalesce(plus_ones,0)) FILTER (WHERE status IN ('going','maybe') AND is_walk_in),0),
 'waitlisted',coalesce(sum(1+coalesce(plus_ones,0)) FILTER (WHERE status='waitlist'),0),
 'cancelled',count(*) FILTER (WHERE status='cancelled'),
 'capacity',cap,
 'remaining',CASE WHEN cap IS NULL THEN NULL ELSE greatest(cap-coalesce(sum(1+coalesce(plus_ones,0)) FILTER (WHERE status IN ('going','maybe')),0),0) END)
 FROM public.rsvps WHERE event_id=_event AND merged_into_rsvp_id IS NULL);
END $$;
REVOKE ALL ON FUNCTION public.attendance_totals(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.attendance_totals(uuid) TO authenticated;
DO $$ DECLARE d text; BEGIN
 d:=pg_get_functiondef('public.checkin_guest_list(uuid)'::regprocedure);
 IF position('r.status IN (''going'', ''maybe'', ''waitlist'')' in d)=0 THEN RAISE EXCEPTION 'checkin_list_definition_changed'; END IF;
 d:=replace(d,'r.status IN (''going'', ''maybe'', ''waitlist'')','r.status IN (''going'', ''maybe'', ''waitlist'') AND r.merged_into_rsvp_id IS NULL'); EXECUTE d;
END $$;
COMMENT ON FUNCTION public.attendance_totals(uuid) IS 'Staff-only authoritative person totals excluding merged registrations; registered includes going/maybe, checked_in includes going only, walk_ins is active walk-in persons; cancelled remains registration rows for compatibility.';
COMMENT ON FUNCTION public.check_in_admission(uuid,boolean) IS 'Staff-only explicit receipt around guarded check_in_rsvp; never treats an empty response as admission confirmation.';