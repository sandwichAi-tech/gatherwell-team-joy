ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS assigned_to uuid;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS escalated_at timestamptz;
CREATE INDEX IF NOT EXISTS reports_safety_queue ON public.reports(status, created_at DESC, id);
CREATE INDEX IF NOT EXISTS admin_safety_throttle ON public.rsvp_attempts(key, created_at);

CREATE OR REPLACE FUNCTION public.admin_safety_guard() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE k text := 'admin-safety:' || auth.uid()::text;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') OR EXISTS(SELECT 1 FROM public.user_suspensions WHERE user_id=auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(k,0));
 IF (SELECT count(*) FROM public.rsvp_attempts WHERE key=k AND created_at>now()-interval '1 minute')>=60 THEN RAISE EXCEPTION 'rate_limited'; END IF;
 INSERT INTO public.rsvp_attempts(key) VALUES(k);
END $$;
REVOKE ALL ON FUNCTION public.admin_safety_guard() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_safety_guard() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_safety_list(_kind text,_q text DEFAULT '',_state text DEFAULT 'all',_page integer DEFAULT 0) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb; term text:=left(trim(coalesce(_q,'')),100); off integer:=_page*25;
BEGIN
 PERFORM public.admin_safety_guard();
 IF _page<0 OR _page>10000 OR _kind NOT IN ('users','teams','offerings','reports','audit','communities') THEN RAISE EXCEPTION 'invalid'; END IF;
 IF _kind='users' THEN
 SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') INTO result FROM (
 SELECT p.id,coalesce(p.full_name,'') AS title,'user'::text AS kind,CASE WHEN s.user_id IS NULL THEN 'active' ELSE 'suspended' END AS state,p.created_at
 FROM profiles p LEFT JOIN user_suspensions s ON s.user_id=p.id WHERE (term='' OR p.full_name ILIKE '%'||term||'%' OR p.id::text=term) AND (_state='all' OR (_state='suspended')=(s.user_id IS NOT NULL)) ORDER BY p.created_at DESC,p.id LIMIT 26 OFFSET off) x;
 ELSIF _kind='teams' THEN
 SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') INTO result FROM (
 SELECT t.id,t.name AS title,'team'::text AS kind,CASE WHEN s.team_id IS NULL THEN 'active' ELSE 'suspended' END AS state,t.created_at,(SELECT count(*) FROM team_members m WHERE m.team_id=t.id) AS members
 FROM teams t LEFT JOIN team_suspensions s ON s.team_id=t.id WHERE (term='' OR t.name ILIKE '%'||term||'%' OR t.id::text=term) AND (_state='all' OR (_state='suspended')=(s.team_id IS NOT NULL)) ORDER BY t.created_at DESC,t.id LIMIT 26 OFFSET off) x;
 ELSIF _kind='offerings' THEN
 SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') INTO result FROM (
 SELECT * FROM (SELECT e.id,e.title,CASE WHEN e.retreat IS NOT NULL THEN 'retreat' ELSE 'event' END AS kind,e.status AS state,e.created_at,e.team_id FROM events e
 UNION ALL SELECT o.id,o.title_en,CASE WHEN o.kind='download' THEN 'resource' ELSE o.kind END,o.status,o.created_at,o.team_id FROM offers o) a
 WHERE (term='' OR title ILIKE '%'||term||'%' OR id::text=term) AND (_state='all' OR state=_state) ORDER BY created_at DESC,id LIMIT 26 OFFSET off) x;
 ELSIF _kind='reports' THEN
 SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') INTO result FROM (
 SELECT r.id,r.target_type AS kind,r.target_id,r.reason,r.status AS state,r.created_at,r.assigned_to,r.escalated_at,
 CASE r.target_type WHEN 'event' THEN (SELECT title FROM events WHERE id=r.target_id) WHEN 'comment' THEN (SELECT left(body,300) FROM comments WHERE id=r.target_id) WHEN 'shoutout' THEN (SELECT left(message,300) FROM shoutouts WHERE id=r.target_id) WHEN 'announcement' THEN (SELECT left(body,300) FROM announcements WHERE id=r.target_id) ELSE r.target_type END AS title,
 (SELECT full_name FROM profiles WHERE id=r.assigned_to) AS assignee
 FROM reports r WHERE (term='' OR r.target_id::text=term OR r.target_type ILIKE '%'||term||'%') AND (_state='all' OR (_state='open' AND r.status='open') OR (_state='closed' AND r.status<>'open') OR (_state='escalated' AND r.status='open' AND r.escalated_at IS NOT NULL) OR (_state='mine' AND r.status='open' AND r.assigned_to=auth.uid())) ORDER BY r.created_at DESC,r.id LIMIT 26 OFFSET off) x;
 ELSIF _kind='communities' THEN
 SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') INTO result FROM (
 SELECT s.id,coalesce(p.full_name,'') AS title,s.scope_type AS kind,CASE WHEN s.revoked_at IS NULL THEN 'suspended' ELSE 'active' END AS state,s.created_at,s.team_id,s.scope_id,s.user_id,t.name AS workspace
 FROM community_suspensions s LEFT JOIN profiles p ON p.id=s.user_id LEFT JOIN teams t ON t.id=s.team_id WHERE (term='' OR p.full_name ILIKE '%'||term||'%' OR t.name ILIKE '%'||term||'%' OR s.id::text=term) AND (_state='all' OR (_state='suspended')=(s.revoked_at IS NULL)) ORDER BY s.created_at DESC,s.id LIMIT 26 OFFSET off) x;
 ELSE
 SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') INTO result FROM (
 SELECT a.id,a.action AS title,a.target_type AS kind,a.target_id,a.created_at,a.actor_id,p.full_name AS actor,CASE WHEN a.action LIKE 'safety.%' THEN a.note ELSE NULL END AS reason
 FROM admin_audit a LEFT JOIN profiles p ON p.id=a.actor_id WHERE term='' OR a.action ILIKE '%'||term||'%' OR a.target_id=term ORDER BY a.created_at DESC,a.id LIMIT 26 OFFSET off) x;
 END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.admin_safety_list(text,text,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_safety_list(text,text,text,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_safety_action(_kind text,_id uuid,_action text,_reason text,_user uuid DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r reports; s community_suspensions; old_state text; team uuid;
BEGIN
 PERFORM public.admin_safety_guard();
 IF length(trim(coalesce(_reason,'')))<3 OR length(_reason)>500 THEN RAISE EXCEPTION 'reason_required'; END IF;
 IF _kind='report' THEN
 SELECT * INTO r FROM reports WHERE id=_id FOR UPDATE;
 IF r.id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
 IF r.status<>'open' THEN RAISE EXCEPTION 'already_resolved'; END IF;
 IF _action='claim' THEN UPDATE reports SET assigned_to=auth.uid() WHERE id=_id;
 ELSIF _action='escalate' THEN UPDATE reports SET escalated_at=now(),assigned_to=auth.uid() WHERE id=_id;
 ELSIF _action IN ('resolve','dismiss','hide') THEN
 IF _action='hide' THEN
 CASE r.target_type
 WHEN 'event' THEN UPDATE events SET status='draft' WHERE id=r.target_id AND status='published';
 WHEN 'comment' THEN UPDATE comments SET hidden=true WHERE id=r.target_id;
 WHEN 'photo' THEN UPDATE event_photos SET hidden=true WHERE id=r.target_id;
 WHEN 'shoutout' THEN UPDATE shoutouts SET hidden=true WHERE id=r.target_id;
 ELSE RAISE EXCEPTION 'unsupported_intervention'; END CASE;
 IF NOT FOUND THEN RAISE EXCEPTION 'not_found_or_not_published'; END IF;
 END IF;
 UPDATE reports SET status=CASE WHEN _action='hide' THEN 'removed' ELSE 'approved' END,resolution_note=trim(_reason),resolved_at=now(),resolved_by=auth.uid() WHERE id=_id;
 ELSE RAISE EXCEPTION 'invalid'; END IF;
 ELSIF _kind IN ('event','offer') AND _action='unpublish' THEN
 IF _kind='event' THEN SELECT status INTO old_state FROM events WHERE id=_id FOR UPDATE; UPDATE events SET status='draft' WHERE id=_id AND status='published';
 ELSE SELECT status INTO old_state FROM offers WHERE id=_id FOR UPDATE; UPDATE offers SET status='draft' WHERE id=_id AND status='published'; END IF;
 IF NOT FOUND THEN RAISE EXCEPTION 'not_found_or_not_published'; END IF;
 ELSIF _kind='team' AND _action IN ('suspend','restore') THEN
 PERFORM 1 FROM teams WHERE id=_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
 IF _action='suspend' THEN INSERT INTO team_suspensions(team_id,reason,suspended_by) VALUES(_id,trim(_reason),auth.uid()) ON CONFLICT(team_id) DO UPDATE SET reason=excluded.reason,suspended_by=excluded.suspended_by;
 ELSE DELETE FROM team_suspensions WHERE team_id=_id; IF NOT FOUND THEN RAISE EXCEPTION 'not_suspended'; END IF; END IF;
 ELSIF _kind IN ('community_event','community_topic','community_team') AND _action='suspend' THEN
 IF _user IS NULL OR NOT EXISTS(SELECT 1 FROM profiles WHERE id=_user) THEN RAISE EXCEPTION 'not_found'; END IF;
 IF _kind='community_event' THEN SELECT team_id INTO team FROM events WHERE id=_id;
 ELSIF _kind='community_topic' THEN SELECT team_id INTO team FROM discussion_topics WHERE id=_id;
 ELSE SELECT id INTO team FROM teams WHERE id=_id; END IF;
 IF team IS NULL THEN RAISE EXCEPTION 'invalid_scope'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(_kind||_id::text||_user::text,0));
 IF EXISTS(SELECT 1 FROM community_suspensions WHERE team_id=team AND user_id=_user AND scope_type=replace(_kind,'community_','') AND scope_id IS NOT DISTINCT FROM CASE WHEN _kind='community_team' THEN NULL ELSE _id END AND revoked_at IS NULL) THEN RAISE EXCEPTION 'already_suspended'; END IF;
 INSERT INTO community_suspensions(team_id,user_id,scope_type,scope_id,reason,created_by) VALUES(team,_user,replace(_kind,'community_',''),CASE WHEN _kind='community_team' THEN NULL ELSE _id END,trim(_reason),auth.uid());
 ELSIF _kind='community' AND _action='restore' THEN
 SELECT * INTO s FROM community_suspensions WHERE id=_id FOR UPDATE; IF s.id IS NULL OR s.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'not_suspended'; END IF;
 UPDATE community_suspensions SET revoked_at=now(),revoked_by=auth.uid() WHERE id=_id;
 ELSE RAISE EXCEPTION 'invalid'; END IF;
 INSERT INTO admin_audit(actor_id,action,target_type,target_id,note,before,after) VALUES(auth.uid(),'safety.'||_kind||'.'||_action,_kind,_id::text,trim(_reason),CASE WHEN old_state IS NULL THEN NULL ELSE jsonb_build_object('status',old_state) END,jsonb_build_object('action',_action));
END $$;
REVOKE ALL ON FUNCTION public.admin_safety_action(text,uuid,text,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_safety_action(text,uuid,text,text,uuid) TO authenticated;

-- Legacy search endpoints remain callable but share the private bounded projection and throttle.
CREATE OR REPLACE FUNCTION public.admin_users(_q text) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT public.admin_safety_list('users',_q,'all',0) $$;
CREATE OR REPLACE FUNCTION public.admin_teams(_q text) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT public.admin_safety_list('teams',_q,'all',0) $$;
CREATE OR REPLACE FUNCTION public.admin_reports(_status text) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT public.admin_safety_list('reports','',_status,0) $$;