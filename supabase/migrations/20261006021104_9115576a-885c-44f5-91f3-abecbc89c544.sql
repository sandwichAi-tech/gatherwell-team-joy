CREATE TABLE public.welcome_invites (
  code text PRIMARY KEY,
  user_id uuid UNIQUE,
  guest_key text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((user_id IS NULL) <> (guest_key IS NULL))
);
CREATE TABLE public.welcome_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL REFERENCES public.welcome_invites(code) ON DELETE CASCADE,
  rsvp_id uuid NOT NULL UNIQUE REFERENCES public.rsvps(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  host_id uuid NOT NULL,
  friend_name text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','earned')),
  points integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  earned_at timestamptz
);
CREATE TABLE public.welcome_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL DEFAULT auth.uid(),
  title_en text NOT NULL DEFAULT '', title_es text NOT NULL DEFAULT '',
  points_cost integer NOT NULL CHECK (points_cost BETWEEN 10 AND 1000),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (length(title_en) <= 80 AND length(title_es) <= 80 AND (title_en <> '' OR title_es <> ''))
);
CREATE TABLE public.welcome_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  invite_code text NOT NULL REFERENCES public.welcome_invites(code) ON DELETE CASCADE,
  reward_id uuid REFERENCES public.welcome_rewards(id) ON DELETE SET NULL,
  host_id uuid NOT NULL,
  title text NOT NULL,
  points integer NOT NULL,
  status text NOT NULL DEFAULT 'issued' CHECK (status IN ('issued','honored')),
  created_at timestamptz NOT NULL DEFAULT now(),
  honored_at timestamptz
);
GRANT SELECT ON public.welcome_invites, public.welcome_referrals, public.welcome_redemptions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.welcome_rewards TO authenticated;
GRANT ALL ON public.welcome_invites, public.welcome_referrals, public.welcome_rewards, public.welcome_redemptions TO service_role;
ALTER TABLE public.welcome_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.welcome_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.welcome_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.welcome_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own invite" ON public.welcome_invites FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Inviter sees own referrals" ON public.welcome_referrals FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.welcome_invites i WHERE i.code = welcome_referrals.code AND i.user_id = auth.uid()));
CREATE POLICY "Signed-in read active rewards, host all own" ON public.welcome_rewards FOR SELECT TO authenticated USING (active OR host_id = auth.uid());
CREATE POLICY "Hosts add rewards" ON public.welcome_rewards FOR INSERT TO authenticated WITH CHECK (host_id = auth.uid() AND public.is_host_anywhere(auth.uid()));
CREATE POLICY "Hosts edit rewards" ON public.welcome_rewards FOR UPDATE TO authenticated USING (host_id = auth.uid()) WITH CHECK (host_id = auth.uid());
CREATE POLICY "Hosts delete rewards" ON public.welcome_rewards FOR DELETE TO authenticated USING (host_id = auth.uid());
CREATE POLICY "Holder or host reads redemptions" ON public.welcome_redemptions FOR SELECT TO authenticated
  USING (host_id = auth.uid() OR EXISTS (SELECT 1 FROM public.welcome_invites i WHERE i.code = invite_code AND i.user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.welcome_new_code() RETURNS text LANGUAGE sql VOLATILE SET search_path = public AS $$
  SELECT upper(substr(translate(replace(gen_random_uuid()::text, '-', ''), '01', ''), 1, 8));
$$;

CREATE OR REPLACE FUNCTION public.guest_key_of(_email text, _phone text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN nullif(trim(_email),'') IS NOT NULL THEN 'e:' || lower(trim(_email))
              WHEN nullif(regexp_replace(coalesce(_phone,''), '\D', '', 'g'),'') IS NOT NULL THEN 'p:' || regexp_replace(_phone, '\D', '', 'g') END;
$$;

-- Personal code for the signed-in person (created on first use)
CREATE OR REPLACE FUNCTION public.my_invite_code() RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_signed_in'; END IF;
  SELECT code INTO c FROM public.welcome_invites WHERE user_id = auth.uid();
  IF c IS NULL THEN
    LOOP c := public.welcome_new_code(); BEGIN INSERT INTO public.welcome_invites(code, user_id) VALUES (c, auth.uid()); EXIT; EXCEPTION WHEN unique_violation THEN IF EXISTS (SELECT 1 FROM public.welcome_invites WHERE user_id = auth.uid()) THEN SELECT code INTO c FROM public.welcome_invites WHERE user_id = auth.uid(); EXIT; END IF; END; END LOOP;
  END IF;
  RETURN c;
END $$;

CREATE OR REPLACE FUNCTION public.guest_invite_code_for(_checkin text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; k text; c text;
BEGIN
  SELECT * INTO r FROM public.rsvps WHERE checkin_code = _checkin;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF r.user_id IS NOT NULL THEN
    SELECT code INTO c FROM public.welcome_invites WHERE user_id = r.user_id;
    IF c IS NULL THEN LOOP c := public.welcome_new_code(); BEGIN INSERT INTO public.welcome_invites(code, user_id) VALUES (c, r.user_id); EXIT; EXCEPTION WHEN unique_violation THEN NULL; END; END LOOP; END IF;
    RETURN c;
  END IF;
  k := public.guest_key_of(r.guest_email, r.guest_phone);
  IF k IS NULL THEN RETURN NULL; END IF;
  SELECT code INTO c FROM public.welcome_invites WHERE guest_key = k;
  IF c IS NULL THEN LOOP c := public.welcome_new_code(); BEGIN INSERT INTO public.welcome_invites(code, guest_key) VALUES (c, k); EXIT; EXCEPTION WHEN unique_violation THEN IF EXISTS (SELECT 1 FROM public.welcome_invites WHERE guest_key = k) THEN SELECT code INTO c FROM public.welcome_invites WHERE guest_key = k; EXIT; END IF; END; END LOOP; END IF;
  RETURN c;
END $$;

-- Called right after a friend's RSVP (best effort). The friend's RSVP code proves the RSVP is theirs.
CREATE OR REPLACE FUNCTION public.record_welcome_invite(_rsvp_code text, _invite text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; i record; e record;
BEGIN
  SELECT * INTO r FROM public.rsvps WHERE checkin_code = _rsvp_code AND created_at > now() - interval '15 minutes';
  IF NOT FOUND THEN RETURN; END IF;
  SELECT * INTO i FROM public.welcome_invites WHERE code = upper(trim(_invite));
  IF NOT FOUND THEN RETURN; END IF;
  -- no self-invites
  IF (i.user_id IS NOT NULL AND i.user_id = r.user_id) OR (i.guest_key IS NOT NULL AND i.guest_key = public.guest_key_of(r.guest_email, r.guest_phone)) THEN RETURN; END IF;
  SELECT id, host_id INTO e FROM public.events WHERE id = r.event_id;
  IF i.user_id IS NOT NULL AND i.user_id = e.host_id THEN RETURN; END IF;
  INSERT INTO public.welcome_referrals(code, rsvp_id, event_id, host_id, friend_name)
  VALUES (i.code, r.id, r.event_id, e.host_id, split_part(coalesce(r.guest_name, ''), ' ', 1))
  ON CONFLICT (rsvp_id) DO NOTHING;
END $$;

-- Points are earned only at the friend's first-ever check-in
CREATE OR REPLACE FUNCTION public.welcome_on_checkin() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE k text;
BEGIN
  IF NEW.checked_in_at IS NULL OR OLD.checked_in_at IS NOT NULL THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.welcome_referrals WHERE rsvp_id = NEW.id AND status = 'pending') THEN RETURN NEW; END IF;
  k := public.guest_key_of(NEW.guest_email, NEW.guest_phone);
  IF EXISTS (SELECT 1 FROM public.rsvps x WHERE x.id <> NEW.id AND x.checked_in_at IS NOT NULL
      AND ((NEW.user_id IS NOT NULL AND x.user_id = NEW.user_id) OR (k IS NOT NULL AND public.guest_key_of(x.guest_email, x.guest_phone) = k))) THEN
    RETURN NEW; -- not a first-timer
  END IF;
  UPDATE public.welcome_referrals SET status = 'earned', points = 10, earned_at = now() WHERE rsvp_id = NEW.id AND status = 'pending';
  RETURN NEW;
END $$;
CREATE TRIGGER rsvps_welcome_checkin AFTER UPDATE OF checked_in_at ON public.rsvps FOR EACH ROW EXECUTE FUNCTION public.welcome_on_checkin();

-- Shared summary for an invite code
CREATE OR REPLACE FUNCTION public.welcome_summary(_code text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH bal AS (
    SELECT host_id, sum(points)::int AS earned FROM public.welcome_referrals WHERE code = _code AND status = 'earned' GROUP BY host_id
  ), spent AS (
    SELECT host_id, sum(points)::int AS spent FROM public.welcome_redemptions WHERE invite_code = _code GROUP BY host_id
  ), hosts AS (
    SELECT b.host_id, b.earned - coalesce(s.spent, 0) AS points, b.earned FROM bal b LEFT JOIN spent s USING (host_id)
  )
  SELECT jsonb_build_object(
    'code', _code,
    'friends', coalesce((SELECT jsonb_agg(jsonb_build_object('name', f.friend_name, 'status', f.status, 'title', ev.title, 'at', f.created_at) ORDER BY f.created_at DESC)
       FROM (SELECT * FROM public.welcome_referrals WHERE code = _code ORDER BY created_at DESC LIMIT 50) f JOIN public.events ev ON ev.id = f.event_id), '[]'::jsonb),
    'hosts', coalesce((SELECT jsonb_agg(jsonb_build_object('host_id', h.host_id, 'host_name', coalesce(p.full_name, ''), 'points', h.points, 'earned', h.earned,
        'rewards', coalesce((SELECT jsonb_agg(jsonb_build_object('id', w.id, 'title_en', w.title_en, 'title_es', w.title_es, 'cost', w.points_cost) ORDER BY w.points_cost)
                             FROM public.welcome_rewards w WHERE w.host_id = h.host_id AND w.active), '[]'::jsonb)))
       FROM hosts h LEFT JOIN public.profiles p ON p.id = h.host_id), '[]'::jsonb),
    'redemptions', coalesce((SELECT jsonb_agg(jsonb_build_object('code', d.code, 'title', d.title, 'points', d.points, 'status', d.status, 'at', d.created_at, 'host_name', coalesce(p.full_name, '')) ORDER BY d.created_at DESC)
       FROM public.welcome_redemptions d LEFT JOIN public.profiles p ON p.id = d.host_id WHERE d.invite_code = _code), '[]'::jsonb));
$$;

CREATE OR REPLACE FUNCTION public.my_welcome() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN RETURN public.welcome_summary(public.my_invite_code()); END $$;

CREATE OR REPLACE FUNCTION public.guest_welcome(_checkin text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c text;
BEGIN c := public.guest_invite_code_for(_checkin); IF c IS NULL THEN RETURN NULL; END IF; RETURN public.welcome_summary(c); END $$;

CREATE OR REPLACE FUNCTION public.welcome_redeem_for(_code text, _reward uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w record; bal int; out text;
BEGIN
  SELECT * INTO w FROM public.welcome_rewards WHERE id = _reward AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('welcome:' || _code));
  SELECT coalesce((SELECT sum(points) FROM public.welcome_referrals WHERE code = _code AND host_id = w.host_id AND status = 'earned'), 0)
       - coalesce((SELECT sum(points) FROM public.welcome_redemptions WHERE invite_code = _code AND host_id = w.host_id), 0) INTO bal;
  IF bal < w.points_cost THEN RAISE EXCEPTION 'not_enough_points'; END IF;
  LOOP out := 'GW-' || public.welcome_new_code(); BEGIN
    INSERT INTO public.welcome_redemptions(code, invite_code, reward_id, host_id, title, points)
    VALUES (out, _code, w.id, w.host_id, coalesce(nullif(w.title_en, ''), w.title_es), w.points_cost); EXIT;
  EXCEPTION WHEN unique_violation THEN NULL; END; END LOOP;
  RETURN out;
END $$;

CREATE OR REPLACE FUNCTION public.redeem_welcome_reward(_reward uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN RETURN public.welcome_redeem_for(public.my_invite_code(), _reward); END $$;

CREATE OR REPLACE FUNCTION public.guest_redeem_welcome(_checkin text, _reward uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c text;
BEGIN c := public.guest_invite_code_for(_checkin); IF c IS NULL THEN RAISE EXCEPTION 'not_found'; END IF; RETURN public.welcome_redeem_for(c, _reward); END $$;

CREATE OR REPLACE FUNCTION public.honor_welcome_code(_code text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d record;
BEGIN
  UPDATE public.welcome_redemptions SET status = 'honored', honored_at = now()
  WHERE code = upper(trim(_code)) AND host_id = auth.uid() AND status = 'issued' RETURNING * INTO d;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  RETURN jsonb_build_object('title', d.title, 'points', d.points);
END $$;

REVOKE ALL ON FUNCTION public.welcome_new_code(), public.guest_key_of(text, text), public.welcome_summary(text), public.welcome_redeem_for(text, uuid),
  public.guest_invite_code_for(text), public.welcome_on_checkin() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.my_invite_code(), public.my_welcome(), public.redeem_welcome_reward(uuid), public.honor_welcome_code(text),
  public.record_welcome_invite(text, text), public.guest_welcome(text), public.guest_redeem_welcome(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_invite_code(), public.my_welcome(), public.redeem_welcome_reward(uuid), public.honor_welcome_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_welcome_invite(text, text), public.guest_welcome(text), public.guest_redeem_welcome(text, uuid) TO anon, authenticated;