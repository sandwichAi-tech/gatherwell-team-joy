-- Rows 56-58: opt-in referral programs. All money values are server-computed cents.
CREATE TABLE public.referral_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL,
  item_kind text NOT NULL CHECK (item_kind IN ('event','offer')),
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  offer_id uuid REFERENCES public.offers(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  reward_kind text NOT NULL CHECK (reward_kind IN ('percent','flat')),
  reward_value integer NOT NULL CHECK (reward_value > 0),
  window_days integer NOT NULL DEFAULT 30 CHECK (window_days = 30),
  terms_version text NOT NULL DEFAULT 'referral-beta-2026-10-25',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((item_kind = 'event' AND event_id IS NOT NULL AND offer_id IS NULL) OR (item_kind = 'offer' AND offer_id IS NOT NULL AND event_id IS NULL)),
  CHECK (reward_kind <> 'percent' OR reward_value <= 90)
);
CREATE UNIQUE INDEX referral_programs_event_key ON public.referral_programs(event_id) WHERE event_id IS NOT NULL;
CREATE UNIQUE INDEX referral_programs_offer_key ON public.referral_programs(offer_id) WHERE offer_id IS NOT NULL;
CREATE INDEX referral_programs_host_idx ON public.referral_programs(host_id);

CREATE TABLE public.referral_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES public.referral_programs(id) ON DELETE CASCADE,
  referrer_id uuid NOT NULL,
  code text NOT NULL UNIQUE CHECK (code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (program_id, referrer_id)
);
CREATE INDEX referral_links_referrer_idx ON public.referral_links(referrer_id);

CREATE TABLE public.referral_clicks (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  link_id uuid NOT NULL REFERENCES public.referral_links(id) ON DELETE CASCADE,
  visitor_key uuid NOT NULL,
  user_id uuid,
  clicked_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX referral_clicks_link_idx ON public.referral_clicks(link_id, clicked_at);
CREATE INDEX referral_clicks_visitor_idx ON public.referral_clicks(visitor_key, clicked_at);
CREATE INDEX referral_clicks_user_idx ON public.referral_clicks(user_id, clicked_at);

CREATE TABLE public.referral_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL,
  referrer_id uuid NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  paid_on date NOT NULL,
  note text CHECK (char_length(note) <= 500),
  reference text CHECK (char_length(reference) <= 120),
  method text NOT NULL DEFAULT 'manual' CHECK (method = 'manual'),
  recorded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX referral_payouts_host_idx ON public.referral_payouts(host_id);
CREATE INDEX referral_payouts_referrer_idx ON public.referral_payouts(referrer_id);

CREATE TABLE public.referral_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES public.referral_programs(id) ON DELETE CASCADE,
  link_id uuid NOT NULL REFERENCES public.referral_links(id) ON DELETE CASCADE,
  referrer_id uuid NOT NULL,
  host_id uuid NOT NULL,
  sale_cents integer NOT NULL CHECK (sale_cents >= 0),
  reward_cents integer NOT NULL CHECK (reward_cents >= 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','available','paid','reversed')),
  available_at timestamptz NOT NULL,
  payout_id uuid REFERENCES public.referral_payouts(id),
  reversed_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (reward_cents <= sale_cents)
);
CREATE INDEX referral_rewards_host_idx ON public.referral_rewards(host_id, status);
CREATE INDEX referral_rewards_referrer_idx ON public.referral_rewards(referrer_id, status);

-- Reads go only through RPCs below; direct table access is owner-scoped SELECT only.
GRANT SELECT ON public.referral_programs, public.referral_links, public.referral_rewards, public.referral_payouts TO authenticated;
GRANT ALL ON public.referral_programs, public.referral_links, public.referral_clicks, public.referral_rewards, public.referral_payouts TO service_role;
ALTER TABLE public.referral_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers read programs" ON public.referral_programs FOR SELECT TO authenticated
  USING (public.can_manage_offering(item_kind, coalesce(event_id, offer_id)));
CREATE POLICY "Referrers read own links" ON public.referral_links FOR SELECT TO authenticated USING (referrer_id = auth.uid());
CREATE POLICY "Referrers read own rewards" ON public.referral_rewards FOR SELECT TO authenticated USING (referrer_id = auth.uid());
CREATE POLICY "Referrers read own payouts" ON public.referral_payouts FOR SELECT TO authenticated USING (referrer_id = auth.uid());

CREATE OR REPLACE FUNCTION public.referral_reward_cents(_kind text, _value integer, _sale integer)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN coalesce(_sale,0) <= 0 OR coalesce(_value,0) <= 0 THEN 0
    WHEN _kind = 'percent' THEN floor(_sale::numeric * least(_value,90) / 100)::int
    WHEN _kind = 'flat' THEN least(_value, _sale)
    ELSE 0 END
$$;

-- Eligibility of an item: paid, not team-only, not a membership. Returns host id + price or null.
CREATE OR REPLACE FUNCTION public.referral_item(_kind text, _id uuid)
RETURNS TABLE(host_id uuid, price_cents integer, title text, eligible boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT e.host_id, e.price_cents, e.title,
    (coalesce(e.price_cents,0) > 0 AND e.visibility <> 'team' AND NOT coalesce(e.team_registration,false) AND e.status <> 'cancelled')
  FROM events e WHERE _kind = 'event' AND e.id = _id
  UNION ALL
  SELECT o.host_id, o.price_cents, coalesce(nullif(o.title_en,''), o.title_es),
    (coalesce(o.price_cents,0) > 0 AND o.kind IN ('resource','course') AND o.visibility = 'public' AND o.status <> 'archived')
  FROM offers o WHERE _kind = 'offer' AND o.id = _id
$$;
REVOKE ALL ON FUNCTION public.referral_item(text, uuid) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.referral_shares_team(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM team_members a JOIN team_members b ON a.team_id = b.team_id WHERE a.user_id = _a AND b.user_id = _b)
      OR EXISTS (SELECT 1 FROM teams t JOIN team_members m ON m.team_id = t.id WHERE (t.owner_id = _a AND m.user_id = _b) OR (t.owner_id = _b AND m.user_id = _a))
$$;
REVOKE ALL ON FUNCTION public.referral_shares_team(uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.save_referral_program(_kind text, _item uuid, _enabled boolean, _reward_kind text, _value integer)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE it record; pid uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_manage_offering(_kind, _item) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  SELECT * INTO it FROM public.referral_item(_kind, _item);
  IF it IS NULL OR NOT it.eligible THEN RAISE EXCEPTION 'referral_ineligible'; END IF;
  IF _reward_kind NOT IN ('percent','flat') OR _value IS NULL OR _value <= 0 THEN RAISE EXCEPTION 'referral_invalid_reward'; END IF;
  IF _reward_kind = 'percent' AND _value > 90 THEN RAISE EXCEPTION 'referral_percent_too_high'; END IF;
  IF _reward_kind = 'flat' AND _value >= it.price_cents THEN RAISE EXCEPTION 'referral_flat_too_high'; END IF;
  SELECT id INTO pid FROM referral_programs WHERE (_kind = 'event' AND event_id = _item) OR (_kind = 'offer' AND offer_id = _item);
  IF pid IS NULL THEN
    INSERT INTO referral_programs(host_id, item_kind, event_id, offer_id, enabled, reward_kind, reward_value)
    VALUES (it.host_id, _kind, CASE WHEN _kind='event' THEN _item END, CASE WHEN _kind='offer' THEN _item END, coalesce(_enabled,false), _reward_kind, _value)
    RETURNING id INTO pid;
  ELSE
    UPDATE referral_programs SET enabled = coalesce(_enabled,false), reward_kind = _reward_kind, reward_value = _value, updated_at = now() WHERE id = pid;
  END IF;
  RETURN pid;
END $$;
REVOKE ALL ON FUNCTION public.save_referral_program(text, uuid, boolean, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_referral_program(text, uuid, boolean, text, integer) TO authenticated;

-- Public: is a program on for this item, and what reward would the caller earn (signed-in only).
CREATE OR REPLACE FUNCTION public.referral_program_for(_kind text, _item uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE p record; it record; l text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO p FROM referral_programs WHERE enabled AND ((_kind='event' AND event_id=_item) OR (_kind='offer' AND offer_id=_item));
  IF p IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO it FROM public.referral_item(_kind, _item);
  IF NOT coalesce(it.eligible,false) OR p.host_id = auth.uid() THEN RETURN NULL; END IF;
  SELECT code INTO l FROM referral_links WHERE program_id = p.id AND referrer_id = auth.uid();
  RETURN jsonb_build_object('program_id', p.id, 'reward_kind', p.reward_kind, 'reward_value', p.reward_value,
    'example_cents', public.referral_reward_cents(p.reward_kind, p.reward_value, it.price_cents), 'price_cents', it.price_cents, 'window_days', p.window_days, 'code', l);
END $$;
REVOKE ALL ON FUNCTION public.referral_program_for(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.referral_program_for(text, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_referral_link(_program uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p record; it record; c text; alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; i int; tries int := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  SELECT * INTO p FROM referral_programs WHERE id = _program AND enabled;
  IF p IS NULL THEN RAISE EXCEPTION 'referral_not_found'; END IF;
  IF p.host_id = auth.uid() THEN RAISE EXCEPTION 'referral_self'; END IF;
  SELECT * INTO it FROM public.referral_item(p.item_kind, coalesce(p.event_id, p.offer_id));
  IF NOT coalesce(it.eligible,false) THEN RAISE EXCEPTION 'referral_ineligible'; END IF;
  SELECT code INTO c FROM referral_links WHERE program_id = _program AND referrer_id = auth.uid();
  IF c IS NOT NULL THEN RETURN c; END IF;
  LOOP
    c := ''; FOR i IN 1..8 LOOP c := c || substr(alphabet, 1 + floor(random() * 32)::int, 1); END LOOP;
    BEGIN
      INSERT INTO referral_links(program_id, referrer_id, code) VALUES (_program, auth.uid(), c);
      RETURN c;
    EXCEPTION WHEN unique_violation THEN
      SELECT code INTO c FROM referral_links WHERE program_id = _program AND referrer_id = auth.uid();
      IF c IS NOT NULL THEN RETURN c; END IF;
      tries := tries + 1; IF tries > 8 THEN RAISE EXCEPTION 'referral_code_exhausted'; END IF;
    END;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.get_referral_link(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_referral_link(uuid) TO authenticated;

-- Landing capture: anonymous allowed. One click per link+visitor per hour; referrer's own clicks ignored.
CREATE OR REPLACE FUNCTION public.record_referral_click(_code text, _visitor uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l record;
BEGIN
  IF _visitor IS NULL OR _code !~ '^[A-HJ-NP-Z2-9]{8}$' THEN RETURN false; END IF;
  SELECT rl.* INTO l FROM referral_links rl JOIN referral_programs p ON p.id = rl.program_id WHERE rl.code = _code AND p.enabled;
  IF l IS NULL OR l.referrer_id = auth.uid() THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM referral_clicks WHERE link_id = l.id AND visitor_key = _visitor AND clicked_at > now() - interval '1 hour') THEN
    UPDATE referral_clicks SET user_id = coalesce(user_id, auth.uid()) WHERE visitor_key = _visitor AND link_id = l.id AND clicked_at > now() - interval '1 hour';
    RETURN true;
  END IF;
  IF (SELECT count(*) FROM referral_clicks WHERE visitor_key = _visitor AND clicked_at > now() - interval '1 day') >= 50 THEN RETURN false; END IF;
  INSERT INTO referral_clicks(link_id, visitor_key, user_id) VALUES (l.id, _visitor, auth.uid());
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.record_referral_click(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_referral_click(text, uuid) TO anon, authenticated;

-- After sign-up/login: tie this device's recent anonymous clicks to the account.
CREATE OR REPLACE FUNCTION public.claim_referral_visitor(_visitor uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  IF auth.uid() IS NULL OR _visitor IS NULL THEN RETURN 0; END IF;
  UPDATE referral_clicks c SET user_id = auth.uid()
  FROM referral_links l WHERE l.id = c.link_id AND c.visitor_key = _visitor AND c.user_id IS NULL
    AND c.clicked_at > now() - interval '30 days' AND l.referrer_id <> auth.uid();
  GET DIAGNOSTICS n = ROW_COUNT; RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.claim_referral_visitor(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_referral_visitor(uuid) TO authenticated;

-- Provider hook: called by the orders trigger when an order becomes paid. Idempotent.
CREATE OR REPLACE FUNCTION public.referral_attribute_order(_order uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o record; p record; k record; it record; sale int; rid uuid;
BEGIN
  SELECT * INTO o FROM orders WHERE id = _order;
  IF o IS NULL OR o.status <> 'paid' OR o.buyer_user_id IS NULL OR o.offering_type NOT IN ('event','resource','course') THEN RETURN NULL; END IF;
  SELECT id INTO rid FROM referral_rewards WHERE order_id = _order; IF rid IS NOT NULL THEN RETURN rid; END IF;
  SELECT * INTO p FROM referral_programs WHERE enabled AND ((o.event_id IS NOT NULL AND event_id = o.event_id) OR (o.offer_id IS NOT NULL AND offer_id = o.offer_id));
  IF p IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO it FROM public.referral_item(p.item_kind, coalesce(p.event_id, p.offer_id));
  IF NOT coalesce(it.eligible,false) THEN RETURN NULL; END IF;
  -- Last valid click inside the window, deterministic tie-break.
  SELECT l.id AS link_id, l.referrer_id INTO k FROM referral_clicks c JOIN referral_links l ON l.id = c.link_id
  WHERE l.program_id = p.id AND c.user_id = o.buyer_user_id
    AND c.clicked_at <= o.created_at AND c.clicked_at > o.created_at - make_interval(days => p.window_days)
    AND l.referrer_id <> o.buyer_user_id AND l.referrer_id <> p.host_id
    AND NOT public.referral_shares_team(l.referrer_id, o.buyer_user_id)
  ORDER BY c.clicked_at DESC, c.id DESC LIMIT 1;
  IF k IS NULL THEN RETURN NULL; END IF;
  sale := greatest(o.gross_cents - o.discount_cents, 0);
  INSERT INTO referral_rewards(order_id, program_id, link_id, referrer_id, host_id, sale_cents, reward_cents, available_at)
  VALUES (_order, p.id, k.link_id, k.referrer_id, p.host_id, sale, public.referral_reward_cents(p.reward_kind, p.reward_value, sale), now() + interval '14 days')
  ON CONFLICT (order_id) DO NOTHING RETURNING id INTO rid;
  RETURN rid;
END $$;
REVOKE ALL ON FUNCTION public.referral_attribute_order(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.referral_reverse_order(_order uuid, _reason text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  UPDATE referral_rewards SET status = 'reversed', reversed_reason = _reason, updated_at = now()
  WHERE order_id = _order AND status IN ('pending','available');
  GET DIAGNOSTICS n = ROW_COUNT; RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.referral_reverse_order(uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.orders_referral_hook() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'paid' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'paid') THEN PERFORM public.referral_attribute_order(NEW.id);
  ELSIF NEW.status IN ('refunded','cancelled','disputed','failed') AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN PERFORM public.referral_reverse_order(NEW.id, NEW.status);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER orders_referral_hook AFTER INSERT OR UPDATE OF status ON public.orders FOR EACH ROW EXECUTE FUNCTION public.orders_referral_hook();

CREATE OR REPLACE FUNCTION public.referral_release_due() RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE referral_rewards r SET status = 'available', updated_at = now()
  FROM orders o WHERE o.id = r.order_id AND r.status = 'pending' AND r.available_at <= now() AND o.status = 'paid'
$$;
REVOKE ALL ON FUNCTION public.referral_release_due() FROM PUBLIC, anon, authenticated;

-- Coach dashboard: programs the caller manages, privacy-safe aggregates, filtered reward rows (no buyer identity).
CREATE OR REPLACE FUNCTION public.coach_referral_dashboard(_program uuid DEFAULT NULL, _referrer uuid DEFAULT NULL, _status text DEFAULT NULL, _from date DEFAULT NULL, _to date DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE res jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  PERFORM public.referral_release_due();
  WITH progs AS (
    SELECT p.*, it.title, it.price_cents, it.eligible FROM referral_programs p
    CROSS JOIN LATERAL public.referral_item(p.item_kind, coalesce(p.event_id, p.offer_id)) it
    WHERE public.can_manage_offering(p.item_kind, coalesce(p.event_id, p.offer_id))
  ), rw AS (
    SELECT r.* FROM referral_rewards r JOIN progs ON progs.id = r.program_id
    WHERE (_program IS NULL OR r.program_id = _program) AND (_referrer IS NULL OR r.referrer_id = _referrer)
      AND (_status IS NULL OR r.status = _status) AND (_from IS NULL OR r.created_at::date >= _from) AND (_to IS NULL OR r.created_at::date <= _to)
  ), ck AS (
    SELECT l.program_id, l.referrer_id, count(c.id) AS clicks, count(DISTINCT c.user_id) AS signups FROM referral_links l JOIN progs ON progs.id = l.program_id
    LEFT JOIN referral_clicks c ON c.link_id = l.id AND (_from IS NULL OR c.clicked_at::date >= _from) AND (_to IS NULL OR c.clicked_at::date <= _to)
    WHERE (_program IS NULL OR l.program_id = _program) AND (_referrer IS NULL OR l.referrer_id = _referrer)
    GROUP BY 1,2
  )
  SELECT jsonb_build_object(
    'programs', coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'item_kind', item_kind, 'item_id', coalesce(event_id, offer_id), 'title', title, 'price_cents', price_cents, 'eligible', eligible,
        'enabled', enabled, 'reward_kind', reward_kind, 'reward_value', reward_value, 'window_days', window_days) ORDER BY updated_at DESC) FROM progs), '[]'),
    'referrers', coalesce((SELECT jsonb_agg(DISTINCT jsonb_build_object('id', l.referrer_id, 'name', coalesce(pr.full_name, ''))) FROM referral_links l JOIN progs ON progs.id = l.program_id LEFT JOIN profiles pr ON pr.id = l.referrer_id), '[]'),
    'totals', jsonb_build_object(
      'clicks', coalesce((SELECT sum(clicks) FROM ck), 0), 'signups', coalesce((SELECT sum(signups) FROM ck), 0),
      'conversions', (SELECT count(*) FROM rw WHERE status <> 'reversed'),
      'revenue_cents', coalesce((SELECT sum(sale_cents) FROM rw WHERE status <> 'reversed'), 0),
      'pending_cents', coalesce((SELECT sum(reward_cents) FROM rw WHERE status = 'pending'), 0),
      'available_cents', coalesce((SELECT sum(reward_cents) FROM rw WHERE status = 'available'), 0),
      'paid_cents', coalesce((SELECT sum(reward_cents) FROM rw WHERE status = 'paid'), 0),
      'reversed_cents', coalesce((SELECT sum(reward_cents) FROM rw WHERE status = 'reversed'), 0)),
    'rewards', coalesce((SELECT jsonb_agg(jsonb_build_object('id', rw.id, 'program_id', rw.program_id, 'referrer_id', rw.referrer_id, 'referrer_name', coalesce(pr.full_name,''), 'sale_cents', rw.sale_cents,
        'reward_cents', rw.reward_cents, 'status', rw.status, 'created_at', rw.created_at, 'available_at', rw.available_at) ORDER BY rw.created_at DESC) FROM (SELECT * FROM rw ORDER BY created_at DESC LIMIT 200) rw LEFT JOIN profiles pr ON pr.id = rw.referrer_id), '[]'),
    'payouts', coalesce((SELECT jsonb_agg(jsonb_build_object('id', po.id, 'referrer_id', po.referrer_id, 'referrer_name', coalesce(pr.full_name,''), 'amount_cents', po.amount_cents, 'paid_on', po.paid_on, 'note', po.note, 'reference', po.reference) ORDER BY po.paid_on DESC, po.created_at DESC)
        FROM referral_payouts po LEFT JOIN profiles pr ON pr.id = po.referrer_id WHERE po.host_id = auth.uid() AND (_referrer IS NULL OR po.referrer_id = _referrer)), '[]')
  ) INTO res;
  RETURN res;
END $$;
REVOKE ALL ON FUNCTION public.coach_referral_dashboard(uuid, uuid, text, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_referral_dashboard(uuid, uuid, text, date, date) TO authenticated;

-- Manual payout ledger: records administration only, never transfers money.
CREATE OR REPLACE FUNCTION public.record_referral_payout(_referrer uuid, _rewards uuid[], _paid_on date, _note text, _reference text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE total int; n int; pid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF _paid_on IS NULL OR _paid_on > current_date THEN RAISE EXCEPTION 'referral_payout_date'; END IF;
  IF coalesce(array_length(_rewards,1),0) = 0 THEN RAISE EXCEPTION 'referral_payout_empty'; END IF;
  PERFORM public.referral_release_due();
  SELECT count(*), coalesce(sum(reward_cents),0) INTO n, total FROM referral_rewards
  WHERE id = ANY(_rewards) AND host_id = auth.uid() AND referrer_id = _referrer AND status = 'available' FOR UPDATE;
  IF n <> array_length(_rewards,1) OR total <= 0 THEN RAISE EXCEPTION 'referral_payout_invalid'; END IF;
  INSERT INTO referral_payouts(host_id, referrer_id, amount_cents, paid_on, note, reference, recorded_by)
  VALUES (auth.uid(), _referrer, total, _paid_on, nullif(trim(_note),''), nullif(trim(_reference),''), auth.uid()) RETURNING id INTO pid;
  UPDATE referral_rewards SET status = 'paid', payout_id = pid, updated_at = now() WHERE id = ANY(_rewards);
  RETURN pid;
END $$;
REVOKE ALL ON FUNCTION public.record_referral_payout(uuid, uuid[], date, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_referral_payout(uuid, uuid[], date, text, text) TO authenticated;

-- Referrer's own dashboard: no buyer identity, only own links/rewards/payouts.
CREATE OR REPLACE FUNCTION public.my_referral_dashboard()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid();
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  PERFORM public.referral_release_due();
  RETURN jsonb_build_object(
    'links', coalesce((SELECT jsonb_agg(jsonb_build_object('code', l.code, 'item_kind', p.item_kind, 'item_id', coalesce(p.event_id, p.offer_id), 'title', it.title, 'enabled', p.enabled AND it.eligible,
        'reward_kind', p.reward_kind, 'reward_value', p.reward_value, 'window_days', p.window_days,
        'clicks', (SELECT count(*) FROM referral_clicks c WHERE c.link_id = l.id),
        'conversions', (SELECT count(*) FROM referral_rewards r WHERE r.link_id = l.id AND r.status <> 'reversed')) ORDER BY l.created_at DESC)
      FROM referral_links l JOIN referral_programs p ON p.id = l.program_id CROSS JOIN LATERAL public.referral_item(p.item_kind, coalesce(p.event_id, p.offer_id)) it WHERE l.referrer_id = me), '[]'),
    'totals', (SELECT jsonb_build_object(
        'pending_cents', coalesce(sum(reward_cents) FILTER (WHERE status='pending'),0), 'available_cents', coalesce(sum(reward_cents) FILTER (WHERE status='available'),0),
        'paid_cents', coalesce(sum(reward_cents) FILTER (WHERE status='paid'),0), 'reversed_cents', coalesce(sum(reward_cents) FILTER (WHERE status='reversed'),0)) FROM referral_rewards WHERE referrer_id = me),
    'rewards', coalesce((SELECT jsonb_agg(jsonb_build_object('id', r.id, 'title', it.title, 'reward_cents', r.reward_cents, 'status', r.status, 'created_at', r.created_at, 'available_at', r.available_at) ORDER BY r.created_at DESC)
      FROM (SELECT * FROM referral_rewards WHERE referrer_id = me ORDER BY created_at DESC LIMIT 200) r JOIN referral_programs p ON p.id = r.program_id CROSS JOIN LATERAL public.referral_item(p.item_kind, coalesce(p.event_id, p.offer_id)) it), '[]'),
    'payouts', coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'amount_cents', amount_cents, 'paid_on', paid_on, 'reference', reference) ORDER BY paid_on DESC) FROM referral_payouts WHERE referrer_id = me), '[]'));
END $$;
REVOKE ALL ON FUNCTION public.my_referral_dashboard() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_referral_dashboard() TO authenticated;