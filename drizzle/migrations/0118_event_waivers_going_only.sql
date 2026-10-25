CREATE OR REPLACE FUNCTION public.guard_rsvp_event_waivers() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Only a "going" registration needs the event's required waivers.
  IF NEW.status IS DISTINCT FROM 'going' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'going' THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.event_waivers w WHERE w.event_id = NEW.event_id AND w.archived_at IS NULL AND w.required) THEN RETURN NEW; END IF;
  IF coalesce(current_setting('gw.waivers_ok', true), '') = NEW.event_id::text THEN RETURN NEW; END IF;
  -- Payment webhook (service role) records the buyer's pre-checkout acceptances itself; direct SQL has no request role.
  IF coalesce(auth.role(), '') = 'service_role' OR coalesce(auth.role(), '') = '' THEN RETURN NEW; END IF;
  IF auth.uid() IS NOT NULL AND public.can_manage_event(NEW.event_id) THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND EXISTS (SELECT 1 FROM public.event_waiver_acceptances a WHERE a.rsvp_id = NEW.id) THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'waiver_required';
END $$;

CREATE OR REPLACE FUNCTION public.register_attendance_waivers(_event_id uuid, _first text, _last text, _phone text, _email text, _language text, _plus_ones integer, _status text, _sms boolean, _mail boolean, _waiver_name text, _answers jsonb, _token text, _terms_ok boolean, _updates_opt_in boolean, _tier_id text, _waivers jsonb)
RETURNS TABLE(code text, status text) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _code text; _st text; _rid uuid; _list jsonb := coalesce(_waivers, '[]'::jsonb);
BEGIN
  IF _status = 'going' THEN PERFORM public.check_event_waivers(_event_id, _list);
  ELSIF jsonb_array_length(_list) > 0 THEN PERFORM public.check_event_waivers(_event_id, _list); END IF;
  PERFORM set_config('gw.waivers_ok', _event_id::text, true);
  SELECT r.code, r.status INTO _code, _st FROM public.register_attendance(_event_id, _first, _last, _phone, _email, _language, _plus_ones, _status, _sms, _mail, _waiver_name, _answers, _token, _terms_ok, _updates_opt_in, _tier_id) r;
  PERFORM set_config('gw.waivers_ok', '', true);
  SELECT id INTO _rid FROM public.rsvps WHERE checkin_code = _code;
  PERFORM public.store_event_waivers(_rid, _list, 'rsvp', NULL);
  RETURN QUERY SELECT _code, _st;
END $$;