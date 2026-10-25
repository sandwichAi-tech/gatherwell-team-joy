-- Server-only resolver for waiver document paths; the path itself never reaches the browser.
CREATE OR REPLACE FUNCTION public.event_waiver_file_path(_waiver uuid, _token text, _code text, _version int) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w record; e record; _p text;
BEGIN
  IF length(coalesce(_code,'')) >= 6 AND _version IS NOT NULL THEN
    SELECT v.file_path INTO _p FROM public.event_waiver_versions v
      JOIN public.event_waiver_acceptances a ON a.waiver_id = v.waiver_id AND a.version = v.version
      JOIN public.rsvps r ON r.id = a.rsvp_id
      WHERE v.waiver_id = _waiver AND v.version = _version AND r.checkin_code = _code;
    RETURN _p;
  END IF;
  SELECT id, event_id, file_path INTO w FROM public.event_waivers WHERE id = _waiver AND archived_at IS NULL;
  IF NOT FOUND OR w.file_path IS NULL THEN RETURN NULL; END IF;
  PERFORM public.unlock_invite(w.event_id, _token);
  SELECT visibility, status INTO e FROM public.events WHERE id = w.event_id;
  IF (e.visibility = 'public' OR (e.visibility = 'invite' AND current_setting('gw.invite', true) = w.event_id::text)) AND e.status IN ('published','cancelled') THEN
    RETURN w.file_path;
  END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.event_waiver_file_path(uuid, text, text, int) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_waiver_file_path(uuid, text, text, int) TO service_role;