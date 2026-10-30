-- Rows 89/90: affiliates join a program only by owner invite or owner-approved request, and only after accepting approved affiliate terms.
ALTER TABLE public.consent_text_versions DROP CONSTRAINT consent_text_versions_kind_check;
ALTER TABLE public.consent_text_versions ADD CONSTRAINT consent_text_versions_kind_check
  CHECK (kind = ANY (ARRAY['waiver','guardian','marketing_email','marketing_sms','terms','privacy','adult','event_agreement','affiliate_terms']));

CREATE TABLE public.referral_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES public.referral_programs(id) ON DELETE CASCADE,
  referrer_id uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('invited','requested','approved','rejected','revoked')),
  legacy boolean NOT NULL DEFAULT false,
  invited_by uuid,
  decided_by uuid,
  decided_at timestamptz,
  terms_accepted_at timestamptz,
  terms_version_id uuid REFERENCES public.consent_text_versions(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (program_id, referrer_id)
);
CREATE INDEX referral_memberships_referrer_idx ON public.referral_memberships(referrer_id);
COMMENT ON COLUMN public.referral_memberships.legacy IS 'Link existed before approval was required; the owner must approve and the referrer must accept terms before it earns again.';

CREATE TABLE public.referral_terms_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id uuid NOT NULL REFERENCES public.referral_memberships(id) ON DELETE CASCADE,
  referrer_id uuid NOT NULL,
  consent_version_id uuid NOT NULL REFERENCES public.consent_text_versions(id),
  body_sha256 text NOT NULL,
  locale text NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.referral_memberships, public.referral_terms_acceptances TO authenticated;
GRANT ALL ON public.referral_memberships, public.referral_terms_acceptances TO service_role;
ALTER TABLE public.referral_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_terms_acceptances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Referrer or program manager reads membership" ON public.referral_memberships FOR SELECT TO authenticated
  USING (referrer_id = auth.uid() OR EXISTS (SELECT 1 FROM public.referral_programs p WHERE p.id = program_id AND public.can_manage_offering(p.item_kind, coalesce(p.event_id, p.offer_id))));
CREATE POLICY "Referrer reads own acceptances" ON public.referral_terms_acceptances FOR SELECT TO authenticated USING (referrer_id = auth.uid());

-- Existing links are carried over deliberately as legacy requests: never active until the owner approves and the referrer accepts terms.
INSERT INTO public.referral_memberships(program_id, referrer_id, status, legacy, created_at)
SELECT program_id, referrer_id, 'requested', true, created_at FROM public.referral_links
ON CONFLICT (program_id, referrer_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.approved_affiliate_terms(_locale text) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM consent_text_versions WHERE kind = 'affiliate_terms' AND team_id IS NULL AND locale = _locale AND approved_at IS NOT NULL
    AND length(trim(coalesce(approval_reference,''))) > 0 AND document_url ~ '^https://' AND effective_from <= now()
  ORDER BY version DESC LIMIT 1
$$;
GRANT EXECUTE ON FUNCTION public.approved_affiliate_terms(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.referral_member_active(_program uuid, _user uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM referral_memberships m WHERE m.program_id = _program AND m.referrer_id = _user AND m.status = 'approved' AND m.terms_accepted_at IS NOT NULL AND m.terms_version_id IS NOT NULL)
$$;
REVOKE ALL ON FUNCTION public.referral_member_active(uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.referral_program_manager(_program uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM referral_programs p WHERE p.id = _program AND public.can_manage_offering(p.item_kind, coalesce(p.event_id, p.offer_id)))
$$;
REVOKE ALL ON FUNCTION public.referral_program_manager(uuid) FROM PUBLIC, anon;

-- Owner invites an existing account by email. Same answer whether or not the email exists, so it can't be used to look people up.
CREATE OR REPLACE FUNCTION public.invite_referrer(_program uuid, _email text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p record; u uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.referral_program_manager(_program) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  SELECT * INTO p FROM referral_programs WHERE id = _program;
  SELECT id INTO u FROM auth.users WHERE lower(email) = lower(trim(_email)) LIMIT 1;
  IF u IS NULL OR u = p.host_id OR u = auth.uid() THEN RETURN true; END IF;
  INSERT INTO referral_memberships(program_id, referrer_id, status, invited_by) VALUES (_program, u, 'invited', auth.uid())
  ON CONFLICT (program_id, referrer_id) DO UPDATE SET
    status = CASE WHEN referral_memberships.status IN ('requested','rejected','revoked') THEN 'invited' ELSE referral_memberships.status END,
    invited_by = CASE WHEN referral_memberships.status IN ('requested','rejected','revoked') THEN auth.uid() ELSE referral_memberships.invited_by END,
    terms_accepted_at = CASE WHEN referral_memberships.status IN ('requested','rejected','revoked') THEN NULL ELSE referral_memberships.terms_accepted_at END,
    terms_version_id = CASE WHEN referral_memberships.status IN ('requested','rejected','revoked') THEN NULL ELSE referral_memberships.terms_version_id END,
    updated_at = now();
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.invite_referrer(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.invite_referrer(uuid, text) TO authenticated;

-- Signed-in visitor asks to join an enabled, eligible program. Rejected/revoked people cannot re-request themselves.
CREATE OR REPLACE FUNCTION public.request_referral_membership(_program uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p record; it record; s text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  SELECT * INTO p FROM referral_programs WHERE id = _program AND enabled;
  IF p IS NULL THEN RAISE EXCEPTION 'referral_not_found'; END IF;
  IF p.host_id = auth.uid() THEN RAISE EXCEPTION 'referral_self'; END IF;
  SELECT * INTO it FROM public.referral_item(p.item_kind, coalesce(p.event_id, p.offer_id));
  IF NOT coalesce(it.eligible,false) THEN RAISE EXCEPTION 'referral_ineligible'; END IF;
  INSERT INTO referral_memberships(program_id, referrer_id, status) VALUES (_program, auth.uid(), 'requested')
  ON CONFLICT (program_id, referrer_id) DO NOTHING;
  SELECT status INTO s FROM referral_memberships WHERE program_id = _program AND referrer_id = auth.uid();
  RETURN s;
END $$;
REVOKE ALL ON FUNCTION public.request_referral_membership(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_referral_membership(uuid) TO authenticated;

-- Owner decisions. approve: requested -> approved (referrer still must accept terms). reject: invited/requested -> rejected. revoke: any non-rejected -> revoked.
CREATE OR REPLACE FUNCTION public.decide_referrer(_program uuid, _referrer uuid, _action text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m record; nxt text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.referral_program_manager(_program) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  SELECT * INTO m FROM referral_memberships WHERE program_id = _program AND referrer_id = _referrer FOR UPDATE;
  IF m IS NULL THEN RAISE EXCEPTION 'referral_member_not_found'; END IF;
  nxt := CASE
    WHEN _action = 'approve' AND m.status = 'requested' THEN 'approved'
    WHEN _action = 'reject' AND m.status IN ('invited','requested') THEN 'rejected'
    WHEN _action = 'revoke' AND m.status IN ('invited','requested','approved') THEN 'revoked'
    ELSE NULL END;
  IF nxt IS NULL THEN RAISE EXCEPTION 'referral_invalid_transition'; END IF;
  UPDATE referral_memberships SET status = nxt, decided_by = auth.uid(), decided_at = now(), updated_at = now() WHERE id = m.id;
  RETURN nxt;
END $$;
REVOKE ALL ON FUNCTION public.decide_referrer(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decide_referrer(uuid, uuid, text) TO authenticated;

-- Referrer accepts the current approved affiliate terms. invited -> approved+accepted; approved -> accepted. Fails closed without approved terms.
CREATE OR REPLACE FUNCTION public.accept_referral_terms(_program uuid, _locale text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m record; v uuid; c record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  SELECT * INTO m FROM referral_memberships WHERE program_id = _program AND referrer_id = auth.uid() FOR UPDATE;
  IF m IS NULL OR m.status NOT IN ('invited','approved') THEN RAISE EXCEPTION 'referral_not_invited'; END IF;
  v := public.approved_affiliate_terms(CASE WHEN _locale = 'es' THEN 'es' ELSE 'en' END);
  IF v IS NULL THEN RAISE EXCEPTION 'referral_terms_unavailable'; END IF;
  SELECT * INTO c FROM consent_text_versions WHERE id = v;
  INSERT INTO referral_terms_acceptances(membership_id, referrer_id, consent_version_id, body_sha256, locale) VALUES (m.id, auth.uid(), v, c.body_sha256, c.locale);
  UPDATE referral_memberships SET status = 'approved', terms_accepted_at = now(), terms_version_id = v, updated_at = now() WHERE id = m.id;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.accept_referral_terms(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_referral_terms(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.program_referrers(_program uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.referral_program_manager(_program) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('referrer_id', m.referrer_id, 'name', coalesce(pr.full_name, ''), 'status', m.status, 'legacy', m.legacy,
      'terms_accepted', m.terms_accepted_at IS NOT NULL, 'updated_at', m.updated_at) ORDER BY m.updated_at DESC)
    FROM referral_memberships m LEFT JOIN profiles pr ON pr.id = m.referrer_id WHERE m.program_id = _program), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.program_referrers(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.program_referrers(uuid) TO authenticated;

-- Item page: program facts plus the caller's membership state; code only while active.
CREATE OR REPLACE FUNCTION public.referral_program_for(_kind text, _item uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE p record; it record; l text; m record; active boolean;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO p FROM referral_programs WHERE enabled AND ((_kind='event' AND event_id=_item) OR (_kind='offer' AND offer_id=_item));
  IF p IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO it FROM public.referral_item(_kind, _item);
  IF NOT coalesce(it.eligible,false) OR p.host_id = auth.uid() THEN RETURN NULL; END IF;
  SELECT * INTO m FROM referral_memberships WHERE program_id = p.id AND referrer_id = auth.uid();
  active := public.referral_member_active(p.id, auth.uid());
  IF active THEN SELECT code INTO l FROM referral_links WHERE program_id = p.id AND referrer_id = auth.uid(); END IF;
  RETURN jsonb_build_object('program_id', p.id, 'reward_kind', p.reward_kind, 'reward_value', p.reward_value,
    'example_cents', public.referral_reward_cents(p.reward_kind, p.reward_value, it.price_cents), 'price_cents', it.price_cents, 'window_days', p.window_days,
    'code', l, 'membership', m.status, 'terms_accepted', m.terms_accepted_at IS NOT NULL, 'active', active,
    'terms_available', public.approved_affiliate_terms('en') IS NOT NULL AND public.approved_affiliate_terms('es') IS NOT NULL);
END $$;

CREATE OR REPLACE FUNCTION public.get_referral_link(_program uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p record; it record; c text; alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; i int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  SELECT * INTO p FROM referral_programs WHERE id = _program AND enabled;
  IF p IS NULL THEN RAISE EXCEPTION 'referral_not_found'; END IF;
  IF p.host_id = auth.uid() THEN RAISE EXCEPTION 'referral_self'; END IF;
  IF NOT public.referral_member_active(_program, auth.uid()) THEN RAISE EXCEPTION 'referral_not_approved'; END IF;
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
    END;
  END LOOP;
END $$;

-- Clicks on links of non-active members are ignored.
CREATE OR REPLACE FUNCTION public.record_referral_click(_code text, _visitor uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l record;
BEGIN
  IF _visitor IS NULL OR _code !~ '^[A-HJ-NP-Z2-9]{8}$' THEN RETURN false; END IF;
  SELECT rl.* INTO l FROM referral_links rl JOIN referral_programs p ON p.id = rl.program_id WHERE rl.code = _code AND p.enabled;
  IF l IS NULL OR l.referrer_id = auth.uid() OR NOT public.referral_member_active(l.program_id, l.referrer_id) THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM referral_clicks WHERE link_id = l.id AND visitor_key = _visitor AND clicked_at > now() - interval '1 hour') THEN
    UPDATE referral_clicks SET user_id = coalesce(user_id, auth.uid()) WHERE visitor_key = _visitor AND link_id = l.id AND clicked_at > now() - interval '1 hour';
    RETURN true;
  END IF;
  IF (SELECT count(*) FROM referral_clicks WHERE visitor_key = _visitor AND clicked_at > now() - interval '1 day') >= 50 THEN RETURN false; END IF;
  INSERT INTO referral_clicks(link_id, visitor_key, user_id) VALUES (l.id, _visitor, auth.uid());
  RETURN true;
END $$;

-- New rewards only for referrers active at the time the order is paid. Existing rewards are never touched here.
CREATE OR REPLACE FUNCTION public.referral_attribute_order(_order uuid)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE o record; p record; k record; it record; sale int; rid uuid; amt int;
BEGIN
  SELECT * INTO o FROM orders WHERE id = _order;
  IF o IS NULL OR o.status <> 'paid' OR o.buyer_user_id IS NULL OR o.offering_type NOT IN ('event','resource','course') THEN RETURN NULL; END IF;
  SELECT id INTO rid FROM referral_rewards WHERE order_id = _order; IF rid IS NOT NULL THEN RETURN rid; END IF;
  SELECT * INTO p FROM referral_programs WHERE enabled AND ((o.event_id IS NOT NULL AND event_id = o.event_id) OR (o.offer_id IS NOT NULL AND offer_id = o.offer_id));
  IF p IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO it FROM public.referral_item(p.item_kind, coalesce(p.event_id, p.offer_id));
  IF NOT coalesce(it.eligible,false) THEN RETURN NULL; END IF;
  SELECT l.id AS link_id, l.referrer_id INTO k FROM referral_clicks c JOIN referral_links l ON l.id = c.link_id
  WHERE l.program_id = p.id AND c.user_id = o.buyer_user_id
    AND c.clicked_at <= o.created_at AND c.clicked_at > o.created_at - make_interval(days => p.window_days)
    AND l.referrer_id <> o.buyer_user_id AND l.referrer_id <> p.host_id
    AND NOT public.referral_shares_team(l.referrer_id, o.buyer_user_id)
    AND public.referral_member_active(p.id, l.referrer_id)
  ORDER BY c.clicked_at DESC, c.id DESC LIMIT 1;
  IF k IS NULL THEN RETURN NULL; END IF;
  sale := greatest(o.gross_cents - o.discount_cents, 0);
  amt := public.referral_reward_cents(p.reward_kind, p.reward_value, sale);
  INSERT INTO referral_rewards(order_id, program_id, link_id, referrer_id, host_id, sale_cents, reward_cents, available_at, reward_kind, reward_value, original_reward_cents)
  VALUES (_order, p.id, k.link_id, k.referrer_id, p.host_id, sale, amt, now() + interval '14 days', p.reward_kind, p.reward_value, amt)
  ON CONFLICT (order_id) DO NOTHING RETURNING id INTO rid;
  RETURN rid;
END $function$;

-- Referrer dashboard: links show as active only while membership is active; invitations/requests listed separately.
CREATE OR REPLACE FUNCTION public.my_referral_dashboard()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid();
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  PERFORM public.referral_release_due();
  RETURN jsonb_build_object(
    'links', coalesce((SELECT jsonb_agg(jsonb_build_object('code', l.code, 'item_kind', p.item_kind, 'item_id', coalesce(p.event_id, p.offer_id), 'title', it.title,
        'enabled', p.enabled AND it.eligible AND public.referral_member_active(p.id, me),
        'reward_kind', p.reward_kind, 'reward_value', p.reward_value, 'window_days', p.window_days,
        'clicks', (SELECT count(*) FROM referral_clicks c WHERE c.link_id = l.id),
        'conversions', (SELECT count(*) FROM referral_rewards r WHERE r.link_id = l.id AND r.status <> 'reversed')) ORDER BY l.created_at DESC)
      FROM referral_links l JOIN referral_programs p ON p.id = l.program_id CROSS JOIN LATERAL public.referral_item(p.item_kind, coalesce(p.event_id, p.offer_id)) it WHERE l.referrer_id = me), '[]'),
    'memberships', coalesce((SELECT jsonb_agg(jsonb_build_object('program_id', m.program_id, 'item_kind', p.item_kind, 'item_id', coalesce(p.event_id, p.offer_id), 'title', it.title,
        'status', m.status, 'legacy', m.legacy, 'terms_accepted', m.terms_accepted_at IS NOT NULL) ORDER BY m.updated_at DESC)
      FROM referral_memberships m JOIN referral_programs p ON p.id = m.program_id CROSS JOIN LATERAL public.referral_item(p.item_kind, coalesce(p.event_id, p.offer_id)) it
      WHERE m.referrer_id = me AND NOT (m.status = 'approved' AND m.terms_accepted_at IS NOT NULL)), '[]'),
    'terms_available', public.approved_affiliate_terms('en') IS NOT NULL AND public.approved_affiliate_terms('es') IS NOT NULL,
    'totals', (SELECT jsonb_build_object(
        'pending_cents', coalesce(sum(reward_cents) FILTER (WHERE status='pending'),0), 'available_cents', coalesce(sum(reward_cents) FILTER (WHERE status='available'),0),
        'paid_cents', coalesce(sum(reward_cents) FILTER (WHERE status='paid'),0), 'reversed_cents', coalesce(sum(reward_cents) FILTER (WHERE status='reversed'),0)) FROM referral_rewards WHERE referrer_id = me),
    'rewards', coalesce((SELECT jsonb_agg(jsonb_build_object('id', r.id, 'title', it.title, 'reward_cents', r.reward_cents, 'status', r.status, 'created_at', r.created_at, 'available_at', r.available_at) ORDER BY r.created_at DESC)
      FROM (SELECT * FROM referral_rewards WHERE referrer_id = me ORDER BY created_at DESC LIMIT 200) r JOIN referral_programs p ON p.id = r.program_id CROSS JOIN LATERAL public.referral_item(p.item_kind, coalesce(p.event_id, p.offer_id)) it), '[]'),
    'payouts', coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'amount_cents', amount_cents, 'paid_on', paid_on, 'reference', reference) ORDER BY paid_on DESC) FROM referral_payouts WHERE referrer_id = me), '[]'));
END $$;

-- Summary freshness: include the stored file's own version (etag/size/updated time), so overwriting the same path counts as a change.
CREATE OR REPLACE FUNCTION public.learn_file_version(_path text) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, storage AS $$
  SELECT coalesce((SELECT coalesce(o.metadata->>'eTag','') || ':' || coalesce(o.metadata->>'size','') || ':' || coalesce(o.updated_at::text,'')
    FROM storage.objects o WHERE o.bucket_id = 'learn-media' AND o.name = _path
      AND EXISTS (SELECT 1 FROM public.lessons l WHERE l.storage_path = _path AND public.can_read_track(l.track_id))), 'missing')
$$;
REVOKE ALL ON FUNCTION public.learn_file_version(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.learn_file_version(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.lesson_source_hash(_lesson uuid)
 RETURNS text LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public'
AS $$
  SELECT md5(coalesce(l.notes_en,'') || E'\x1f' || coalesce(l.notes_es,'') || E'\x1f' || coalesce(l.storage_path,'') || E'\x1f'
    || CASE WHEN l.storage_path IS NULL THEN '' ELSE public.learn_file_version(l.storage_path) END || E'\x1f' || coalesce(l.attachments::text,''))
  FROM public.lessons l WHERE l.id = _lesson
$$;