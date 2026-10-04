CREATE OR REPLACE FUNCTION public.rsvp_event(_event_id uuid, _first text, _last text, _phone text, _email text,
  _language text, _plus_ones int, _status text, _sms boolean, _mail boolean)
RETURNS TABLE (code text, status text) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e record; _name text; _uid uuid := auth.uid(); _st text; _id uuid; _code text;
  _ex_id uuid; _ex_status text; _ex_plus int; _held int := 0;
BEGIN
  _name := trim(coalesce(_first,'') || ' ' || coalesce(_last,''));
  IF coalesce(trim(_first),'') = '' OR length(_name) > 120 THEN RAISE EXCEPTION 'name_required'; END IF;
  IF nullif(trim(_phone),'') IS NULL AND nullif(trim(_email),'') IS NULL THEN RAISE EXCEPTION 'contact_required'; END IF;
  IF length(coalesce(_phone,'')) > 30 OR length(coalesce(_email,'')) > 200 THEN RAISE EXCEPTION 'too_long'; END IF;
  IF nullif(trim(_email),'') IS NOT NULL AND trim(_email) !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'invalid_email'; END IF;
  IF _status NOT IN ('going','maybe') THEN RAISE EXCEPTION 'invalid_status'; END IF;
  SELECT * INTO e FROM public.events WHERE id = _event_id FOR UPDATE;
  IF NOT FOUND OR e.status <> 'published' OR NOT (e.visibility = 'public' OR (_uid IS NOT NULL AND public.can_rsvp_event(_event_id))) THEN
    RAISE EXCEPTION 'not_open';
  END IF;
  _plus_ones := greatest(0, least(coalesce(_plus_ones,0), 3));
  _st := _status;
  IF _uid IS NOT NULL THEN
    SELECT r.id, r.status, r.plus_ones INTO _ex_id, _ex_status, _ex_plus FROM public.rsvps r WHERE r.event_id = _event_id AND r.user_id = _uid LIMIT 1;
  END IF;
  IF _ex_id IS NOT NULL AND _ex_status = 'going' THEN _held := 1 + _ex_plus; END IF;
  IF _st = 'going' AND e.capacity IS NOT NULL AND public.event_seats_used(_event_id) - _held + 1 + _plus_ones > e.capacity THEN
    _st := 'waitlist';
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
  PERFORM public.queue_rsvp_notices(_id, CASE WHEN _st = 'waitlist' THEN 'rsvp_waitlisted' ELSE 'rsvp_confirmed' END);
  RETURN QUERY SELECT _code, _st;
END; $$;