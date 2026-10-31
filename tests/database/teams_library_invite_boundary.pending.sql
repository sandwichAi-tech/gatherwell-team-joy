-- Pending authoritative repair. Disposable-only verification; NOT a migration and NOT applied to shared Cloud.
-- Existing tables remain; no customer/payment/affiliate relationships are created.
ALTER TABLE public.team_library_copies ADD COLUMN IF NOT EXISTS source_team_id uuid;
ALTER TABLE public.team_library_copies ADD COLUMN IF NOT EXISTS destination_team_id uuid;

DO $$ DECLARE d text; BEGIN
  SELECT pg_get_functiondef('public.use_resource_template(uuid,uuid)'::regprocedure) INTO d;
  d := replace(d, 's := r.structure;', 'IF r.team_id IS NOT NULL AND r.created_by IS DISTINCT FROM auth.uid() AND NOT EXISTS (SELECT 1 FROM unnest(r.shared_team_ids) x WHERE public.team_channel_access(x)) THEN RAISE EXCEPTION ''not_shared''; END IF; s := r.structure;');
  EXECUTE d;
  SELECT pg_get_functiondef('public.save_resource_template(text,uuid,text,text)'::regprocedure) INTO d;
  d := replace(d, '_team := tr.team_id;', 'IF NOT EXISTS(SELECT 1 FROM teams WHERE id=tr.team_id AND owner_id=auth.uid()) THEN RAISE EXCEPTION ''not_allowed''; END IF; _team := tr.team_id;');
  d := replace(d, '_team := rc.team_id;', 'IF rc.created_by IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION ''not_allowed''; END IF; _team := rc.team_id;');
  d := replace(d, '_team := o.team_id;', 'IF o.host_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION ''not_allowed''; END IF; _team := o.team_id;');
  EXECUTE d;
  SELECT pg_get_functiondef('public.copy_team_library_item(uuid,text,uuid,uuid,uuid)'::regprocedure) INTO d;
  d := replace(d, 'BEGIN IF NOT public.team_channel_access(_team)', 'BEGIN IF _request IS NULL THEN RAISE EXCEPTION ''invalid_retry''; END IF; IF NOT public.team_channel_access(_team)');
  d := replace(d, 'IF cached.source_id<>_id OR cached.source_kind<>_kind THEN', 'IF cached.source_id IS DISTINCT FROM _id OR cached.source_kind IS DISTINCT FROM _kind OR cached.source_team_id IS DISTINCT FROM _team OR cached.destination_team_id IS DISTINCT FROM _destination THEN');
  d := replace(d, 'INSERT INTO team_library_copies(user_id,request_key,source_kind,source_id,target_kind,target_id) VALUES(auth.uid(),_request,_kind,_id,result->>''target'',new_id)', 'INSERT INTO team_library_copies(user_id,request_key,source_kind,source_id,target_kind,target_id,source_team_id,destination_team_id) VALUES(auth.uid(),_request,_kind,_id,result->>''target'',new_id,_team,_destination)');
  EXECUTE d;
END $$;
-- No legacy copy receipt is silently rebound to a new source team/destination.
CREATE POLICY library_delete_author_only ON public.resource_templates AS RESTRICTIVE FOR DELETE TO authenticated USING(created_by=auth.uid() AND public.team_channel_access(team_id));
CREATE OR REPLACE FUNCTION public.can_use_team_templates(_team uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT public.team_channel_access(_team) $$;

-- Validate even the directly callable optional invitation argument. Retries never skip validation.
DO $$ DECLARE d text; BEGIN
  SELECT pg_get_functiondef('public.request_team_membership(uuid,uuid)'::regprocedure) INTO d;
  d := replace(d, 'IF public.team_channel_access(_team)', 'IF _invite IS NOT NULL AND NOT EXISTS(SELECT 1 FROM team_invites i JOIN auth.users u ON u.id=auth.uid() AND u.email_confirmed_at IS NOT NULL AND lower(u.email)=lower(i.email) WHERE i.id=_invite AND i.team_id=_team AND i.revoked_at IS NULL AND i.expires_at>now() AND (i.accepted_at IS NULL OR i.accepted_by=auth.uid())) THEN RAISE EXCEPTION ''invalid_invite''; END IF; IF public.team_channel_access(_team)');
  EXECUTE d;
END $$;
CREATE OR REPLACE FUNCTION public.accept_team_invite(_token text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE i team_invites; e text; s text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  SELECT * INTO i FROM team_invites WHERE token=upper(trim(_token)) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid_invite'; END IF;
  IF i.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'invite_revoked'; END IF;
  IF i.expires_at<=now() THEN RAISE EXCEPTION 'invite_expired'; END IF;
  IF i.accepted_at IS NOT NULL AND i.accepted_by IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'invite_used'; END IF;
  SELECT email INTO e FROM auth.users WHERE id=auth.uid() AND email_confirmed_at IS NOT NULL;
  IF e IS NULL OR lower(e) IS DISTINCT FROM lower(i.email) THEN RAISE EXCEPTION 'email_mismatch'; END IF;
  s:=public.request_team_membership(i.team_id,i.id);
  UPDATE team_invites SET accepted_at=coalesce(accepted_at,now()),accepted_by=auth.uid() WHERE id=i.id;
  RETURN jsonb_build_object('team_id',i.team_id,'status',s);
END $$;
REVOKE ALL ON FUNCTION public.accept_team_invite(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.accept_team_invite(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_team_invite(_code text) RETURNS TABLE(team_id uuid,team_name text,leader_name text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT t.id,t.name,p.full_name FROM teams t JOIN profiles p ON p.id=t.owner_id
  WHERE t.join_code=upper(trim(_code)) AND NOT EXISTS(SELECT 1 FROM team_suspensions s WHERE s.team_id=t.id) AND NOT EXISTS(SELECT 1 FROM user_suspensions s WHERE s.user_id=t.owner_id)
$$;
REVOKE ALL ON FUNCTION public.get_team_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_team_invite(text) TO anon,authenticated;

-- Parameterized eligibility remains callable by definer notification functions, never as an outsider probe.
DO $$ DECLARE d text; BEGIN
  SELECT pg_get_functiondef('public.team_channel_access(uuid,uuid)'::regprocedure) INTO d;
  d:=replace(d, 'SELECT _user IS NOT NULL', 'SELECT (current_user NOT IN (''authenticated'',''anon'') OR _user=auth.uid()) AND _user IS NOT NULL');
  -- SECURITY DEFINER would defeat current_user; use session role setting as the caller boundary instead.
  d:=replace(d, '(current_user NOT IN (''authenticated'',''anon'') OR _user=auth.uid())', '(coalesce(current_setting(''role'',true),''none'') NOT IN (''authenticated'',''anon'') OR _user=auth.uid())');
  -- Do not apply this change: internal definer notification fan-out inherits the caller role too.
  -- The arbitrary-user overload requires a separate service/internal helper migration; retain existing semantics here.
END $$;