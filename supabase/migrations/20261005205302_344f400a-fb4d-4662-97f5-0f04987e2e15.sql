-- ===== Plan-limit waitlist =====
CREATE TABLE public.event_plan_waitlist (
  event_id uuid PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
  last_hit_at timestamptz NOT NULL DEFAULT now(),
  notified_at timestamptz
);
GRANT SELECT ON public.event_plan_waitlist TO authenticated;
GRANT ALL ON public.event_plan_waitlist TO service_role;
ALTER TABLE public.event_plan_waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Hosts read plan waitlist" ON public.event_plan_waitlist FOR SELECT TO authenticated USING (public.can_manage_event(event_id));

CREATE OR REPLACE FUNCTION public.note_plan_waitlist(_event uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e record; w record; _email text; _lang text; _waiting int;
BEGIN
  SELECT id, title, host_id, team_id INTO e FROM events WHERE id = _event;
  INSERT INTO event_plan_waitlist (event_id) VALUES (_event) ON CONFLICT (event_id) DO UPDATE SET last_hit_at = now();
  SELECT * INTO w FROM event_plan_waitlist WHERE event_id = _event;
  IF w.notified_at IS NULL OR w.notified_at < now() - interval '1 day' THEN
    SELECT u.email INTO _email FROM auth.users u WHERE u.id = e.host_id;
    SELECT language INTO _lang FROM profiles WHERE id = e.host_id;
    SELECT count(*)::int INTO _waiting FROM rsvps WHERE event_id = _event AND status = 'waitlist';
    IF _email IS NOT NULL THEN
      PERFORM enqueue_message('email', _email, coalesce(_lang,'en'), 'plan_waitlist', 'transactional',
        jsonb_build_object('title', e.title, 'event_id', e.id, 'waiting', _waiting), now(), e.id, NULL, e.host_id, e.team_id, NULL);
    END IF;
    UPDATE event_plan_waitlist SET notified_at = now() WHERE event_id = _event;
  END IF;
END; $$;
REVOKE EXECUTE ON FUNCTION public.note_plan_waitlist(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.rsvp_event(_event_id uuid, _first text, _last text, _phone text, _email text, _language text, _plus_ones integer, _status text, _sms boolean, _mail boolean)
 RETURNS TABLE(code text, status text)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE e record; _name text; _uid uuid := auth.uid(); _st text; _id uuid; _code text;
  _ex_id uuid; _ex_status text; _ex_plus int; _held int := 0; _ip text; _ph text; _cap int; _svc boolean; _plan_hit boolean := false;
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
    _plan_hit := e.capacity IS NULL OR public.event_seats_used(_event_id) - _held + 1 + _plus_ones <= e.capacity;
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
  IF _plan_hit THEN PERFORM public.note_plan_waitlist(_event_id); END IF;
  PERFORM public.queue_rsvp_notices(_id, CASE WHEN _st = 'waitlist' THEN 'rsvp_waitlisted' ELSE 'rsvp_confirmed' END);
  RETURN QUERY SELECT _code, _st;
END; $function$;

-- Free periods end on their date
CREATE OR REPLACE FUNCTION public.effective_plan(_uid uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE b record; s record;
BEGIN
  SELECT * INTO b FROM billing_accounts WHERE user_id = _uid;
  IF FOUND AND b.plan <> 'free' AND (b.status IN ('active','past_due') OR (b.status = 'trialing' AND (b.renews_at IS NULL OR b.renews_at > now()))) THEN
    RETURN jsonb_build_object('plan', b.plan, 'source', 'own');
  END IF;
  SELECT l.team_id, t.name AS team_name, p.full_name AS leader_name INTO s
  FROM license_seats ls JOIN team_licenses l ON l.team_id = ls.team_id AND l.status IN ('active','past_due')
  JOIN teams t ON t.id = l.team_id LEFT JOIN profiles p ON p.id = l.leader_id
  WHERE ls.user_id = _uid LIMIT 1;
  IF FOUND THEN RETURN jsonb_build_object('plan', 'growth', 'source', 'license', 'leader', s.leader_name, 'team', s.team_name); END IF;
  RETURN jsonb_build_object('plan', 'free', 'source', 'own');
END; $$;

-- ===== Admin data =====
CREATE TABLE public.admin_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text,
  before jsonb,
  after jsonb,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_audit TO authenticated;
GRANT ALL ON public.admin_audit TO service_role;
ALTER TABLE public.admin_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read audit" ON public.admin_audit FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX admin_audit_created ON public.admin_audit (created_at DESC);

CREATE TABLE public.team_suspensions (
  team_id uuid PRIMARY KEY REFERENCES public.teams(id) ON DELETE CASCADE,
  reason text NOT NULL,
  suspended_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.team_suspensions TO authenticated;
GRANT ALL ON public.team_suspensions TO service_role;
ALTER TABLE public.team_suspensions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members see team pause" ON public.team_suspensions FOR SELECT TO authenticated
  USING (public.is_team_member(team_id, ARRAY['leader','host','member']) OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.user_suspensions (
  user_id uuid PRIMARY KEY,
  reason text NOT NULL,
  suspended_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_suspensions TO authenticated;
GRANT ALL ON public.user_suspensions TO service_role;
ALTER TABLE public.user_suspensions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read suspensions" ON public.user_suspensions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.block_suspended_team_events()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF coalesce(auth.jwt()->>'role','') = 'service_role' THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM team_suspensions WHERE team_id = NEW.team_id) THEN RAISE EXCEPTION 'team_suspended'; END IF;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.block_suspended_team_events() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER block_suspended_team_events BEFORE INSERT ON public.events FOR EACH ROW EXECUTE FUNCTION public.block_suspended_team_events();

-- Reports / moderation
CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type text NOT NULL CHECK (target_type IN ('event','shoutout','photo','activity','announcement')),
  target_id uuid NOT NULL,
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  author_id uuid,
  reason text NOT NULL CHECK (reason IN ('inappropriate','spam','claim','other')),
  note text CHECK (note IS NULL OR length(note) <= 500),
  source text NOT NULL DEFAULT 'user' CHECK (source IN ('user','claims')),
  reporter_id uuid,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','approved','removed','edited')),
  resolution_note text,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read reports" ON public.reports FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX reports_status ON public.reports (status, created_at DESC);

CREATE OR REPLACE FUNCTION public.report_content(_type text, _id uuid, _reason text, _note text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _team uuid; _author uuid; _ok boolean := false; _ip text; _uid uuid := auth.uid(); _ev uuid;
BEGIN
  IF _reason NOT IN ('inappropriate','spam','claim','other') THEN RAISE EXCEPTION 'invalid_reason'; END IF;
  _ip := 'report:' || coalesce(_uid::text, trim(split_part(coalesce(current_setting('request.headers', true)::json->>'x-forwarded-for', 'unknown'), ',', 1)));
  IF (SELECT count(*) FROM rsvp_attempts WHERE key = _ip AND created_at > now() - interval '1 minute') >= 10 THEN RAISE EXCEPTION 'rate_limited'; END IF;
  IF _type = 'event' THEN
    SELECT team_id, host_id, (visibility = 'public' AND status IN ('published','cancelled')) OR (_uid IS NOT NULL AND can_view_event(id)) INTO _team, _author, _ok FROM events WHERE id = _id;
  ELSIF _type = 'photo' THEN
    SELECT e.team_id, p.uploaded_by, e.visibility = 'public' OR (_uid IS NOT NULL AND can_view_event(e.id)) INTO _team, _author, _ok
    FROM event_photos p JOIN events e ON e.id = p.event_id WHERE p.id = _id;
  ELSIF _type = 'shoutout' THEN
    SELECT team_id, from_user INTO _team, _author FROM shoutouts WHERE id = _id;
    _ok := _uid IS NOT NULL AND is_team_member(_team, ARRAY['leader','host','member']);
  ELSIF _type = 'activity' THEN
    SELECT team_id, actor_id INTO _team, _author FROM activity WHERE id = _id;
    _ok := _uid IS NOT NULL AND is_team_member(_team, ARRAY['leader','host','member']);
  ELSIF _type = 'announcement' THEN
    SELECT team_id, author_id INTO _team, _author FROM announcements WHERE id = _id;
    _ok := _uid IS NOT NULL AND is_team_member(_team, ARRAY['leader','host','member']);
  ELSE RAISE EXCEPTION 'invalid_type'; END IF;
  IF NOT coalesce(_ok, false) THEN RAISE EXCEPTION 'not_found'; END IF;
  INSERT INTO rsvp_attempts (key) VALUES (_ip);
  INSERT INTO reports (target_type, target_id, team_id, author_id, reason, note, reporter_id)
  VALUES (_type, _id, _team, _author, _reason, nullif(left(trim(coalesce(_note,'')), 500), ''), _uid);
  RETURN true;
END; $$;
REVOKE EXECUTE ON FUNCTION public.report_content(text, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.report_content(text, uuid, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.flag_claims()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _text text; _type text; _author uuid;
BEGIN
  IF TG_TABLE_NAME = 'events' THEN
    _text := coalesce(NEW.title,'') || ' ' || coalesce(NEW.description_en,'') || ' ' || coalesce(NEW.description_es,''); _type := 'event'; _author := NEW.host_id;
  ELSE
    _text := coalesce(NEW.body,''); _type := 'announcement'; _author := NEW.author_id;
  END IF;
  IF has_blocked_claim(_text) AND NOT EXISTS (SELECT 1 FROM reports WHERE target_id = NEW.id AND status = 'open') THEN
    INSERT INTO reports (target_type, target_id, team_id, author_id, reason, source) VALUES (_type, NEW.id, NEW.team_id, _author, 'claim', 'claims');
  END IF;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.flag_claims() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER flag_event_claims AFTER INSERT OR UPDATE OF title, description_en, description_es ON public.events FOR EACH ROW EXECUTE FUNCTION public.flag_claims();
CREATE TRIGGER flag_announcement_claims AFTER INSERT OR UPDATE OF body ON public.announcements FOR EACH ROW EXECUTE FUNCTION public.flag_claims();

-- Global library additions
ALTER TABLE public.templates ADD COLUMN sort_order integer NOT NULL DEFAULT 0;
ALTER TABLE public.recipes ADD COLUMN sort_order integer NOT NULL DEFAULT 0;
ALTER TABLE public.recipes ADD COLUMN is_published boolean NOT NULL DEFAULT true;

CREATE TABLE public.challenge_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_en text NOT NULL,
  title_es text NOT NULL,
  description_en text,
  description_es text,
  daily_prompt_en text,
  daily_prompt_es text,
  duration_days integer NOT NULL DEFAULT 21 CHECK (duration_days BETWEEN 3 AND 90),
  is_published boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.challenge_types TO authenticated;
GRANT ALL ON public.challenge_types TO service_role;
ALTER TABLE public.challenge_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in read published challenge types" ON public.challenge_types FOR SELECT TO authenticated USING (is_published OR public.has_role(auth.uid(), 'admin'));

-- Feature flags
CREATE TABLE public.feature_flags (
  key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  value text,
  description_en text NOT NULL DEFAULT '',
  description_es text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.feature_flags TO anon, authenticated;
GRANT ALL ON public.feature_flags TO service_role;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads flags" ON public.feature_flags FOR SELECT TO anon, authenticated USING (true);
INSERT INTO public.feature_flags (key, enabled, value, description_en, description_es) VALUES
('landing_headline', false, 'A', 'Front page headline. Off: visitors get a random headline. On: everyone sees the chosen one (A, B or C).', 'Titular de la página principal. Apagado: cada visitante ve uno al azar. Encendido: todos ven el elegido (A, B o C).'),
('landing_testimonials', true, NULL, 'Show approved testimonials on the front page.', 'Mostrar testimonios aprobados en la página principal.');

-- Broadcasts
CREATE TABLE public.broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audience text NOT NULL CHECK (audience IN ('leaders','members')),
  title_en text NOT NULL,
  title_es text NOT NULL,
  body_en text NOT NULL,
  body_es text NOT NULL,
  is_test boolean NOT NULL DEFAULT false,
  recipients integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.broadcasts TO authenticated;
GRANT ALL ON public.broadcasts TO service_role;
ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read broadcasts" ON public.broadcasts FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.broadcast_reads (
  broadcast_id uuid NOT NULL REFERENCES public.broadcasts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (broadcast_id, user_id)
);
GRANT SELECT, INSERT ON public.broadcast_reads TO authenticated;
GRANT ALL ON public.broadcast_reads TO service_role;
ALTER TABLE public.broadcast_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own reads" ON public.broadcast_reads FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Mark own read" ON public.broadcast_reads FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.my_broadcasts()
RETURNS TABLE(id uuid, title_en text, title_es text, body_en text, body_es text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT b.id, b.title_en, b.title_es, b.body_en, b.body_es, b.created_at FROM broadcasts b
  WHERE auth.uid() IS NOT NULL AND b.active AND b.created_at > now() - interval '30 days'
    AND (CASE WHEN b.is_test THEN b.created_by = auth.uid()
      WHEN b.audience = 'leaders' THEN EXISTS (SELECT 1 FROM team_members m WHERE m.user_id = auth.uid() AND m.role = 'leader')
      ELSE true END)
    AND NOT EXISTS (SELECT 1 FROM broadcast_reads r WHERE r.broadcast_id = b.id AND r.user_id = auth.uid())
  ORDER BY b.created_at DESC LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.my_broadcasts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_broadcasts() TO authenticated;

-- Queue broadcast emails (server only, after the admin check)
CREATE OR REPLACE FUNCTION public.queue_broadcast(_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b record; r record; _n int := 0;
BEGIN
  SELECT * INTO b FROM broadcasts WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  FOR r IN
    SELECT u.id, u.email, coalesce(p.language,'en') AS lang FROM auth.users u LEFT JOIN profiles p ON p.id = u.id
    WHERE u.email IS NOT NULL AND u.deleted_at IS NULL
      AND (CASE WHEN b.is_test THEN u.id = b.created_by
        WHEN b.audience = 'leaders' THEN EXISTS (SELECT 1 FROM team_members m WHERE m.user_id = u.id AND m.role = 'leader')
        ELSE EXISTS (SELECT 1 FROM team_members m WHERE m.user_id = u.id) END)
  LOOP
    PERFORM enqueue_message('email', r.email, r.lang, 'broadcast', 'announcements',
      jsonb_build_object('broadcast_id', b.id, 'title_en', b.title_en, 'title_es', b.title_es, 'body_en', b.body_en, 'body_es', b.body_es),
      now(), NULL, NULL, r.id, NULL, NULL);
    _n := _n + 1;
  END LOOP;
  UPDATE broadcasts SET recipients = _n WHERE id = _id;
  RETURN _n;
END; $$;
REVOKE EXECUTE ON FUNCTION public.queue_broadcast(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.queue_broadcast(uuid) TO service_role;

-- ===== Admin reads (admin-checked) =====
CREATE OR REPLACE FUNCTION public.admin_overview(_since timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _r jsonb;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT jsonb_build_object(
    'signups', (SELECT count(*) FROM auth.users WHERE created_at >= _since),
    'active_teams', (SELECT count(DISTINCT team_id) FROM activity WHERE created_at >= _since),
    'gatherings', (SELECT count(*) FROM events WHERE created_at >= _since),
    'rsvps', (SELECT count(*) FROM rsvps WHERE created_at >= _since),
    'checkins', (SELECT count(*) FROM rsvps WHERE checked_in_at >= _since),
    'ai_requests', (SELECT count(*) FROM ai_usage WHERE created_at >= _since),
    'ai_cost_cents', (SELECT coalesce(round(sum(input_tokens) * 0.0003 + sum(output_tokens) * 0.0015), 0) FROM ai_usage WHERE created_at >= _since),
    'messages', (SELECT coalesce(jsonb_object_agg(k, n), '{}'::jsonb) FROM (SELECT channel || ':' || CASE WHEN status IN ('pending','sending') THEN 'queued' ELSE status END AS k, count(*) AS n FROM notification_outbox WHERE created_at >= _since GROUP BY 1) m),
    'plans', (SELECT jsonb_build_object(
        'free', count(*) FILTER (WHERE pl = 'free'), 'growth', count(*) FILTER (WHERE pl = 'growth' AND src = 'own'),
        'pro', count(*) FILTER (WHERE pl = 'pro'), 'team', count(*) FILTER (WHERE src = 'license'))
      FROM (SELECT effective_plan(p.id)->>'plan' AS pl, effective_plan(p.id)->>'source' AS src FROM profiles p) x),
    'paid', (SELECT jsonb_build_object('growth_month', count(*) FILTER (WHERE plan = 'growth' AND billing_period = 'month' AND stripe_subscription_id IS NOT NULL),
        'growth_year', count(*) FILTER (WHERE plan = 'growth' AND billing_period = 'year' AND stripe_subscription_id IS NOT NULL),
        'pro_month', count(*) FILTER (WHERE plan = 'pro' AND billing_period = 'month' AND stripe_subscription_id IS NOT NULL),
        'pro_year', count(*) FILTER (WHERE plan = 'pro' AND billing_period = 'year' AND stripe_subscription_id IS NOT NULL))
      FROM billing_accounts WHERE status IN ('active','past_due')),
    'licenses', (SELECT jsonb_build_object('team25', count(*) FILTER (WHERE tier = 'team25'), 'team100', count(*) FILTER (WHERE tier = 'team100'))
      FROM team_licenses WHERE status IN ('active','past_due') AND NOT is_preview),
    'weeks', (SELECT jsonb_agg(jsonb_build_object('week', w,
        'signups', (SELECT count(*) FROM auth.users WHERE created_at >= w AND created_at < w + interval '7 days'),
        'checkins', (SELECT count(*) FROM rsvps WHERE checked_in_at >= w AND checked_in_at < w + interval '7 days')) ORDER BY w)
      FROM generate_series(date_trunc('week', now()) - interval '11 weeks', date_trunc('week', now()), interval '7 days') w)
  ) INTO _r;
  RETURN _r;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_teams(_q text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN (SELECT coalesce(jsonb_agg(row_to_json(x) ORDER BY x.last_activity DESC NULLS LAST), '[]'::jsonb) FROM (
    SELECT t.id, t.name, t.parent_team_id, t.created_at, p.full_name AS leader_name, t.owner_id,
      (SELECT count(*) FROM team_members m WHERE m.team_id = t.id) AS members,
      (SELECT count(*) FROM teams s WHERE s.parent_team_id = t.id) AS subteams,
      effective_plan(t.owner_id)->>'plan' AS plan,
      EXISTS (SELECT 1 FROM team_licenses l WHERE l.team_id = t.id AND l.status IN ('active','past_due')) AS licensed,
      (SELECT max(created_at) FROM activity a WHERE a.team_id = t.id) AS last_activity,
      (SELECT reason FROM team_suspensions s WHERE s.team_id = t.id) AS suspended
    FROM teams t LEFT JOIN profiles p ON p.id = t.owner_id
    WHERE coalesce(trim(_q),'') = '' OR t.name ILIKE '%' || trim(_q) || '%' OR p.full_name ILIKE '%' || trim(_q) || '%'
    LIMIT 100) x);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_team_detail(_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN jsonb_build_object(
    'team', (SELECT row_to_json(t) FROM (SELECT t.id, t.name, t.owner_id, t.created_at, p.full_name AS leader_name, effective_plan(t.owner_id) AS plan,
        (SELECT row_to_json(b) FROM (SELECT plan, status, renews_at FROM billing_accounts WHERE user_id = t.owner_id) b) AS billing,
        (SELECT row_to_json(l) FROM (SELECT tier, seats, status, is_preview FROM team_licenses WHERE team_id = t.id) l) AS license,
        (SELECT row_to_json(s) FROM (SELECT reason, created_at FROM team_suspensions WHERE team_id = t.id) s) AS suspension
      FROM teams t LEFT JOIN profiles p ON p.id = t.owner_id WHERE t.id = _id) t),
    'members', (SELECT coalesce(jsonb_agg(jsonb_build_object('user_id', m.user_id, 'name', p.full_name, 'role', m.role, 'joined_at', m.joined_at) ORDER BY m.joined_at), '[]'::jsonb)
      FROM team_members m LEFT JOIN profiles p ON p.id = m.user_id WHERE m.team_id = _id),
    'gatherings', (SELECT coalesce(jsonb_agg(row_to_json(e)), '[]'::jsonb) FROM (SELECT id, title, starts_at, status FROM events WHERE team_id = _id ORDER BY starts_at DESC LIMIT 20) e),
    'templates', (SELECT coalesce(jsonb_agg(row_to_json(x)), '[]'::jsonb) FROM (SELECT id, title, is_published, launches_count FROM templates WHERE team_id = _id ORDER BY created_at DESC LIMIT 20) x),
    'activity', (SELECT coalesce(jsonb_agg(row_to_json(a)), '[]'::jsonb) FROM (SELECT type, created_at FROM activity WHERE team_id = _id ORDER BY created_at DESC LIMIT 15) a)
  );
END; $$;

CREATE OR REPLACE FUNCTION public.admin_users(_q text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN (SELECT coalesce(jsonb_agg(row_to_json(x) ORDER BY x.created_at DESC), '[]'::jsonb) FROM (
    SELECT u.id, u.email, p.full_name, u.created_at, u.last_sign_in_at,
      effective_plan(u.id)->>'plan' AS plan,
      (SELECT reason FROM user_suspensions s WHERE s.user_id = u.id) AS suspended
    FROM auth.users u LEFT JOIN profiles p ON p.id = u.id
    WHERE coalesce(trim(_q),'') = '' OR u.email ILIKE '%' || trim(_q) || '%' OR p.full_name ILIKE '%' || trim(_q) || '%'
    ORDER BY u.created_at DESC LIMIT 100) x);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_user_detail(_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN (SELECT jsonb_build_object('id', u.id, 'email', u.email, 'full_name', p.full_name, 'created_at', u.created_at, 'last_sign_in_at', u.last_sign_in_at,
      'plan', effective_plan(u.id), 'is_admin', has_role(u.id, 'admin'),
      'suspension', (SELECT row_to_json(s) FROM (SELECT reason, created_at FROM user_suspensions WHERE user_id = u.id) s),
      'teams', (SELECT coalesce(jsonb_agg(jsonb_build_object('team_id', t.id, 'name', t.name, 'role', m.role)), '[]'::jsonb) FROM team_members m JOIN teams t ON t.id = m.team_id WHERE m.user_id = u.id))
    FROM auth.users u LEFT JOIN profiles p ON p.id = u.id WHERE u.id = _id);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_reports(_status text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN (SELECT coalesce(jsonb_agg(row_to_json(x) ORDER BY x.created_at DESC), '[]'::jsonb) FROM (
    SELECT r.id, r.target_type, r.target_id, r.reason, r.note, r.source, r.status, r.resolution_note, r.created_at,
      t.name AS team_name, pa.full_name AS author_name, (SELECT count(*) FROM reports r2 WHERE r2.target_id = r.target_id AND r2.status = 'open') AS open_count,
      CASE r.target_type
        WHEN 'event' THEN (SELECT jsonb_build_object('title', e.title, 'text', e.description_en, 'text_es', e.description_es) FROM events e WHERE e.id = r.target_id)
        WHEN 'shoutout' THEN (SELECT jsonb_build_object('text', s.message, 'photo', s.photo_path) FROM shoutouts s WHERE s.id = r.target_id)
        WHEN 'photo' THEN (SELECT jsonb_build_object('photo', ph.path, 'title', e.title) FROM event_photos ph JOIN events e ON e.id = ph.event_id WHERE ph.id = r.target_id)
        WHEN 'activity' THEN (SELECT jsonb_build_object('title', a.type, 'text', coalesce(a.payload->>'body', a.payload->>'title', a.payload->>'message')) FROM activity a WHERE a.id = r.target_id)
        WHEN 'announcement' THEN (SELECT jsonb_build_object('text', an.body) FROM announcements an WHERE an.id = r.target_id)
      END AS preview
    FROM reports r LEFT JOIN teams t ON t.id = r.team_id LEFT JOIN profiles pa ON pa.id = r.author_id
    WHERE (_status = 'open' AND r.status = 'open') OR (_status <> 'open' AND r.status <> 'open')
    LIMIT 200) x);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_broadcasts()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'audience', b.audience, 'title_en', b.title_en, 'title_es', b.title_es, 'is_test', b.is_test,
      'recipients', b.recipients, 'active', b.active, 'created_at', b.created_at,
      'counts', (SELECT coalesce(jsonb_object_agg(st, n), '{}'::jsonb) FROM (SELECT o.status AS st, count(*) AS n FROM notification_outbox o WHERE o.template = 'broadcast' AND o.payload->>'broadcast_id' = b.id::text GROUP BY 1) c),
      'seen', (SELECT count(*) FROM broadcast_reads r WHERE r.broadcast_id = b.id)) ORDER BY b.created_at DESC), '[]'::jsonb)
    FROM (SELECT * FROM broadcasts ORDER BY created_at DESC LIMIT 50) b);
END; $$;

REVOKE EXECUTE ON FUNCTION public.admin_overview(timestamptz), public.admin_teams(text), public.admin_team_detail(uuid), public.admin_users(text), public.admin_user_detail(uuid), public.admin_reports(text), public.admin_broadcasts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_overview(timestamptz), public.admin_teams(text), public.admin_team_detail(uuid), public.admin_users(text), public.admin_user_detail(uuid), public.admin_reports(text), public.admin_broadcasts() TO authenticated;