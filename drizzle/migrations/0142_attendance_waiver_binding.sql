CREATE OR REPLACE FUNCTION public.checkin_blocker(_rsvp uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT CASE WHEN e.status<>'published' THEN 'event_unavailable'
 WHEN r.merged_into_rsvp_id IS NOT NULL THEN 'not_found'
 WHEN r.status='cancelled' THEN 'cancelled' WHEN r.status='waitlist' THEN 'waitlist' WHEN r.status<>'going' THEN 'registration_required'
 WHEN (e.requires_waiver AND NOT EXISTS(SELECT 1 FROM public.waiver_acceptances a WHERE a.rsvp_id=r.id AND a.event_id=e.id AND a.accepted_at IS NOT NULL AND a.accepted_body_sha256 IS NOT NULL))
 OR EXISTS(SELECT 1 FROM public.event_waivers w WHERE w.event_id=e.id AND w.required AND w.archived_at IS NULL AND NOT EXISTS(SELECT 1 FROM public.event_waiver_acceptances a WHERE a.rsvp_id=r.id AND a.event_id=e.id AND a.waiver_id=w.id AND a.accepted_at IS NOT NULL AND a.content_sha256 IS NOT NULL AND EXISTS(SELECT 1 FROM public.event_waiver_versions v WHERE v.waiver_id=w.id AND v.version=a.version AND v.content_sha256=a.content_sha256))) THEN 'waiver_required'
 ELSE NULL END FROM public.rsvps r JOIN public.events e ON e.id=r.event_id WHERE r.id=_rsvp;
$$;
REVOKE ALL ON FUNCTION public.checkin_blocker(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.checkin_blocker(uuid) TO service_role;