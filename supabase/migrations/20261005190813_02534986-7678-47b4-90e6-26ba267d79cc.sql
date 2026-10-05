
CREATE TABLE public.billing_accounts (
  user_id uuid PRIMARY KEY,
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free','growth','pro')),
  billing_period text CHECK (billing_period IN ('month','year')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','past_due','canceled','trialing')),
  renews_at timestamptz,
  stripe_customer_id text UNIQUE,
  stripe_subscription_id text UNIQUE,
  connect_account_id text UNIQUE,
  connect_status text NOT NULL DEFAULT 'not_started' CHECK (connect_status IN ('not_started','pending','active')),
  pass_fee boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.billing_accounts TO authenticated;
GRANT ALL ON public.billing_accounts TO service_role;
ALTER TABLE public.billing_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own billing readable" ON public.billing_accounts FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.team_licenses (
  team_id uuid PRIMARY KEY REFERENCES public.teams(id) ON DELETE CASCADE,
  leader_id uuid NOT NULL,
  tier text NOT NULL CHECK (tier IN ('team25','team100')),
  seats integer NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','past_due','canceled')),
  is_preview boolean NOT NULL DEFAULT false,
  renews_at timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.team_licenses TO authenticated;
GRANT ALL ON public.team_licenses TO service_role;
ALTER TABLE public.team_licenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team can read license" ON public.team_licenses FOR SELECT TO authenticated USING (public.is_team_member(team_id, NULL));

CREATE TABLE public.license_seats (
  team_id uuid NOT NULL REFERENCES public.team_licenses(team_id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  assigned_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, user_id)
);
GRANT SELECT ON public.license_seats TO authenticated;
GRANT ALL ON public.license_seats TO service_role;
ALTER TABLE public.license_seats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Seat holder or leader reads seats" ON public.license_seats FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_team_member(team_id, ARRAY['leader']));

ALTER TABLE public.events ADD COLUMN price_cents integer CHECK (price_cents IS NULL OR (price_cents >= 100 AND price_cents <= 100000)),
  ADD COLUMN pass_fee boolean NOT NULL DEFAULT false;

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('gathering','challenge')),
  event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  challenge_id uuid REFERENCES public.challenges(id) ON DELETE SET NULL,
  rsvp_id uuid REFERENCES public.rsvps(id) ON DELETE SET NULL,
  host_id uuid NOT NULL,
  buyer_name text,
  buyer_email text,
  amount_cents integer NOT NULL,
  fee_cents integer NOT NULL DEFAULT 0,
  booking_fee_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'usd',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','refunded')),
  stripe_session_id text UNIQUE,
  stripe_payment_intent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Hosts read own sales" ON public.payments FOR SELECT TO authenticated USING (host_id = auth.uid());

CREATE TABLE public.stripe_events (
  id text PRIMARY KEY,
  type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.stripe_events TO service_role;
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER billing_accounts_updated BEFORE UPDATE ON public.billing_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER team_licenses_updated BEFORE UPDATE ON public.team_licenses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER payments_updated BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Effective plan: own subscription or a Team License seat, whichever is higher
CREATE OR REPLACE FUNCTION public.effective_plan(_uid uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE b record; s record;
BEGIN
  SELECT * INTO b FROM billing_accounts WHERE user_id = _uid;
  IF FOUND AND b.plan <> 'free' AND b.status IN ('active','past_due','trialing') THEN
    RETURN jsonb_build_object('plan', b.plan, 'source', 'own');
  END IF;
  SELECT l.team_id, t.name AS team_name, p.full_name AS leader_name INTO s
  FROM license_seats ls JOIN team_licenses l ON l.team_id = ls.team_id AND l.status IN ('active','past_due')
  JOIN teams t ON t.id = l.team_id LEFT JOIN profiles p ON p.id = l.leader_id
  WHERE ls.user_id = _uid LIMIT 1;
  IF FOUND THEN RETURN jsonb_build_object('plan', 'growth', 'source', 'license', 'leader', s.leader_name, 'team', s.team_name); END IF;
  RETURN jsonb_build_object('plan', 'free', 'source', 'own');
END; $$;
REVOKE EXECUTE ON FUNCTION public.effective_plan(uuid) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.plan_limits(_plan text)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE _plan
    WHEN 'pro' THEN '{"gatherings":null,"guests":null,"storage_mb":102400,"assistant":2000,"fee_pct":2}'::jsonb
    WHEN 'growth' THEN '{"gatherings":null,"guests":150,"storage_mb":10240,"assistant":500,"fee_pct":4}'::jsonb
    ELSE '{"gatherings":4,"guests":30,"storage_mb":500,"assistant":50,"fee_pct":8}'::jsonb END;
$$;

CREATE OR REPLACE FUNCTION public.gatherings_this_month(_uid uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(DISTINCT coalesce(series_id, id))::int FROM events
  WHERE host_id = _uid AND created_at >= date_trunc('month', now()) AND status <> 'cancelled';
$$;
REVOKE EXECUTE ON FUNCTION public.gatherings_this_month(uuid) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.storage_used_bytes(_uid uuid)
RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, storage AS $$
  SELECT coalesce(sum((metadata->>'size')::bigint), 0) FROM storage.objects WHERE owner_id = _uid::text;
$$;
REVOKE EXECUTE ON FUNCTION public.storage_used_bytes(uuid) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.my_plan_status()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); ep jsonb; lim jsonb; b record; _largest int; _ai int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_signed_in'; END IF;
  ep := effective_plan(_uid); lim := plan_limits(ep->>'plan');
  SELECT * INTO b FROM billing_accounts WHERE user_id = _uid;
  SELECT coalesce(max(event_seats_used(id)), 0) INTO _largest FROM events
    WHERE host_id = _uid AND status = 'published' AND coalesce(ends_at, starts_at) >= now();
  SELECT count(*)::int INTO _ai FROM ai_usage WHERE user_id = _uid AND created_at >= date_trunc('month', now());
  RETURN ep || jsonb_build_object('limits', lim,
    'own_plan', coalesce(b.plan, 'free'), 'billing_period', b.billing_period, 'status', coalesce(b.status, 'active'),
    'renews_at', b.renews_at, 'has_customer', b.stripe_customer_id IS NOT NULL,
    'connect_status', coalesce(b.connect_status, 'not_started'), 'pass_fee', coalesce(b.pass_fee, false),
    'usage', jsonb_build_object('gatherings', gatherings_this_month(_uid), 'largest_guests', _largest,
      'storage_bytes', storage_used_bytes(_uid), 'assistant', _ai));
END; $$;
REVOKE EXECUTE ON FUNCTION public.my_plan_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_plan_status() TO authenticated;

CREATE OR REPLACE FUNCTION public.storage_allows(_bytes bigint)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _mb int;
BEGIN
  IF _uid IS NULL THEN RETURN false; END IF;
  _mb := (plan_limits(effective_plan(_uid)->>'plan')->>'storage_mb')::int;
  RETURN storage_used_bytes(_uid) + greatest(_bytes, 0) <= _mb::bigint * 1024 * 1024;
END; $$;
REVOKE EXECUTE ON FUNCTION public.storage_allows(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.storage_allows(bigint) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_pass_fee(_on boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_signed_in'; END IF;
  INSERT INTO billing_accounts (user_id, pass_fee) VALUES (auth.uid(), coalesce(_on,false))
  ON CONFLICT (user_id) DO UPDATE SET pass_fee = EXCLUDED.pass_fee;
END; $$;
REVOKE EXECUTE ON FUNCTION public.set_pass_fee(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_pass_fee(boolean) TO authenticated;

-- Limit only NEW gatherings (a weekly series counts once)
CREATE OR REPLACE FUNCTION public.enforce_gathering_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _max int;
BEGIN
  IF coalesce(auth.jwt()->>'role','') = 'service_role' THEN RETURN NEW; END IF;
  IF NEW.series_id IS NOT NULL AND EXISTS (SELECT 1 FROM events WHERE series_id = NEW.series_id) THEN RETURN NEW; END IF;
  _max := (plan_limits(effective_plan(NEW.host_id)->>'plan')->>'gatherings')::int;
  IF _max IS NOT NULL AND gatherings_this_month(NEW.host_id) >= _max THEN RAISE EXCEPTION 'plan_limit_gatherings'; END IF;
  IF NEW.price_cents IS NOT NULL AND NOT EXISTS (SELECT 1 FROM billing_accounts WHERE user_id = NEW.host_id AND connect_status = 'active') THEN
    NEW.price_cents := NULL;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER events_plan_limit BEFORE INSERT ON public.events FOR EACH ROW EXECUTE FUNCTION public.enforce_gathering_limit();

CREATE OR REPLACE FUNCTION public.guest_cap(_event uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN (plan_limits(effective_plan(e.host_id)->>'plan')->>'guests') IS NULL THEN e.capacity
    ELSE least(coalesce(e.capacity, 100000), (plan_limits(effective_plan(e.host_id)->>'plan')->>'guests')::int) END
  FROM events e WHERE e.id = _event;
$$;
REVOKE EXECUTE ON FUNCTION public.guest_cap(uuid) FROM PUBLIC, anon;

-- Public price info for the guest page
CREATE OR REPLACE FUNCTION public.event_price(_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN e.price_cents IS NULL THEN NULL ELSE jsonb_build_object('price_cents', e.price_cents, 'pass_fee', e.pass_fee,
    'fee_pct', (plan_limits(effective_plan(e.host_id)->>'plan')->>'fee_pct')::int) END
  FROM events e WHERE e.id = _id AND e.status = 'published' AND (e.visibility = 'public' OR public.can_view_event(e.id));
$$;
GRANT EXECUTE ON FUNCTION public.event_price(uuid) TO anon, authenticated;

-- Seats
CREATE OR REPLACE FUNCTION public.assign_license_seat(_team uuid, _user uuid, _on boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l record;
BEGIN
  IF NOT is_team_member(_team, ARRAY['leader']) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO l FROM team_licenses WHERE team_id = _team AND status IN ('active','past_due');
  IF NOT FOUND THEN RAISE EXCEPTION 'no_license'; END IF;
  IF NOT _on THEN DELETE FROM license_seats WHERE team_id = _team AND user_id = _user; RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM team_members WHERE team_id = _team AND user_id = _user) THEN RAISE EXCEPTION 'not_member'; END IF;
  IF (SELECT count(*) FROM license_seats WHERE team_id = _team) >= l.seats THEN RAISE EXCEPTION 'seats_full'; END IF;
  INSERT INTO license_seats (team_id, user_id, assigned_by) VALUES (_team, _user, auth.uid()) ON CONFLICT DO NOTHING;
END; $$;
REVOKE EXECUTE ON FUNCTION public.assign_license_seat(uuid, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_license_seat(uuid, uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_grant_preview_license(_team uuid, _tier text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _owner uuid;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _tier NOT IN ('team25','team100') THEN RAISE EXCEPTION 'invalid_tier'; END IF;
  SELECT owner_id INTO _owner FROM teams WHERE id = _team;
  IF _owner IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  INSERT INTO team_licenses (team_id, leader_id, tier, seats, is_preview)
  VALUES (_team, _owner, _tier, CASE _tier WHEN 'team25' THEN 25 ELSE 100 END, true)
  ON CONFLICT (team_id) DO UPDATE SET tier = EXCLUDED.tier, seats = EXCLUDED.seats, status = 'active';
END; $$;
REVOKE EXECUTE ON FUNCTION public.admin_grant_preview_license(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_grant_preview_license(uuid, text) TO authenticated;

-- Assistant quota follows the effective plan
CREATE OR REPLACE FUNCTION public.ai_usage_status()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _plan text; _used int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_signed_in'; END IF;
  _plan := effective_plan(_uid)->>'plan';
  SELECT count(*)::int INTO _used FROM ai_usage WHERE user_id = _uid AND created_at >= date_trunc('month', now());
  RETURN jsonb_build_object('plan', _plan, 'used', _used, 'limit', (plan_limits(_plan)->>'assistant')::int);
END; $$;

-- RSVP: plan guest cap -> waitlist; paid gatherings only via the payment webhook
CREATE OR REPLACE FUNCTION public.rsvp_event(_event_id uuid, _first text, _last text, _phone text, _email text, _language text, _plus_ones integer, _status text, _sms boolean, _mail boolean)
 RETURNS TABLE(code text, status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE e record; _name text; _uid uuid := auth.uid(); _st text; _id uuid; _code text;
  _ex_id uuid; _ex_status text; _ex_plus int; _held int := 0; _ip text; _ph text; _cap int; _svc boolean;
BEGIN
  _svc := coalesce(auth.jwt()->>'role','') = 'service_role';
  _name := trim(coalesce(_first,'') || ' ' || coalesce(_last,''));
  IF coalesce(trim(_first),'') = '' OR length(_name) > 120 THEN RAISE EXCEPTION 'name_required'; END IF;
  IF nullif(trim(_phone),'') IS NULL AND nullif(trim(_email),'') IS NULL THEN RAISE EXCEPTION 'contact_required'; END IF;
  IF length(coalesce(_phone,'')) > 30 OR length(coalesce(_email,'')) > 200 THEN RAISE EXCEPTION 'too_long'; END IF;
  IF nullif(trim(_email),'') IS NOT NULL AND trim(_email) !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'invalid_email'; END IF;
  IF _status NOT IN ('going','maybe') THEN RAISE EXCEPTION 'invalid_status'; END IF;
  IF NOT _svc THEN
    _ip := 'ip:' || trim(split_part(coalesce(current_setting('request.headers', true)::json->>'x-forwarded-for', 'unknown'), ',', 1));
    _ph := 'phone:' || regexp_replace(coalesce(_phone,''), '\D', '', 'g');
    DELETE FROM public.rsvp_attempts WHERE created_at < now() - interval '1 day';
    IF (SELECT count(*) FROM public.rsvp_attempts WHERE key = _ip AND created_at > now() - interval '1 minute') >= 10
       OR (_ph <> 'phone:' AND (SELECT count(*) FROM public.rsvp_attempts WHERE key = _ph AND created_at > now() - interval '1 minute') >= 10) THEN
      RAISE EXCEPTION 'rate_limited';
    END IF;
  END IF;
  SELECT * INTO e FROM public.events WHERE id = _event_id FOR UPDATE;
  IF NOT FOUND OR e.status <> 'published' OR NOT (_svc OR e.visibility = 'public' OR (_uid IS NOT NULL AND public.can_rsvp_event(_event_id))) THEN
    RAISE EXCEPTION 'not_open';
  END IF;
  IF e.price_cents IS NOT NULL AND NOT _svc AND _status = 'going' THEN RAISE EXCEPTION 'payment_required'; END IF;
  _plus_ones := greatest(0, least(coalesce(_plus_ones,0), 3));
  _st := _status;
  IF _uid IS NOT NULL THEN
    SELECT r.id, r.status, r.plus_ones INTO _ex_id, _ex_status, _ex_plus FROM public.rsvps r WHERE r.event_id = _event_id AND r.user_id = _uid LIMIT 1;
  END IF;
  IF _ex_id IS NOT NULL AND _ex_status = 'going' THEN _held := 1 + _ex_plus; END IF;
  _cap := public.guest_cap(_event_id);
  IF _st = 'going' AND NOT (_svc AND e.price_cents IS NOT NULL) AND _cap IS NOT NULL AND public.event_seats_used(_event_id) - _held + 1 + _plus_ones > _cap THEN
    _st := 'waitlist';
  END IF;
  IF _ex_id IS NOT NULL THEN
    UPDATE public.rsvps r SET guest_name = _name, guest_phone = nullif(trim(_phone),''), guest_email = nullif(trim(_email),''),
      language = CASE WHEN _language = 'es' THEN 'es' ELSE 'en' END, plus_ones = _plus_ones, status = _st,
      sms_opt_in = coalesce(_sms,false), email_opt_in = coalesce(_mail,false)
    WHERE r.id = _ex_id RETURNING r.id, r.checkin_code INTO _id, _code;
  ELSE
    INSERT INTO public.rsvps (event_id, user_id, guest_name, guest_phone, guest_email, language, plus_ones, status, sms_opt_in, email_opt_in)
    VALUES (_event_id, _uid, _name, nullif(trim(_phone),''), nullif(trim(_email),''), CASE WHEN _language = 'es' THEN 'es' ELSE 'en' END,
      _plus_ones, _st, coalesce(_sms,false), coalesce(_mail,false))
    RETURNING rsvps.id, rsvps.checkin_code INTO _id, _code;
  END IF;
  IF NOT _svc THEN
    INSERT INTO public.rsvp_attempts (key) VALUES (_ip);
    IF _ph <> 'phone:' THEN INSERT INTO public.rsvp_attempts (key) VALUES (_ph); END IF;
  END IF;
  PERFORM public.queue_rsvp_notices(_id, CASE WHEN _st = 'waitlist' THEN 'rsvp_waitlisted' ELSE 'rsvp_confirmed' END);
  RETURN QUERY SELECT _code, _st;
END; $function$;
