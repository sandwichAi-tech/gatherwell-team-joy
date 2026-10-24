CREATE OR REPLACE FUNCTION public.rsvp_event_minor(_event_id uuid, _minor_first text, _minor_age_band text, _guardian_name text, _guardian_relationship text, _guardian_email text, _guardian_phone text, _language text, _sms boolean, _mail boolean, _token text)
 RETURNS TABLE(code text, status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _e public.events; _code text; _st text; _rid uuid; _ver uuid;
BEGIN
  PERFORM public.unlock_invite(_event_id, _token);
  SELECT * INTO _e FROM public.events ev WHERE ev.id = _event_id AND ev.status = 'published';
  IF _e.id IS NULL THEN RAISE EXCEPTION 'not_allowed'; END IF;
  IF NOT _e.allows_minors THEN RAISE EXCEPTION 'minors_not_allowed'; END IF;
  IF _e.reg_opens_at IS NOT NULL AND now() < _e.reg_opens_at THEN RAISE EXCEPTION 'registration_not_open'; END IF;
  IF _e.reg_closes_at IS NOT NULL AND now() > _e.reg_closes_at THEN RAISE EXCEPTION 'registration_closed'; END IF;
  IF _e.min_age IS NOT NULL AND _minor_age_band = 'under_5' AND _e.min_age >= 5 THEN RAISE EXCEPTION 'min_age_not_met'; END IF;
  IF _e.min_age IS NOT NULL AND _minor_age_band = '5_12' AND _e.min_age >= 13 THEN RAISE EXCEPTION 'min_age_not_met'; END IF;
  IF length(trim(coalesce(_minor_first,''))) = 0 OR length(_minor_first) > 40 THEN RAISE EXCEPTION 'minor_details_incomplete'; END IF;
  IF _minor_age_band NOT IN ('under_5','5_12','13_17') THEN RAISE EXCEPTION 'minor_details_incomplete'; END IF;
  IF length(trim(coalesce(_guardian_name,''))) < 2 OR length(_guardian_name) > 120 THEN RAISE EXCEPTION 'guardian_details_incomplete'; END IF;
  IF length(trim(coalesce(_guardian_relationship,''))) = 0 OR length(_guardian_relationship) > 60 THEN RAISE EXCEPTION 'guardian_details_incomplete'; END IF;
  IF length(trim(coalesce(_guardian_email,''))) = 0 AND length(trim(coalesce(_guardian_phone,''))) = 0 THEN RAISE EXCEPTION 'guardian_details_incomplete'; END IF;

  SELECT c.id INTO _ver FROM public.consent_text_versions c
    WHERE c.kind = 'guardian' AND c.locale = coalesce(nullif(_language,''), 'en')
    ORDER BY c.version DESC, c.created_at DESC LIMIT 1;
  IF _ver IS NULL THEN
    SELECT c.id INTO _ver FROM public.consent_text_versions c WHERE c.kind = 'guardian' ORDER BY c.version DESC, c.created_at DESC LIMIT 1;
  END IF;
  IF _ver IS NULL THEN RAISE EXCEPTION 'guardian_consent_required'; END IF;

  SELECT r.code, r.status INTO _code, _st FROM public.rsvp_event_waiver(
    _event_id, trim(_guardian_name), '', trim(coalesce(_guardian_phone,'')), trim(coalesce(_guardian_email,'')),
    coalesce(nullif(_language,''),'en'), 0, 'going', _sms, _mail, '') r;

  UPDATE public.rsvps SET
    minor_first_name = left(trim(_minor_first), 40),
    minor_age_band = _minor_age_band,
    guardian_name = left(trim(_guardian_name), 120),
    guardian_relationship = left(trim(_guardian_relationship), 60),
    guardian_email = nullif(left(trim(coalesce(_guardian_email,'')),200),''),
    guardian_phone = nullif(left(trim(coalesce(_guardian_phone,'')),30),''),
    guardian_consent_at = now(),
    guardian_consent_version_id = _ver
  WHERE checkin_code = _code;

  RETURN QUERY SELECT _code, _st;
END; $function$;