
-- 1. Workspace roles + suspension on team_members (legacy role column untouched)
ALTER TABLE public.team_members
  ADD COLUMN workspace_role text NOT NULL DEFAULT 'member',
  ADD COLUMN suspended_at timestamptz;

UPDATE public.team_members SET workspace_role = CASE role WHEN 'leader' THEN 'admin' WHEN 'host' THEN 'host' ELSE 'member' END;

CREATE OR REPLACE FUNCTION public.guard_workspace_role() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.workspace_role NOT IN ('owner','admin','host','content_editor','checkin','moderator','analyst','member') THEN RAISE EXCEPTION 'invalid_role'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER team_members_workspace_role BEFORE INSERT OR UPDATE ON public.team_members FOR EACH ROW EXECUTE FUNCTION public.guard_workspace_role();

-- 2. Centralized capability check: owner comes from teams.owner_id, others from workspace_role
CREATE OR REPLACE FUNCTION public.team_capability(_team uuid, _cap text) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _role text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM teams WHERE id = _team AND owner_id = auth.uid()) THEN RETURN true; END IF;
  SELECT workspace_role INTO _role FROM team_members WHERE team_id = _team AND user_id = auth.uid() AND suspended_at IS NULL;
  IF _role IS NULL THEN RETURN false; END IF;
  RETURN CASE _role
    WHEN 'admin' THEN _cap IN ('members','settings','content','billing_view','events','invites','audit','assign','moderate','analytics')
    WHEN 'host' THEN _cap IN ('events','content')
    WHEN 'content_editor' THEN _cap IN ('content')
    WHEN 'checkin' THEN _cap IN ('checkin')
    WHEN 'moderator' THEN _cap IN ('moderate')
    WHEN 'analyst' THEN _cap IN ('analytics')
    ELSE false END;
END $$;
GRANT EXECUTE ON FUNCTION public.team_capability(uuid, text) TO authenticated;

-- 3. Team invites: opaque one-use tokens, RPC-only access
CREATE TABLE public.team_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  email text NOT NULL,
  workspace_role text NOT NULL DEFAULT 'member',
  token text NOT NULL UNIQUE DEFAULT upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
  accepted_at timestamptz,
  accepted_by uuid,
  revoked_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.team_invites TO service_role;
ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;

-- 4. Team audit log: owner/admin read, RPC-only writes
CREATE TABLE public.team_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  actor uuid,
  action text NOT NULL,
  target uuid,
  meta jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.team_audit TO authenticated;
GRANT ALL ON public.team_audit TO service_role;
ALTER TABLE public.team_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners and admins read team audit" ON public.team_audit FOR SELECT TO authenticated USING (public.team_capability(team_id, 'audit'));

CREATE OR REPLACE FUNCTION public.team_log(_team uuid, _action text, _target uuid DEFAULT NULL, _meta jsonb DEFAULT '{}') RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO team_audit (team_id, actor, action, target, meta) VALUES (_team, auth.uid(), _action, _target, _meta - 'token' - 'email_body' - 'waiver' - 'payment');
END $$;

-- 5. Seat limit helper (no capability check; used inside accept)
CREATE OR REPLACE FUNCTION public.team_seat_usage_limit(_team uuid) RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE coalesce((SELECT tier FROM team_licenses WHERE team_id = _team AND status IN ('active','trialing','past_due') ORDER BY created_at DESC LIMIT 1), 'free')
    WHEN 'team100' THEN 100 WHEN 'team25' THEN 25 WHEN 'team_100' THEN 100 WHEN 'team_25' THEN 25 ELSE 1 END
$$;

-- 6. Seat usage vs the team's real entitlement
CREATE OR REPLACE FUNCTION public.team_seat_usage(_team uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _limit int; _used int; _tier text;
BEGIN
  IF NOT public.team_capability(_team, 'members') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT tier INTO _tier FROM team_licenses WHERE team_id = _team AND status IN ('active','trialing','past_due') ORDER BY created_at DESC LIMIT 1;
  _limit := public.team_seat_usage_limit(_team);
  SELECT count(*) INTO _used FROM team_members WHERE team_id = _team AND suspended_at IS NULL;
  RETURN jsonb_build_object('tier', coalesce(_tier, 'free'), 'seat_limit', _limit, 'seats_used', _used, 'over_limit', _used > _limit);
END $$;
GRANT EXECUTE ON FUNCTION public.team_seat_usage(uuid) TO authenticated;

-- 7. Invite by exact email: no account enumeration, seat enforcement, audit
CREATE OR REPLACE FUNCTION public.invite_team_member(_team uuid, _email text, _role text DEFAULT 'member') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _email text := lower(trim(_email)); _inv team_invites; _usage jsonb;
BEGIN
  IF NOT public.team_capability(_team, 'invites') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _email IS NULL OR _email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR length(_email) > 254 THEN RAISE EXCEPTION 'invalid_email'; END IF;
  IF _role NOT IN ('admin','host','content_editor','checkin','moderator','analyst','member') THEN RAISE EXCEPTION 'invalid_role'; END IF;
  _usage := public.team_seat_usage(_team);
  IF (_usage->>'seats_used')::int + (SELECT count(*) FROM team_invites WHERE team_id = _team AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > now()) >= (_usage->>'seat_limit')::int THEN RAISE EXCEPTION 'seats_full'; END IF;
  UPDATE team_invites SET revoked_at = now() WHERE team_id = _team AND email = _email AND accepted_at IS NULL AND revoked_at IS NULL;
  INSERT INTO team_invites (team_id, email, workspace_role, created_by) VALUES (_team, _email, _role, auth.uid()) RETURNING * INTO _inv;
  PERFORM public.team_log(_team, 'invite_created', NULL, jsonb_build_object('role', _role));
  RETURN jsonb_build_object('token', _inv.token, 'expires_at', _inv.expires_at, 'delivery', 'link_only');
END $$;
GRANT EXECUTE ON FUNCTION public.invite_team_member(uuid, text, text) TO authenticated;

-- 8. Accept: matching verified email, adult attested, one-use, not expired/revoked, seat check
CREATE OR REPLACE FUNCTION public.accept_team_invite(_token text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _inv team_invites; _email text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  SELECT * INTO _inv FROM team_invites WHERE token = upper(trim(_token));
  IF _inv.id IS NULL THEN RAISE EXCEPTION 'invalid_invite'; END IF;
  IF _inv.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'invite_revoked'; END IF;
  IF _inv.accepted_at IS NOT NULL THEN
    IF _inv.accepted_by = auth.uid() THEN RETURN jsonb_build_object('team_id', _inv.team_id, 'already', true); END IF;
    RAISE EXCEPTION 'invite_used';
  END IF;
  IF _inv.expires_at < now() THEN RAISE EXCEPTION 'invite_expired'; END IF;
  SELECT email INTO _email FROM auth.users WHERE id = auth.uid();
  IF lower(_email) IS DISTINCT FROM _inv.email THEN RAISE EXCEPTION 'email_mismatch'; END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND adult_confirmed_at IS NOT NULL) THEN RAISE EXCEPTION 'adult_required'; END IF;
  IF EXISTS (SELECT 1 FROM team_members WHERE team_id = _inv.team_id AND user_id = auth.uid()) THEN RAISE EXCEPTION 'already_member'; END IF;
  IF (SELECT count(*) FROM team_members WHERE team_id = _inv.team_id AND suspended_at IS NULL) >= public.team_seat_usage_limit(_inv.team_id) THEN RAISE EXCEPTION 'seats_full'; END IF;
  INSERT INTO team_members (team_id, user_id, role, workspace_role, invited_by) VALUES (_inv.team_id, auth.uid(), 'member', _inv.workspace_role, _inv.created_by);
  UPDATE team_invites SET accepted_at = now(), accepted_by = auth.uid() WHERE id = _inv.id;
  PERFORM public.team_log(_inv.team_id, 'invite_accepted', auth.uid(), jsonb_build_object('role', _inv.workspace_role));
  RETURN jsonb_build_object('team_id', _inv.team_id, 'already', false);
END $$;
GRANT EXECUTE ON FUNCTION public.accept_team_invite(text) TO authenticated;

-- 9. List invites (owner/admin only)
CREATE OR REPLACE FUNCTION public.team_invites_list(_team uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.team_capability(_team, 'invites') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'email', i.email, 'role', i.workspace_role, 'expires_at', i.expires_at,
    'state', CASE WHEN i.revoked_at IS NOT NULL THEN 'revoked' WHEN i.accepted_at IS NOT NULL THEN 'accepted' WHEN i.expires_at < now() THEN 'expired' ELSE 'pending' END,
    'created_at', i.created_at) ORDER BY i.created_at DESC), '[]'::jsonb)
    FROM team_invites i WHERE i.team_id = _team);
END $$;
GRANT EXECUTE ON FUNCTION public.team_invites_list(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.revoke_team_invite(_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _inv team_invites;
BEGIN
  SELECT * INTO _inv FROM team_invites WHERE id = _id;
  IF _inv.id IS NULL THEN RAISE EXCEPTION 'invalid_invite'; END IF;
  IF NOT public.team_capability(_inv.team_id, 'invites') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE team_invites SET revoked_at = now() WHERE id = _id AND accepted_at IS NULL;
  PERFORM public.team_log(_inv.team_id, 'invite_revoked', NULL, '{}');
END $$;
GRANT EXECUTE ON FUNCTION public.revoke_team_invite(uuid) TO authenticated;

-- 10. Role change, suspend/reactivate, remove, transfer, leave
CREATE OR REPLACE FUNCTION public.change_member_role(_team uuid, _user uuid, _role text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.team_capability(_team, 'members') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _role NOT IN ('admin','host','content_editor','checkin','moderator','analyst','member') THEN RAISE EXCEPTION 'invalid_role'; END IF;
  IF _user = auth.uid() THEN RAISE EXCEPTION 'self_role_change'; END IF;
  IF EXISTS (SELECT 1 FROM teams WHERE id = _team AND owner_id = _user) THEN RAISE EXCEPTION 'owner_role_fixed'; END IF;
  UPDATE team_members SET workspace_role = _role WHERE team_id = _team AND user_id = _user;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_member'; END IF;
  PERFORM public.team_log(_team, 'role_changed', _user, jsonb_build_object('role', _role));
END $$;
GRANT EXECUTE ON FUNCTION public.change_member_role(uuid, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_member_suspension(_team uuid, _user uuid, _suspend boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.team_capability(_team, 'members') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF EXISTS (SELECT 1 FROM teams WHERE id = _team AND owner_id = _user) THEN RAISE EXCEPTION 'owner_role_fixed'; END IF;
  UPDATE team_members SET workspace_role = CASE WHEN _suspend THEN now() ELSE NULL END WHERE team_id = _team AND user_id = _user;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_member'; END IF;
  PERFORM public.team_log(_team, CASE WHEN _suspend THEN 'member_suspended' ELSE 'member_reactivated' END, _user, '{}');
END $$;
GRANT EXECUTE ON FUNCTION public.set_member_suspension(uuid, uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.remove_member(_team uuid, _user uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.team_capability(_team, 'members') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF EXISTS (SELECT 1 FROM teams WHERE id = _team AND owner_id = _user) THEN RAISE EXCEPTION 'owner_role_fixed'; END IF;
  DELETE FROM team_members WHERE team_id = _team AND user_id = _user;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_member'; END IF;
  PERFORM public.team_log(_team, 'member_removed', _user, '{}');
END $$;
GRANT EXECUTE ON FUNCTION public.remove_member(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.transfer_ownership(_team uuid, _new_owner uuid, _confirm text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _name text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM teams WHERE id = _team AND owner_id = auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT name INTO _name FROM teams WHERE id = _team;
  IF _confirm IS DISTINCT FROM _name THEN RAISE EXCEPTION 'confirm_mismatch'; END IF;
  IF NOT EXISTS (SELECT 1 FROM team_members WHERE team_id = _team AND user_id = _new_owner AND suspended_at IS NULL) THEN RAISE EXCEPTION 'not_member'; END IF;
  UPDATE teams SET owner_id = _new_owner WHERE id = _team;
  UPDATE team_members SET workspace_role = 'admin' WHERE team_id = _team AND user_id = auth.uid();
  UPDATE team_members SET workspace_role = 'owner' WHERE team_id = _team AND user_id = _new_owner;
  PERFORM public.team_log(_team, 'ownership_transferred', _new_owner, '{}');
END $$;
GRANT EXECUTE ON FUNCTION public.transfer_ownership(uuid, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.leave_team(_team uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF EXISTS (SELECT 1 FROM teams WHERE id = _team AND owner_id = auth.uid()) THEN RAISE EXCEPTION 'sole_owner'; END IF;
  DELETE FROM team_members WHERE team_id = _team AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'not_member'; END IF;
  PERFORM public.team_log(_team, 'member_left', auth.uid(), '{}');
END $$;
GRANT EXECUTE ON FUNCTION public.leave_team(uuid) TO authenticated;

-- 11. Activity feed for the UI
CREATE OR REPLACE FUNCTION public.team_activity(_team uuid, _limit int DEFAULT 50) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.team_capability(_team, 'audit') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('action', a.action, 'actor', p.full_name, 'target', tp.full_name, 'at', a.created_at, 'meta', a.meta) ORDER BY a.created_at DESC), '[]'::jsonb)
    FROM (SELECT * FROM team_audit WHERE team_id = _team ORDER BY created_at DESC LIMIT least(_limit, 100)) a
    LEFT JOIN profiles p ON p.id = a.actor LEFT JOIN profiles tp ON tp.id = a.target);
END $$;
GRANT EXECUTE ON FUNCTION public.team_activity(uuid, int) TO authenticated;
