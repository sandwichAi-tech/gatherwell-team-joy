-- Registration milestone part A: consent/tier columns, terms text, capacity rules.

ALTER TABLE public.rsvps
  ADD COLUMN terms_version_id uuid REFERENCES public.consent_text_versions(id) ON DELETE SET NULL,
  ADD COLUMN terms_accepted_at timestamptz,
  ADD COLUMN updates_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN cancelled_by uuid,
  ADD COLUMN cancel_reason text,
  ADD COLUMN tier_id text;

INSERT INTO public.consent_text_versions (kind, team_id, version, locale, body, body_sha256, effective_from)
SELECT v.kind, NULL, 1, v.locale, v.body, encode(digest(v.body,'sha256'),'hex'), now()
FROM (VALUES
  ('terms','en','I agree to the ZoheeWell Terms of Service and Privacy Policy.'),
  ('terms','es','Acepto los Términos de servicio y la Política de privacidad de ZoheeWell.')
) AS v(kind, locale, body)
WHERE NOT EXISTS (SELECT 1 FROM public.consent_text_versions c WHERE c.kind=v.kind AND c.team_id IS NULL AND c.version=1 AND c.locale=v.locale);

CREATE OR REPLACE FUNCTION public.rsvp_event(_event_id uuid, _first text, _last text, _phone text, _email text, _language text, _plus_ones integer, _status text, _sms boolean, _mail boolean)
 RETURNS TABLE(code text, status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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
  IF NOT FOUND OR e.status <> 'published' OR NOT (_svc OR e.visibility = 'public' OR (e.visibility = 'invite' AND current_setting('gw.invite', true) = _event_id::text) OR (_uid IS NOT NULL AND public.can_rsvp_event(_event_id))) THEN
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
    IF NOT coalesce(e.waitlist_enabled, true) THEN RAISE EXCEPTION 'event_full'; END IF;
    _st := 'waitlist';
    _plan_hit := e.capacity IS NULL OR public.event_seats_used(_event_id) - _held + 1 + _plus_ones <= e.capacity;
  END IF;
  IF _st = 'going' AND NOT (_svc AND e.price_cents IS NOT NULL) AND current_setting('gw.force_waitlist', true) = 'on' THEN
    IF NOT coalesce(e.waitlist_enabled, true) THEN RAISE EXCEPTION 'event_full'; END IF;
    _st := 'waitlist';
  END IF;
  IF e.require_approval AND NOT _svc AND _st IN ('going','waitlist') AND NOT (_uid IS NOT NULL AND public.can_manage_event(_event_id))
     AND coalesce(_ex_status,'') NOT IN ('going','waitlist') THEN _st := 'requested'; _plan_hit := false; END IF;
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
  IF _st = 'requested' THEN PERFORM public.notify_rsvp_request(_id); ELSE PERFORM public.queue_rsvp_notices(_id, CASE WHEN _st = 'waitlist' THEN 'rsvp_waitlisted' ELSE 'rsvp_confirmed' END); END IF;
  RETURN QUERY SELECT _code, _st;
END; $function$;