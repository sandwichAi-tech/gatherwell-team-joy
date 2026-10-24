-- Registration milestone part B: registration entry point, host cancellation, My tickets.

CREATE OR REPLACE FUNCTION public.register_attendance(
  _event_id uuid, _first text, _last text, _phone text, _email text, _language text,
  _plus_ones integer, _status text, _sms boolean, _mail boolean,
  _waiver_name text, _answers jsonb, _token text,
  _terms_ok boolean, _updates_opt_in boolean, _tier_id text)
RETURNS TABLE(code text, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE _e public.events; _ver uuid; _code text; _st text; _tier jsonb; _tused int; _seats int;
BEGIN
  IF _terms_ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'terms_required'; END IF;
  SELECT c.id INTO _ver FROM public.consent_text_versions c
    WHERE c.kind = 'terms' AND c.team_id IS NULL AND c.locale = coalesce(nullif(_language,''),'en')
    ORDER BY c.version DESC, c.created_at DESC LIMIT 1;
  IF _ver IS NULL THEN
    SELECT c.id INTO _ver FROM public.consent_text_versions c WHERE c.kind = 'terms' AND c.team_id IS NULL ORDER BY c.version DESC, c.created_at DESC LIMIT 1;
  END IF;
  IF _ver IS NULL THEN RAISE EXCEPTION 'terms_required'; END IF;

  SELECT * INTO _e FROM public.events WHERE id = _event_id FOR UPDATE;
  IF _e.id IS NULL THEN RAISE EXCEPTION 'not_open'; END IF;

  IF coalesce(jsonb_array_length(_e.ticket_tiers), 0) > 0 THEN
    IF nullif(trim(coalesce(_tier_id,'')), '') IS NULL THEN RAISE EXCEPTION 'tier_required'; END IF;
    SELECT t INTO _tier FROM jsonb_array_elements(_e.ticket_tiers) t WHERE t->>'id' = _tier_id;
    IF _tier IS NULL THEN RAISE EXCEPTION 'tier_required'; END IF;
    IF nullif(_tier->>'sale_starts_at','') IS NOT NULL AND now() < (_tier->>'sale_starts_at')::timestamptz THEN RAISE EXCEPTION 'registration_not_open'; END IF;
    IF nullif(_tier->>'sale_ends_at','') IS NOT NULL AND now() > (_tier->>'sale_ends_at')::timestamptz THEN RAISE EXCEPTION 'registration_closed'; END IF;
    IF coalesce((_tier->>'price_cents')::int, 0) > 0 AND _status = 'going' THEN RAISE EXCEPTION 'payment_required'; END IF;
    IF nullif(_tier->>'quantity','') IS NOT NULL AND _status = 'going' THEN
      _seats := 1 + greatest(0, least(coalesce(_plus_ones,0), 3));
      SELECT coalesce(sum(1 + r.plus_ones), 0) INTO _tused FROM public.rsvps r
        WHERE r.event_id = _event_id AND r.tier_id = _tier_id AND r.status = 'going' AND r.merged_into_rsvp_id IS NULL;
      IF _tused + _seats > (_tier->>'quantity')::int THEN
        IF NOT coalesce(_e.waitlist_enabled, true) THEN RAISE EXCEPTION 'event_full'; END IF;
        PERFORM set_config('gw.force_waitlist', 'on', true);
      END IF;
    END IF;
  END IF;

  SELECT r.code, r.status INTO _code, _st FROM public.rsvp_event_full(
    _event_id, _first, _last, _phone, _email, _language, _plus_ones, _status, _sms, _mail, _waiver_name, _answers, _token) r;

  UPDATE public.rsvps SET
    terms_version_id = _ver,
    terms_accepted_at = now(),
    updates_opt_in = coalesce(_updates_opt_in, false),
    tier_id = nullif(trim(coalesce(_tier_id,'')), '')
  WHERE checkin_code = _code;

  RETURN QUERY SELECT _code, _st;
END; $fn$;

GRANT EXECUTE ON FUNCTION public.register_attendance(uuid,text,text,text,text,text,integer,text,boolean,boolean,text,jsonb,text,boolean,boolean,text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.host_cancel_rsvp(_rsvp uuid, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE _r public.rsvps;
BEGIN
  SELECT * INTO _r FROM public.rsvps WHERE id = _rsvp;
  IF _r.id IS NULL OR NOT public.can_manage_event(_r.event_id) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  IF _r.status = 'cancelled' THEN RETURN; END IF;
  UPDATE public.rsvps SET status = 'cancelled', cancelled_by = auth.uid(), cancel_reason = nullif(left(trim(coalesce(_reason,'')), 500), '')
  WHERE id = _rsvp;
  PERFORM public.queue_rsvp_notices(_rsvp, 'rsvp_cancelled_by_host');
END; $fn$;

GRANT EXECUTE ON FUNCTION public.host_cancel_rsvp(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.my_tickets()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  RETURN coalesce((SELECT jsonb_agg(t.payload ORDER BY t.starts_at) FROM (
    SELECT e.starts_at, jsonb_build_object(
      'id', r.id, 'event_id', r.event_id, 'status', r.status, 'plus_ones', r.plus_ones,
      'checkin_code', r.checkin_code, 'language', r.language, 'created_at', r.created_at,
      'waitlist_position', public.waitlist_position(r.checkin_code),
      'tier_name', (SELECT x->>'name' FROM jsonb_array_elements(e.ticket_tiers) x WHERE x->>'id' = r.tier_id),
      'waiver', (SELECT jsonb_build_object('version', w.version, 'accepted_at', w.accepted_at) FROM public.waiver_acceptances w WHERE w.rsvp_id = r.id ORDER BY w.accepted_at DESC LIMIT 1),
      'terms_version', tv.version, 'terms_accepted_at', r.terms_accepted_at,
      'cancelled_by_host', r.cancelled_by IS NOT NULL AND r.cancelled_by IS DISTINCT FROM r.user_id,
      'cancel_reason', CASE WHEN r.cancelled_by IS NOT NULL AND r.cancelled_by IS DISTINCT FROM r.user_id THEN r.cancel_reason END,
      'event', jsonb_build_object('id', e.id, 'title', e.title, 'starts_at', e.starts_at, 'ends_at', e.ends_at, 'timezone', e.timezone,
        'location_name', e.location_name, 'address', e.address, 'meeting_note', e.meeting_note,
        'online_url', CASE WHEN r.status IN ('going','maybe') THEN e.online_url END,
        'cover_url', e.cover_url, 'cover_style', e.cover_style, 'status', e.status, 'capacity', e.capacity)
    ) AS payload
    FROM public.rsvps r
    JOIN public.events e ON e.id = r.event_id
    LEFT JOIN public.consent_text_versions tv ON tv.id = r.terms_version_id
    WHERE r.user_id = auth.uid() AND r.merged_into_rsvp_id IS NULL
  ) t), '[]'::jsonb);
END; $fn$;

GRANT EXECUTE ON FUNCTION public.my_tickets() TO authenticated;