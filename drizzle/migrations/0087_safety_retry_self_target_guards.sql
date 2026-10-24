DO $$ DECLARE d text; BEGIN
 SELECT pg_get_functiondef('public.admin_safety_action(text,uuid,text,text,uuid)'::regprocedure) INTO d;
 d:=replace(d,'IF _user IS NULL OR NOT EXISTS','IF _user=auth.uid() THEN RAISE EXCEPTION ''self''; END IF; IF _user IS NULL OR NOT EXISTS');
 d:=replace(d,'THEN RAISE EXCEPTION ''already_suspended''; END IF;','THEN RETURN; END IF;');
 d:=replace(d,'IF s.id IS NULL OR s.revoked_at IS NOT NULL THEN RAISE EXCEPTION ''not_suspended''; END IF;','IF s.id IS NULL THEN RAISE EXCEPTION ''not_found''; END IF; IF s.revoked_at IS NOT NULL THEN RETURN; END IF;');
 d:=replace(d,'ELSE DELETE FROM team_suspensions WHERE team_id=_id; IF NOT FOUND THEN RAISE EXCEPTION ''not_suspended''; END IF; END IF;','ELSE DELETE FROM team_suspensions WHERE team_id=_id; IF NOT FOUND THEN RETURN; END IF; END IF;');
 d:=replace(d,'IF _action=''suspend'' THEN INSERT INTO team_suspensions','IF _action=''suspend'' AND EXISTS(SELECT 1 FROM team_suspensions WHERE team_id=_id) THEN RETURN; END IF; IF _action=''suspend'' THEN INSERT INTO team_suspensions');
 EXECUTE d;
END $$;