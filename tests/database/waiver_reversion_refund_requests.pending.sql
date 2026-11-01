-- PENDING (not applied to the shared backend). Published-event waiver versioning + cancellation/refund request ledger.
-- Approved rule (2026-11-01): signed records stay tied to the exact version accepted; a new version on a published
-- event applies to future registrations and to registered attendees who have not checked in yet.

-- 1) Check-in requires the CURRENT version of each required event waiver; already checked-in attendees are never re-blocked.
CREATE OR REPLACE FUNCTION public.checkin_blocker(_rsvp uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT CASE WHEN e.status<>'published' THEN 'event_unavailable'
 WHEN r.merged_into_rsvp_id IS NOT NULL THEN 'not_found'
 WHEN r.status='cancelled' THEN 'cancelled' WHEN r.status='waitlist' THEN 'waitlist' WHEN r.status<>'going' THEN 'registration_required'
 WHEN r.checked_in_at IS NOT NULL THEN NULL
 WHEN (e.requires_waiver AND NOT EXISTS(SELECT 1 FROM public.waiver_acceptances a WHERE a.rsvp_id=r.id AND a.event_id=e.id AND a.accepted_at IS NOT NULL AND a.accepted_body_sha256 IS NOT NULL))
 OR EXISTS(SELECT 1 FROM public.event_waivers w WHERE w.event_id=e.id AND w.required AND w.archived_at IS NULL AND NOT EXISTS(SELECT 1 FROM public.event_waiver_acceptances a WHERE a.rsvp_id=r.id AND a.event_id=e.id AND a.waiver_id=w.id AND a.version=w.version AND a.content_sha256=w.content_sha256)) THEN 'waiver_required'
 ELSE NULL END FROM public.rsvps r JOIN public.events e ON e.id=r.event_id WHERE r.id=_rsvp;
$$;
REVOKE ALL ON FUNCTION public.checkin_blocker(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.checkin_blocker(uuid) TO service_role;

-- 2) The published-event pin guard allows content changes only inside replace_event_waiver_version().
DO $$ DECLARE d text; BEGIN
  SELECT pg_get_functiondef('public.host_waiver_event_guard()'::regprocedure) INTO d;
  IF position('gw.waiver_reversion' IN d)=0 THEN
    d := replace(d, 'IF e.status<>''draft'' THEN', 'IF e.status<>''draft'' AND coalesce(current_setting(''gw.waiver_reversion'',true),'''')<>NEW.event_id::text THEN');
    IF position('gw.waiver_reversion' IN d)=0 THEN RAISE EXCEPTION 'guard_patch_failed'; END IF;
    EXECUTE d;
  END IF;
END $$;

-- Registered, not-checked-in attendees who would need to accept a new version.
CREATE OR REPLACE FUNCTION public.waiver_reaccept_count(_event uuid) RETURNS integer LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM events WHERE id=_event AND host_id=auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN (SELECT count(*)::int FROM rsvps WHERE event_id=_event AND status='going' AND checked_in_at IS NULL AND merged_into_rsvp_id IS NULL);
END $$;
REVOKE ALL ON FUNCTION public.waiver_reaccept_count(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.waiver_reaccept_count(uuid) TO authenticated;

-- Host-only: pin a library version onto an attached event waiver. Old versions/acceptances are untouched (immutable table).
-- _expected must equal the re-accept count shown in the confirmation, so a stale confirmation fails closed.
CREATE OR REPLACE FUNCTION public.replace_event_waiver_version(_event uuid, _event_waiver uuid, _library_version integer, _expected integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e events; w event_waivers; v waiver_library_versions; n int;
BEGIN
  IF auth.uid() IS NULL OR EXISTS(SELECT 1 FROM user_suspensions WHERE user_id=auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO e FROM events WHERE id=_event FOR UPDATE;
  IF NOT FOUND OR e.host_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF e.status NOT IN ('draft','published') THEN RAISE EXCEPTION 'event_closed'; END IF;
  SELECT * INTO w FROM event_waivers WHERE id=_event_waiver AND event_id=e.id AND archived_at IS NULL AND library_id IS NOT NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT lv.* INTO v FROM waiver_library_versions lv JOIN waiver_library l ON l.id=lv.waiver_id
    WHERE lv.waiver_id=w.library_id AND lv.version=_library_version AND l.owner_id=e.host_id AND NOT l.archived;
  IF NOT FOUND THEN RAISE EXCEPTION 'waiver_stale'; END IF;
  IF w.library_version=_library_version THEN RETURN w.version; END IF; -- idempotent retry
  SELECT count(*)::int INTO n FROM rsvps WHERE event_id=e.id AND status='going' AND checked_in_at IS NULL AND merged_into_rsvp_id IS NULL;
  IF _expected IS DISTINCT FROM n THEN RAISE EXCEPTION 'reaccept_count_changed'; END IF;
  PERFORM set_config('gw.waiver_reversion', e.id::text, true);
  UPDATE event_waivers SET library_version=v.version, title_en=v.name, title_es=v.name, body_en=v.body_en, body_es=v.body_es, file_path=v.file_path, file_name=v.file_name
    WHERE id=w.id RETURNING * INTO w;
  PERFORM set_config('gw.waiver_reversion', '', true);
  RETURN w.version;
END $$;
REVOKE ALL ON FUNCTION public.replace_event_waiver_version(uuid,uuid,integer,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.replace_event_waiver_version(uuid,uuid,integer,integer) TO authenticated;

-- Attendee (by private code): required waivers whose current version they have not accepted.
CREATE OR REPLACE FUNCTION public.waivers_needing_reaccept(_code text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',w.id,'kind',w.kind,'title_en',w.title_en,'title_es',w.title_es,'body_en',w.body_en,'body_es',w.body_es,
    'has_file',w.file_path IS NOT NULL,'file_name',w.file_name,'required',w.required,'version',w.version) ORDER BY w.position, w.created_at),'[]'::jsonb)
  FROM rsvps r JOIN event_waivers w ON w.event_id=r.event_id AND w.archived_at IS NULL AND w.required
  WHERE length(coalesce(_code,''))>=16 AND r.checkin_code=_code AND r.status='going' AND r.checked_in_at IS NULL AND r.merged_into_rsvp_id IS NULL
    AND NOT EXISTS(SELECT 1 FROM event_waiver_acceptances a WHERE a.rsvp_id=r.id AND a.waiver_id=w.id AND a.version=w.version) $$;
GRANT EXECUTE ON FUNCTION public.waivers_needing_reaccept(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.reaccept_event_waivers(_code text, _accepted jsonb) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r rsvps;
BEGIN
  IF length(coalesce(_code,''))<16 THEN RAISE EXCEPTION 'not_found'; END IF;
  SELECT * INTO r FROM rsvps WHERE checkin_code=_code AND merged_into_rsvp_id IS NULL FOR UPDATE;
  IF NOT FOUND OR r.status<>'going' THEN RAISE EXCEPTION 'not_found'; END IF;
  IF r.checked_in_at IS NOT NULL THEN RETURN true; END IF;
  PERFORM check_event_waivers(r.event_id, _accepted);
  PERFORM store_event_waivers(r.id, _accepted, 'reaccept', NULL);
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.reaccept_event_waivers(text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reaccept_event_waivers(text,jsonb) TO anon, authenticated;

-- 3) Refund request ledger. Requests never mean "refunded": only the provider webhook (service role) sets succeeded/failed.
CREATE TABLE public.refund_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE RESTRICT,
  rsvp_id uuid REFERENCES public.rsvps(id) ON DELETE SET NULL,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE RESTRICT,
  host_id uuid NOT NULL,
  buyer_user_id uuid,
  requested_by uuid,
  source text NOT NULL CHECK (source IN ('attendee','host_cancel','host')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','review','submitted','succeeded','failed')),
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  policy text NOT NULL,
  attempt integer NOT NULL DEFAULT 1,
  idempotency_key text NOT NULL UNIQUE,
  provider_refund_id text UNIQUE,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX refund_requests_one_open ON public.refund_requests(payment_id) WHERE status IN ('pending','review','submitted','succeeded');
CREATE INDEX refund_requests_event_idx ON public.refund_requests(event_id);
GRANT SELECT ON public.refund_requests TO authenticated;
GRANT ALL ON public.refund_requests TO service_role;
ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY refund_requests_host_read ON public.refund_requests FOR SELECT TO authenticated USING (host_id = auth.uid());
CREATE POLICY refund_requests_buyer_read ON public.refund_requests FOR SELECT TO authenticated USING (buyer_user_id = auth.uid());

-- Refundable amount = what the guest paid minus the non-refundable booking/service fee. Policy decides eligibility.
CREATE OR REPLACE FUNCTION public.refund_eligibility(_policy text, _starts timestamptz, _host_cancel boolean) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT CASE WHEN _host_cancel THEN 'full'
    WHEN _policy='24h' AND now() <= _starts - interval '24 hours' THEN 'full'
    WHEN _policy='7d' AND now() <= _starts - interval '7 days' THEN 'full'
    WHEN _policy='custom' THEN 'review'
    ELSE 'none' END $$;

CREATE OR REPLACE FUNCTION public.open_refund_request(_pay payments, _e events, _source text, _host_cancel boolean) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE el text := refund_eligibility(_e.refund_policy, _e.starts_at, _host_cancel); amt int := greatest(_pay.amount_cents - coalesce(_pay.booking_fee_cents,0), 0); rid uuid; ru uuid;
BEGIN
  IF el='none' OR amt=0 OR _pay.status<>'paid' THEN RETURN NULL; END IF;
  SELECT id INTO rid FROM refund_requests WHERE payment_id=_pay.id AND status IN ('pending','review','submitted','succeeded');
  IF rid IS NOT NULL THEN RETURN rid; END IF;
  SELECT user_id INTO ru FROM rsvps WHERE id=_pay.rsvp_id;
  INSERT INTO refund_requests(payment_id,rsvp_id,event_id,host_id,buyer_user_id,requested_by,source,status,amount_cents,lines,policy,attempt,idempotency_key)
  VALUES(_pay.id,_pay.rsvp_id,_e.id,_e.host_id,ru,auth.uid(),_source,CASE WHEN el='review' THEN 'review' ELSE 'pending' END,amt,
    jsonb_build_array(jsonb_build_object('type','ticket_and_addons','cents',amt), jsonb_build_object('type','booking_fee','cents',coalesce(_pay.booking_fee_cents,0),'refundable',false)),
    coalesce(_e.refund_policy,'none'), 1, 'refund:'||_pay.id||':1')
  RETURNING id INTO rid;
  RETURN rid;
END $$;
REVOKE ALL ON FUNCTION public.open_refund_request(payments,events,text,boolean) FROM PUBLIC, anon, authenticated;

-- Attendee cancels by private code. Idempotent; frees the seat (existing rsvp_freed trigger promotes the waitlist).
CREATE OR REPLACE FUNCTION public.cancel_my_registration(_code text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r rsvps; e events; p payments; rid uuid; st text;
BEGIN
  IF length(coalesce(_code,''))<16 THEN RETURN jsonb_build_object('result','not_found'); END IF;
  SELECT * INTO r FROM rsvps WHERE checkin_code=_code AND merged_into_rsvp_id IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('result','not_found'); END IF;
  SELECT * INTO e FROM events WHERE id=r.event_id;
  IF r.checked_in_at IS NOT NULL THEN RETURN jsonb_build_object('result','checked_in'); END IF;
  IF r.status<>'cancelled' THEN UPDATE rsvps SET status='cancelled' WHERE id=r.id; END IF;
  SELECT * INTO p FROM payments WHERE rsvp_id=r.id AND kind='gathering' AND status='paid' ORDER BY created_at DESC LIMIT 1;
  IF FOUND THEN rid := open_refund_request(p, e, 'attendee', false); END IF;
  SELECT status INTO st FROM refund_requests WHERE id=rid;
  RETURN jsonb_build_object('result','cancelled','refund', coalesce(st, CASE WHEN p.id IS NULL THEN 'free' ELSE 'not_eligible' END));
END $$;
REVOKE ALL ON FUNCTION public.cancel_my_registration(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_my_registration(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.event_cancellation_summary(_event uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM events WHERE id=_event AND host_id=auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN jsonb_build_object(
    'going',(SELECT count(*) FROM rsvps WHERE event_id=_event AND status='going' AND merged_into_rsvp_id IS NULL),
    'waitlist',(SELECT count(*) FROM rsvps WHERE event_id=_event AND status='waitlist' AND merged_into_rsvp_id IS NULL),
    'paid',(SELECT count(*) FROM payments WHERE event_id=_event AND kind='gathering' AND status='paid'),
    'refundable_cents',(SELECT coalesce(sum(greatest(amount_cents-coalesce(booking_fee_cents,0),0)),0) FROM payments WHERE event_id=_event AND kind='gathering' AND status='paid'),
    'refunds',(SELECT coalesce(jsonb_object_agg(status,n),'{}'::jsonb) FROM (SELECT status,count(*) n FROM refund_requests WHERE event_id=_event GROUP BY status) s));
END $$;
REVOKE ALL ON FUNCTION public.event_cancellation_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.event_cancellation_summary(uuid) TO authenticated;

-- Host cancels the whole event: typed confirmation must match the title; stops registration; opens one refund request per paid booking.
CREATE OR REPLACE FUNCTION public.cancel_event_with_refunds(_event uuid, _confirm text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e events; p payments; n int := 0;
BEGIN
  SELECT * INTO e FROM events WHERE id=_event FOR UPDATE;
  IF NOT FOUND OR auth.uid() IS NULL OR e.host_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF lower(btrim(coalesce(_confirm,''))) <> lower(btrim(e.title)) THEN RAISE EXCEPTION 'confirm_mismatch'; END IF;
  IF e.status NOT IN ('published','cancelled') THEN RAISE EXCEPTION 'event_closed'; END IF;
  IF e.status<>'cancelled' THEN UPDATE events SET status='cancelled' WHERE id=e.id; END IF;
  FOR p IN SELECT * FROM payments WHERE event_id=e.id AND kind='gathering' AND status='paid'
    AND NOT EXISTS(SELECT 1 FROM refund_requests q WHERE q.payment_id=payments.id AND q.status IN ('pending','review','submitted','succeeded')) LOOP
    IF open_refund_request(p, e, 'host_cancel', true) IS NOT NULL THEN n := n+1; END IF;
  END LOOP;
  RETURN jsonb_build_object('result','cancelled','refund_requests',n);
END $$;
REVOKE ALL ON FUNCTION public.cancel_event_with_refunds(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_event_with_refunds(uuid,text) TO authenticated;

-- Host retries a failed refund: a new attempt row with a new idempotency key; never while one is open or succeeded.
CREATE OR REPLACE FUNCTION public.retry_refund_request(_id uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE q refund_requests; nid uuid;
BEGIN
  SELECT * INTO q FROM refund_requests WHERE id=_id FOR UPDATE;
  IF NOT FOUND OR auth.uid() IS NULL OR q.host_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF q.status<>'failed' THEN RAISE EXCEPTION 'not_retryable'; END IF;
  SELECT id INTO nid FROM refund_requests WHERE payment_id=q.payment_id AND status IN ('pending','review','submitted','succeeded');
  IF nid IS NOT NULL THEN RETURN nid; END IF;
  INSERT INTO refund_requests(payment_id,rsvp_id,event_id,host_id,buyer_user_id,requested_by,source,status,amount_cents,lines,policy,attempt,idempotency_key)
  VALUES(q.payment_id,q.rsvp_id,q.event_id,q.host_id,q.buyer_user_id,auth.uid(),q.source,'pending',q.amount_cents,q.lines,q.policy,q.attempt+1,'refund:'||q.payment_id||':'||(q.attempt+1))
  RETURNING id INTO nid;
  RETURN nid;
END $$;
REVOKE ALL ON FUNCTION public.retry_refund_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.retry_refund_request(uuid) TO authenticated;

-- Host approves a custom-policy request for submission (review -> pending). Still not "refunded".
CREATE OR REPLACE FUNCTION public.approve_refund_request(_id uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE q refund_requests;
BEGIN
  SELECT * INTO q FROM refund_requests WHERE id=_id FOR UPDATE;
  IF NOT FOUND OR auth.uid() IS NULL OR q.host_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF q.status='review' THEN UPDATE refund_requests SET status='pending', updated_at=now() WHERE id=q.id; RETURN 'pending'; END IF;
  RETURN q.status;
END $$;
REVOKE ALL ON FUNCTION public.approve_refund_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_refund_request(uuid) TO authenticated;

-- Provider confirmation only (service role, from the verified webhook).
CREATE OR REPLACE FUNCTION public.confirm_refund_request(_payment uuid, _provider_refund text, _status text, _reason text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF _status NOT IN ('succeeded','failed') THEN RAISE EXCEPTION 'invalid_status'; END IF;
  UPDATE refund_requests SET status=_status, provider_refund_id=coalesce(provider_refund_id,_provider_refund), failure_reason=CASE WHEN _status='failed' THEN left(coalesce(_reason,'failed'),200) END, updated_at=now()
   WHERE payment_id=_payment AND status IN ('pending','submitted');
END $$;
REVOKE ALL ON FUNCTION public.confirm_refund_request(uuid,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_refund_request(uuid,text,text,text) TO service_role;

-- Attendee booking view (by private code): policy, cutoff, what was paid, what is refundable, current refund state.
CREATE OR REPLACE FUNCTION public.registration_cancel_preview(_code text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE r rsvps; e events; p payments; q refund_requests;
BEGIN
  IF length(coalesce(_code,''))<16 THEN RETURN NULL; END IF;
  SELECT * INTO r FROM rsvps WHERE checkin_code=_code AND merged_into_rsvp_id IS NULL;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO e FROM events WHERE id=r.event_id;
  SELECT * INTO p FROM payments WHERE rsvp_id=r.id AND kind='gathering' AND status IN ('paid','refunded') ORDER BY created_at DESC LIMIT 1;
  SELECT * INTO q FROM refund_requests WHERE rsvp_id=r.id ORDER BY attempt DESC LIMIT 1;
  RETURN jsonb_build_object('policy', coalesce(e.refund_policy,'none'), 'starts_at', e.starts_at, 'event_status', e.status,
    'checked_in', r.checked_in_at IS NOT NULL, 'status', r.status,
    'paid_cents', p.amount_cents, 'booking_fee_cents', p.booking_fee_cents,
    'eligibility', CASE WHEN p.id IS NULL THEN 'free' ELSE refund_eligibility(e.refund_policy, e.starts_at, e.status='cancelled') END,
    'refund_status', q.status, 'refund_cents', q.amount_cents);
END $$;
GRANT EXECUTE ON FUNCTION public.registration_cancel_preview(text) TO anon, authenticated;
