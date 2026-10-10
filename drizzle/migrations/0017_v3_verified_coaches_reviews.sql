CREATE TABLE public.coach_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  identity_path text NOT NULL,
  years_experience int CHECK (years_experience IS NULL OR years_experience BETWEEN 0 AND 70),
  credentials jsonb NOT NULL DEFAULT '[]'::jsonb,
  review_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX coach_verifications_user ON public.coach_verifications(user_id, created_at DESC);
CREATE UNIQUE INDEX coach_verifications_one_pending ON public.coach_verifications(user_id) WHERE status = 'pending';
GRANT SELECT ON public.coach_verifications TO authenticated;
GRANT ALL ON public.coach_verifications TO service_role;
ALTER TABLE public.coach_verifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own verification requests" ON public.coach_verifications FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.is_verified_coach(_user uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM coach_verifications WHERE user_id = _user AND status = 'approved')
$$;
GRANT EXECUTE ON FUNCTION public.is_verified_coach(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.verified_hosts(_ids uuid[]) RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT user_id FROM coach_verifications WHERE status = 'approved' AND user_id = ANY(_ids[1:200])
$$;
GRANT EXECUTE ON FUNCTION public.verified_hosts(uuid[]) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.submit_verification(_identity text, _years int, _credentials jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid; c jsonb; _clean jsonb := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF _identity IS NULL OR _identity NOT LIKE auth.uid()::text || '/verify-%' THEN RAISE EXCEPTION 'identity_required'; END IF;
  IF jsonb_typeof(coalesce(_credentials,'[]')) <> 'array' OR jsonb_array_length(coalesce(_credentials,'[]')) > 8 THEN RAISE EXCEPTION 'invalid_credentials'; END IF;
  FOR c IN SELECT * FROM jsonb_array_elements(coalesce(_credentials,'[]')) LOOP
    IF coalesce(c->>'kind','') NOT IN ('certification','license') OR length(trim(coalesce(c->>'title',''))) NOT BETWEEN 2 AND 100
      OR length(coalesce(c->>'issuer','')) > 100 THEN RAISE EXCEPTION 'invalid_credentials'; END IF;
    IF public.has_blocked_claim(c->>'title') OR public.has_blocked_claim(coalesce(c->>'issuer','')) THEN RAISE EXCEPTION 'blocked_claim'; END IF;
    IF c->>'doc_path' IS NOT NULL AND c->>'doc_path' NOT LIKE auth.uid()::text || '/verify-%' THEN RAISE EXCEPTION 'invalid_credentials'; END IF;
    _clean := _clean || jsonb_build_object('kind', c->>'kind', 'title', trim(c->>'title'), 'issuer', nullif(trim(coalesce(c->>'issuer','')),''), 'doc_path', c->>'doc_path');
  END LOOP;
  IF EXISTS (SELECT 1 FROM coach_verifications WHERE user_id = auth.uid() AND status = 'pending') THEN RAISE EXCEPTION 'already_pending'; END IF;
  INSERT INTO coach_verifications(user_id, identity_path, years_experience, credentials) VALUES (auth.uid(), _identity, _years, _clean) RETURNING id INTO _id;
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.submit_verification(text,int,jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.submit_verification(text,int,jsonb) TO authenticated;

CREATE TABLE public.coach_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL,
  author_id uuid NOT NULL,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body text CHECK (body IS NULL OR length(body) <= 500),
  hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (host_id, author_id)
);
CREATE INDEX coach_reviews_host ON public.coach_reviews(host_id, created_at DESC);
GRANT SELECT ON public.coach_reviews TO authenticated;
GRANT ALL ON public.coach_reviews TO service_role;
ALTER TABLE public.coach_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own reviews" ON public.coach_reviews FOR SELECT TO authenticated USING (author_id = auth.uid());

CREATE OR REPLACE FUNCTION public.can_review_coach(_host uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND _host <> auth.uid() AND (
    EXISTS (SELECT 1 FROM rsvps r JOIN events e ON e.id = r.event_id WHERE e.host_id = _host AND r.checked_in_at IS NOT NULL
      AND (r.user_id = auth.uid() OR lower(r.guest_email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))))
    OR EXISTS (SELECT 1 FROM offer_purchases op JOIN offers o ON o.id = op.offer_id WHERE o.host_id = _host AND op.user_id = auth.uid() AND op.status IN ('active','paid','past_due','canceled')))
$$;
GRANT EXECUTE ON FUNCTION public.can_review_coach(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.save_coach_review(_host uuid, _rating int, _body text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.can_review_coach(_host) THEN RAISE EXCEPTION 'not_eligible'; END IF;
  IF _rating NOT BETWEEN 1 AND 5 THEN RAISE EXCEPTION 'invalid_rating'; END IF;
  _body := nullif(trim(coalesce(_body,'')),'');
  IF length(_body) > 500 THEN RAISE EXCEPTION 'too_long'; END IF;
  IF _body IS NOT NULL AND public.has_blocked_claim(_body) THEN RAISE EXCEPTION 'blocked_claim'; END IF;
  INSERT INTO coach_reviews(host_id, author_id, rating, body) VALUES (_host, auth.uid(), _rating, _body)
  ON CONFLICT (host_id, author_id) DO UPDATE SET rating = excluded.rating, body = excluded.body, created_at = now();
END $$;
REVOKE ALL ON FUNCTION public.save_coach_review(uuid,int,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.save_coach_review(uuid,int,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_my_coach_review(_host uuid) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM coach_reviews WHERE host_id = _host AND author_id = auth.uid()
$$;
REVOKE ALL ON FUNCTION public.delete_my_coach_review(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_coach_review(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.coach_trust(_host uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH v AS (SELECT * FROM coach_verifications WHERE user_id = _host AND status = 'approved' ORDER BY reviewed_at DESC NULLS LAST LIMIT 1),
  pub AS (SELECT * FROM events WHERE host_id = _host AND status = 'published' AND starts_at <= now()),
  reg AS (SELECT 1 FROM rsvps r JOIN events e ON e.id = r.event_id WHERE e.host_id = _host AND r.checked_in_at IS NOT NULL
          GROUP BY coalesce(r.user_id::text, lower(r.guest_email), r.guest_phone) HAVING count(*) >= 3),
  rv AS (SELECT * FROM coach_reviews WHERE host_id = _host AND NOT hidden)
  SELECT jsonb_build_object(
    'verified', EXISTS (SELECT 1 FROM v),
    'verified_at', (SELECT reviewed_at FROM v),
    'years_experience', (SELECT years_experience FROM v),
    'credentials', coalesce((SELECT jsonb_agg(jsonb_build_object('kind', c->>'kind', 'title', c->>'title', 'issuer', c->>'issuer')) FROM v, jsonb_array_elements(v.credentials) c), '[]'::jsonb),
    'hosting_since', (SELECT min(starts_at) FROM pub),
    'hosted', (SELECT count(*) FROM pub),
    'regulars', (SELECT count(*) FROM reg),
    'rating', (SELECT round(avg(rating)::numeric, 1) FROM rv),
    'reviews_count', (SELECT count(*) FROM rv),
    'reviews', coalesce((SELECT jsonb_agg(x ORDER BY x->>'created_at' DESC) FROM (
       SELECT jsonb_build_object('id', rv.id, 'rating', rv.rating, 'body', rv.body, 'created_at', rv.created_at, 'name', split_part(coalesce(p.full_name,''),' ',1), 'avatar_url', p.avatar_url) x
       FROM rv LEFT JOIN profiles p ON p.id = rv.author_id ORDER BY rv.created_at DESC LIMIT 20) s), '[]'::jsonb),
    'can_review', public.can_review_coach(_host),
    'my_review', (SELECT jsonb_build_object('rating', rating, 'body', body) FROM coach_reviews WHERE host_id = _host AND author_id = auth.uid()))
$$;
GRANT EXECUTE ON FUNCTION public.coach_trust(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_public_event(_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE e record; _host jsonb; _team text; _initials jsonb; _used int; _mine text; _co jsonb;
BEGIN
  SELECT * INTO e FROM public.events WHERE id = _id AND status IN ('published','cancelled')
    AND (visibility = 'public' OR (visibility = 'invite' AND current_setting('gw.invite', true) = _id::text) OR public.is_team_member(team_id, ARRAY['leader','host','member']));
  IF e IS NULL THEN RETURN NULL; END IF;
  SELECT jsonb_build_object('name', p.full_name, 'avatar_url', p.avatar_url, 'verified', public.is_verified_coach(p.id)) INTO _host FROM public.profiles p WHERE p.id = e.host_id;
  SELECT coalesce(jsonb_agg(jsonb_build_object('name', p.full_name, 'avatar_url', p.avatar_url) ORDER BY c.created_at), '[]'::jsonb) INTO _co
    FROM public.event_cohosts c JOIN public.profiles p ON p.id = c.user_id WHERE c.event_id = _id;
  SELECT name INTO _team FROM public.teams WHERE id = e.team_id;
  _used := public.event_seats_used(_id);
  IF NOT e.hide_guest_list THEN
    SELECT coalesce(jsonb_agg(i), '[]'::jsonb) INTO _initials FROM (
      SELECT upper(left(coalesce(r.guest_name, p.full_name, '?'),1) ||
        coalesce(left(nullif(split_part(trim(coalesce(r.guest_name, p.full_name, '')), ' ', 2),''),1),'')) AS i
      FROM public.rsvps r LEFT JOIN public.profiles p ON p.id = r.user_id
      WHERE r.event_id = _id AND r.status = 'going' ORDER BY r.created_at LIMIT 8) s;
  END IF;
  IF auth.uid() IS NOT NULL THEN
    SELECT checkin_code INTO _mine FROM public.rsvps WHERE event_id = _id AND user_id = auth.uid() AND status <> 'cancelled' LIMIT 1;
  END IF;
  RETURN jsonb_build_object('id', e.id, 'title', e.title, 'description_en', e.description_en, 'description_es', e.description_es,
    'cover_url', e.cover_url, 'cover_style', e.cover_style, 'starts_at', e.starts_at, 'ends_at', e.ends_at, 'timezone', e.timezone,
    'location_name', e.location_name, 'address', e.address, 'meeting_note', e.meeting_note, 'lat', e.lat, 'lng', e.lng,
    'is_online', e.online_url IS NOT NULL AND e.location_name IS NULL AND e.address IS NULL, 'has_online', e.online_url IS NOT NULL,
    'capacity', e.capacity, 'status', e.status, 'hide_guest_list', e.hide_guest_list, 'going', _used, 'initials', _initials,
    'host', _host, 'cohosts', _co, 'team_name', _team, 'my_code', _mine, 'questions', e.rsvp_questions, 'require_approval', e.require_approval, 'visibility', e.visibility,
    'team_registration', e.team_registration, 'team_min', e.team_min, 'team_max', e.team_max, 'team_price_mode', e.team_price_mode);
END; $function$;