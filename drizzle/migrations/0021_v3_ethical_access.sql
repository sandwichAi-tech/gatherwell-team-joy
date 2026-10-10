ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS community_seats int CHECK (community_seats IS NULL OR community_seats BETWEEN 1 AND 100);
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS community_seats int CHECK (community_seats IS NULL OR community_seats BETWEEN 1 AND 100);
ALTER TABLE public.offer_purchases ADD COLUMN IF NOT EXISTS paused_until timestamptz;
ALTER TABLE public.offer_purchases ADD COLUMN IF NOT EXISTS community boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.has_offer_access(_offer uuid, _uid uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT _uid IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.offers o WHERE o.id = _offer AND o.host_id = _uid)
    OR EXISTS (SELECT 1 FROM public.offer_purchases p WHERE p.offer_id = _offer AND p.user_id = _uid
      AND (p.paused_until IS NULL OR p.paused_until <= now())
      AND (p.status = 'paid' OR (p.status IN ('active','past_due') AND (p.renews_at IS NULL OR p.renews_at > now() - interval '3 days')))));
$function$;

-- Claims guard now also blocks guaranteed results and fear-based pressure
CREATE OR REPLACE FUNCTION public.has_blocked_claim(_text text)
 RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $function$
  SELECT lower(coalesce(_text,'')) ~ '(weight|lbs?\M|pounds|kilos?\M|\mkg\M|slim|diet pill|fat burn|cure|cures|cured|heal(s|ed)?\M|disease|diabet|cancer|medic|prescription|detox|income|salary|paycheck|commission|earn(ed|ing|s)?\M|\$ ?[0-9]|[0-9]+ ?(usd|dollars|dólares|pesos)|make money|financial freedom|quit (your|my) job|six figures|passive|peso\M|bajar de peso|perder peso|adelgaz|libras|kilos|grasa|cura(r|do|ción)?\M|sana(r|do)?\M|enfermedad|medicina|medicament|ingreso|sueldo|salario|comisi[oó]n|ganar dinero|gan[eé] dinero|libertad financiera|dinero)'
      OR lower(coalesce(_text,'')) ~ '(guarantee|garantiz|last chance|or you.?ll (fail|regret|lose|never)|you will fail|before it.?s too late|don.?t miss out|act now|now or never|results in [0-9]+ days|change your life in [0-9]+|[uú]ltima oportunidad|antes de que sea tarde|no te lo pierdas|vas a fracasar|te vas a arrepentir|ahora o nunca|resultados en [0-9]+ d[ií]as)';
$function$;

CREATE TABLE public.community_seat_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('offer','event')),
  target_id uuid NOT NULL,
  host_id uuid NOT NULL,
  user_id uuid NOT NULL,
  note text CHECK (note IS NULL OR length(note) <= 500),
  pay_cents int NOT NULL DEFAULT 0 CHECK (pay_cents BETWEEN 0 AND 100000),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','declined')),
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, target_id, user_id)
);
CREATE INDEX community_seat_requests_host ON public.community_seat_requests(host_id, status);
GRANT SELECT ON public.community_seat_requests TO authenticated;
GRANT ALL ON public.community_seat_requests TO service_role;
ALTER TABLE public.community_seat_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own community requests" ON public.community_seat_requests FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.community_seat_info(_kind text, _target uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _seats int; _host uuid; _used int; _mine jsonb;
BEGIN
  IF _kind = 'offer' THEN SELECT community_seats, host_id INTO _seats, _host FROM offers WHERE id = _target AND status = 'published';
  ELSIF _kind = 'event' THEN SELECT community_seats, host_id INTO _seats, _host FROM events WHERE id = _target AND status = 'published';
  ELSE RETURN NULL; END IF;
  IF _seats IS NULL THEN RETURN NULL; END IF;
  SELECT count(*) INTO _used FROM community_seat_requests WHERE kind = _kind AND target_id = _target AND status = 'approved';
  IF auth.uid() IS NOT NULL THEN SELECT jsonb_build_object('status', status, 'pay_cents', pay_cents) INTO _mine FROM community_seat_requests WHERE kind = _kind AND target_id = _target AND user_id = auth.uid(); END IF;
  RETURN jsonb_build_object('available', _used < _seats, 'mine', _mine, 'is_host', _host = auth.uid());
END $$;
GRANT EXECUTE ON FUNCTION public.community_seat_info(text,uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.request_community_seat(_kind text, _target uuid, _note text, _pay_cents int) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _seats int; _host uuid; _title text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_signed_in'; END IF;
  IF _kind = 'offer' THEN SELECT community_seats, host_id, title_en INTO _seats, _host, _title FROM offers WHERE id = _target AND status = 'published';
  ELSIF _kind = 'event' THEN SELECT community_seats, host_id, title INTO _seats, _host, _title FROM events WHERE id = _target AND status = 'published';
  ELSE RAISE EXCEPTION 'not_found'; END IF;
  IF _seats IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF _host = auth.uid() THEN RAISE EXCEPTION 'own_offer'; END IF;
  _note := nullif(trim(coalesce(_note,'')),'');
  IF length(_note) > 500 THEN RAISE EXCEPTION 'too_long'; END IF;
  IF coalesce(_pay_cents,0) < 0 OR coalesce(_pay_cents,0) > 100000 THEN RAISE EXCEPTION 'invalid_amount'; END IF;
  IF (SELECT count(*) FROM community_seat_requests WHERE kind = _kind AND target_id = _target AND status = 'approved') >= _seats THEN RAISE EXCEPTION 'no_seats'; END IF;
  INSERT INTO community_seat_requests(kind, target_id, host_id, user_id, note, pay_cents) VALUES (_kind, _target, _host, auth.uid(), _note, coalesce(_pay_cents,0))
  ON CONFLICT (kind, target_id, user_id) DO UPDATE SET note = excluded.note, pay_cents = excluded.pay_cents, status = 'pending', decided_at = NULL, created_at = now()
    WHERE community_seat_requests.status <> 'approved';
END $$;
REVOKE ALL ON FUNCTION public.request_community_seat(text,uuid,text,int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.request_community_seat(text,uuid,text,int) TO authenticated;

CREATE OR REPLACE FUNCTION public.withdraw_community_request(_kind text, _target uuid) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM community_seat_requests WHERE kind = _kind AND target_id = _target AND user_id = auth.uid() AND status = 'pending'
$$;
REVOKE ALL ON FUNCTION public.withdraw_community_request(text,uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.withdraw_community_request(text,uuid) TO authenticated;

-- Host-only, private list: names are shown only to the host
CREATE OR REPLACE FUNCTION public.community_requests(_kind text, _target uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _ok boolean;
BEGIN
  IF _kind = 'offer' THEN SELECT host_id = auth.uid() INTO _ok FROM offers WHERE id = _target;
  ELSE _ok := public.can_manage_event(_target); END IF;
  IF NOT coalesce(_ok,false) THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id', r.id, 'name', p.full_name, 'avatar_url', p.avatar_url, 'note', r.note, 'pay_cents', r.pay_cents, 'status', r.status, 'created_at', r.created_at) ORDER BY r.status = 'pending' DESC, r.created_at DESC)
    FROM community_seat_requests r LEFT JOIN profiles p ON p.id = r.user_id WHERE r.kind = _kind AND r.target_id = _target), '[]'::jsonb);
END $$;
GRANT EXECUTE ON FUNCTION public.community_requests(text,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.decide_community_seat(_id uuid, _approve boolean) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r community_seat_requests; _ok boolean; _seats int; o offers; _email text; _name text;
BEGIN
  SELECT * INTO r FROM community_seat_requests WHERE id = _id;
  IF r.id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF r.kind = 'offer' THEN SELECT host_id = auth.uid(), community_seats INTO _ok, _seats FROM offers WHERE id = r.target_id;
  ELSE _ok := public.can_manage_event(r.target_id); SELECT community_seats INTO _seats FROM events WHERE id = r.target_id; END IF;
  IF NOT coalesce(_ok,false) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF r.status <> 'pending' THEN RAISE EXCEPTION 'already_decided'; END IF;
  IF NOT _approve THEN UPDATE community_seat_requests SET status = 'declined', decided_at = now() WHERE id = _id; RETURN 'declined'; END IF;
  IF (SELECT count(*) FROM community_seat_requests WHERE kind = r.kind AND target_id = r.target_id AND status = 'approved') >= coalesce(_seats,0) THEN RAISE EXCEPTION 'no_seats'; END IF;
  UPDATE community_seat_requests SET status = 'approved', decided_at = now() WHERE id = _id;
  -- Free seats are granted right away; pay-what-you-can seats are paid by the member at their chosen amount.
  IF r.pay_cents = 0 THEN
    IF r.kind = 'offer' THEN
      SELECT * INTO o FROM offers WHERE id = r.target_id;
      INSERT INTO offer_purchases(offer_id, user_id, status, community, amount_cents) VALUES (r.target_id, r.user_id, CASE WHEN o.kind = 'download' THEN 'paid' ELSE 'active' END, true, 0)
      ON CONFLICT (offer_id, user_id) DO UPDATE SET status = EXCLUDED.status, community = true, cancel_at_period_end = false, paused_until = NULL;
    ELSE
      SELECT u.email, p.full_name INTO _email, _name FROM auth.users u LEFT JOIN profiles p ON p.id = u.id WHERE u.id = r.user_id;
      IF NOT EXISTS (SELECT 1 FROM rsvps WHERE event_id = r.target_id AND user_id = r.user_id AND status <> 'cancelled') THEN
        INSERT INTO rsvps(event_id, user_id, guest_name, guest_email, status, language) VALUES (r.target_id, r.user_id, coalesce(_name, split_part(_email,'@',1)), _email, 'going', 'en');
      END IF;
    END IF;
  END IF;
  RETURN 'approved';
END $$;
REVOKE ALL ON FUNCTION public.decide_community_seat(uuid,boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.decide_community_seat(uuid,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.resume_my_membership(_offer uuid) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE offer_purchases SET paused_until = NULL WHERE offer_id = _offer AND user_id = auth.uid() AND stripe_subscription_id IS NULL
$$;
REVOKE ALL ON FUNCTION public.resume_my_membership(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.resume_my_membership(uuid) TO authenticated;