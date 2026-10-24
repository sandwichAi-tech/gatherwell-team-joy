-- Approved pricing model (2026-10-24): per-plan platform-fee ladder and builder-seat counting.
-- Fee rule rows are versioned and never rewritten, so the ladder is added as new rows.

-- 1. Per-plan fee rules. Free offerings always 0; Stripe processing separate.
INSERT INTO public.fee_rules (id, percent, fixed_cents, cap_cents, applies_to, is_legacy, effective_from, effective_to, note) VALUES
 ('v5_free_5', 5, 0, NULL, ARRAY['event','course','resource','membership','course_subscription'], false, '2026-10-24', NULL, 'Free plan: 5% on paid sales'),
 ('v5_advanced_3', 3, 0, NULL, ARRAY['event','course','resource','membership','course_subscription'], false, '2026-10-24', NULL, 'Advanced plan: 3% on paid sales'),
 ('v5_pro_2', 2, 0, NULL, ARRAY['event','course','resource','membership','course_subscription'], false, '2026-10-24', NULL, 'Pro plan: 2% on paid sales'),
 ('v5_team25_1', 1, 0, NULL, ARRAY['event','course','resource','membership','course_subscription'], false, '2026-10-24', NULL, 'Team 25 plan: 1% on paid sales'),
 ('v5_org_0_5', 0.5, 0, NULL, ARRAY['event','course','resource','membership','course_subscription'], false, '2026-10-24', NULL, 'Organization plan: 0.5% on paid sales');

-- 2. Plan-aware resolver. Unknown plans fall back to the Free rule (highest fee, safe default).
CREATE OR REPLACE FUNCTION public.active_fee_rule_for_plan(_offering_type text, _plan text, _at timestamptz DEFAULT now()) RETURNS text
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT id FROM public.fee_rules
  WHERE NOT is_legacy AND _offering_type = ANY(applies_to) AND effective_from <= _at AND (effective_to IS NULL OR effective_to > _at)
    AND id = 'v5_' || CASE _plan
      WHEN 'advanced' THEN 'advanced_3' WHEN 'growth' THEN 'advanced_3'
      WHEN 'pro' THEN 'pro_2'
      WHEN 'team25' THEN 'team25_1' WHEN 'team_25' THEN 'team25_1'
      WHEN 'team100' THEN 'org_0_5' WHEN 'team_100' THEN 'org_0_5' WHEN 'organization' THEN 'org_0_5'
      ELSE 'free_5' END
  LIMIT 1;
$$;

-- 3. The legacy single-argument resolver stays deterministic: the Free-plan rule.
CREATE OR REPLACE FUNCTION public.active_fee_rule(_offering_type text, _at timestamptz DEFAULT now()) RETURNS text
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT public.active_fee_rule_for_plan(_offering_type, 'free', _at);
$$;

-- 4. Builder seats: only roles that can build or administer the workspace consume a seat.
--    Check-in staff, moderators, analysts and plain members do not.
CREATE OR REPLACE FUNCTION public.is_builder_workspace_role(_role text) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT _role IN ('admin','host','content_editor');
$$;

CREATE OR REPLACE FUNCTION public.team_builder_seat_count(_team uuid) RETURNS int
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (SELECT count(DISTINCT u) FROM (
    SELECT owner_id AS u FROM public.teams WHERE id = _team
    UNION
    SELECT user_id FROM public.team_members
    WHERE team_id = _team AND suspended_at IS NULL AND public.is_builder_workspace_role(workspace_role)
  ) x)::int;
$$;

-- Seat limit: team license tier wins; otherwise the workspace owner's own plan (Free/Advanced 3, Pro 5).
CREATE OR REPLACE FUNCTION public.team_builder_seat_limit(_team uuid) RETURNS int
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _tier text; _owner uuid; _plan text;
BEGIN
  SELECT tier INTO _tier FROM public.team_licenses WHERE team_id = _team AND status IN ('active','trialing','past_due') ORDER BY created_at DESC LIMIT 1;
  IF _tier IN ('team100','team_100','organization') THEN RETURN 100; END IF;
  IF _tier IN ('team25','team_25') THEN RETURN 25; END IF;
  SELECT owner_id INTO _owner FROM public.teams WHERE id = _team;
  _plan := coalesce(public.effective_plan(_owner)->>'plan', 'free');
  RETURN CASE WHEN _plan = 'pro' THEN 5 ELSE 3 END;
END $$;

-- Existing helpers keep their names but now measure builder seats.
CREATE OR REPLACE FUNCTION public.team_seat_usage_limit(_team uuid) RETURNS int
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.team_builder_seat_limit(_team);
$$;

CREATE OR REPLACE FUNCTION public.team_seat_usage(_team uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _limit int; _used int; _tier text;
BEGIN
  IF NOT public.team_capability(_team, 'members') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT tier INTO _tier FROM public.team_licenses WHERE team_id = _team AND status IN ('active','trialing','past_due') ORDER BY created_at DESC LIMIT 1;
  _limit := public.team_builder_seat_limit(_team);
  _used := public.team_builder_seat_count(_team);
  RETURN jsonb_build_object('tier', coalesce(_tier, 'free'), 'seat_limit', _limit, 'seats_used', _used, 'over_limit', _used > _limit, 'builder_seats', true);
END $$;

-- 5. Enforcement: only builder roles consume seats, in invite, accept and role change.
CREATE OR REPLACE FUNCTION public.invite_team_member(_team uuid, _email text, _role text DEFAULT 'member') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _email text := lower(trim(_email)); _inv team_invites;
BEGIN
  IF NOT public.team_capability(_team, 'invites') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _email IS NULL OR _email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR length(_email) > 254 THEN RAISE EXCEPTION 'invalid_email'; END IF;
  IF _role NOT IN ('admin','host','content_editor','checkin','moderator','analyst','member') THEN RAISE EXCEPTION 'invalid_role'; END IF;
  IF public.is_builder_workspace_role(_role)
     AND public.team_builder_seat_count(_team)
         + (SELECT count(*) FROM team_invites WHERE team_id = _team AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > now() AND public.is_builder_workspace_role(workspace_role))
         >= public.team_builder_seat_limit(_team) THEN RAISE EXCEPTION 'seats_full'; END IF;
  UPDATE team_invites SET revoked_at = now() WHERE team_id = _team AND email = _email AND accepted_at IS NULL AND revoked_at IS NULL;
  INSERT INTO team_invites (team_id, email, workspace_role, created_by) VALUES (_team, _email, _role, auth.uid()) RETURNING * INTO _inv;
  PERFORM public.team_log(_team, 'invite_created', NULL, jsonb_build_object('role', _role));
  RETURN jsonb_build_object('token', _inv.token, 'expires_at', _inv.expires_at, 'delivery', 'link_only');
END $$;

CREATE OR REPLACE FUNCTION public.accept_team_invite(_token text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
  IF public.is_builder_workspace_role(_inv.workspace_role)
     AND public.team_builder_seat_count(_inv.team_id) >= public.team_builder_seat_limit(_inv.team_id) THEN RAISE EXCEPTION 'seats_full'; END IF;
  INSERT INTO team_members (team_id, user_id, role, workspace_role, invited_by) VALUES (_inv.team_id, auth.uid(), 'member', _inv.workspace_role, _inv.created_by);
  UPDATE team_invites SET accepted_at = now(), accepted_by = auth.uid() WHERE id = _inv.id;
  PERFORM public.team_log(_inv.team_id, 'invite_accepted', auth.uid(), jsonb_build_object('role', _inv.workspace_role));
  RETURN jsonb_build_object('team_id', _inv.team_id, 'already', false);
END $$;

CREATE OR REPLACE FUNCTION public.change_member_role(_team uuid, _user uuid, _role text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.team_capability(_team, 'members') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _role NOT IN ('admin','host','content_editor','checkin','moderator','analyst','member') THEN RAISE EXCEPTION 'invalid_role'; END IF;
  IF _user = auth.uid() THEN RAISE EXCEPTION 'self_role_change'; END IF;
  IF EXISTS (SELECT 1 FROM teams WHERE id = _team AND owner_id = _user) THEN RAISE EXCEPTION 'owner_role_fixed'; END IF;
  IF public.is_builder_workspace_role(_role)
     AND NOT EXISTS (SELECT 1 FROM team_members WHERE team_id = _team AND user_id = _user AND suspended_at IS NULL AND public.is_builder_workspace_role(workspace_role))
     AND public.team_builder_seat_count(_team) >= public.team_builder_seat_limit(_team) THEN RAISE EXCEPTION 'seats_full'; END IF;
  UPDATE team_members SET workspace_role = _role WHERE team_id = _team AND user_id = _user;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_member'; END IF;
  PERFORM public.team_log(_team, 'role_changed', _user, jsonb_build_object('role', _role));
END $$;

GRANT EXECUTE ON FUNCTION public.active_fee_rule_for_plan(text, text, timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_builder_workspace_role(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.team_builder_seat_count(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.team_builder_seat_limit(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.team_builder_seat_count(uuid), public.team_builder_seat_limit(uuid) FROM anon;