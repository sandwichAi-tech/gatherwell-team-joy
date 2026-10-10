ALTER TABLE public.rsvps ADD COLUMN IF NOT EXISTS wants_buddy boolean NOT NULL DEFAULT false;
ALTER TABLE public.rsvps ADD COLUMN IF NOT EXISTS buddy_rsvp_id uuid REFERENCES public.rsvps(id) ON DELETE SET NULL;
ALTER TABLE public.rsvps ADD COLUMN IF NOT EXISTS small_group text CHECK (small_group IS NULL OR length(small_group) BETWEEN 1 AND 40);
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS small_groups text[] NOT NULL DEFAULT '{}' CHECK (cardinality(small_groups) <= 12);

CREATE OR REPLACE FUNCTION public.rsvp_person_key(_r public.rsvps) RETURNS text LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT coalesce('u:' || _r.user_id::text, public.guest_key_of(_r.guest_email, _r.guest_phone));
$$;

-- Per-guest belonging facts for a host's gathering
CREATE OR REPLACE FUNCTION public.rsvp_belonging(_event uuid)
RETURNS TABLE(rsvp_id uuid, first_time boolean, checkins integer, regular boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _host uuid;
BEGIN
  IF NOT public.can_manage_event(_event) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  SELECT host_id INTO _host FROM events WHERE id = _event;
  RETURN QUERY
  WITH mine AS (SELECT r.id, public.rsvp_person_key(r) k, r.created_at FROM rsvps r WHERE r.event_id = _event),
  hist AS (
    SELECT public.rsvp_person_key(r) k, r.event_id, r.created_at, r.checked_in_at, r.status
    FROM rsvps r JOIN events e ON e.id = r.event_id WHERE e.host_id = _host
  )
  SELECT m.id,
    NOT EXISTS (SELECT 1 FROM hist h WHERE h.k = m.k AND h.event_id <> _event AND h.created_at < m.created_at AND h.status NOT IN ('cancelled','declined')),
    (SELECT count(*)::int FROM hist h WHERE h.k = m.k AND h.checked_in_at IS NOT NULL),
    (SELECT count(*) FROM hist h WHERE h.k = m.k AND h.checked_in_at IS NOT NULL) >= 3
  FROM mine m WHERE m.k IS NOT NULL;
END $$;
GRANT EXECUTE ON FUNCTION public.rsvp_belonging(uuid) TO authenticated;

-- Guest-facing: is this their first time with this host?
CREATE OR REPLACE FUNCTION public.rsvp_first_time(_code text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r rsvps; _host uuid; _name text; _first boolean;
BEGIN
  SELECT * INTO r FROM rsvps WHERE checkin_code = _code; IF r.id IS NULL THEN RETURN NULL; END IF;
  SELECT e.host_id, p.full_name INTO _host, _name FROM events e LEFT JOIN profiles p ON p.id = e.host_id WHERE e.id = r.event_id;
  SELECT NOT EXISTS (SELECT 1 FROM rsvps o JOIN events e ON e.id = o.event_id WHERE e.host_id = _host AND o.event_id <> r.event_id
    AND public.rsvp_person_key(o) = public.rsvp_person_key(r) AND o.created_at < r.created_at AND o.status NOT IN ('cancelled','declined')) INTO _first;
  RETURN jsonb_build_object('first_time', _first, 'host', split_part(coalesce(_name,''),' ',1), 'wants_buddy', r.wants_buddy);
END $$;
GRANT EXECUTE ON FUNCTION public.rsvp_first_time(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.set_buddy_wish(_code text, _on boolean) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE rsvps SET wants_buddy = coalesce(_on,false) WHERE checkin_code = _code AND status IN ('going','maybe','waitlist','requested');
$$;
GRANT EXECUTE ON FUNCTION public.set_buddy_wish(text, boolean) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.notify_rsvp_person(_r public.rsvps, _template text, _payload jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _email text := _r.guest_email;
BEGIN
  IF _email IS NULL AND _r.user_id IS NOT NULL THEN SELECT email INTO _email FROM auth.users WHERE id = _r.user_id; END IF;
  IF nullif(trim(coalesce(_email,'')),'') IS NOT NULL THEN
    PERFORM public.enqueue_message('email', _email, _r.language, _template, 'transactional', _payload, now(), _r.event_id, _r.id, _r.user_id);
  ELSIF _r.sms_opt_in AND nullif(trim(coalesce(_r.guest_phone,'')),'') IS NOT NULL THEN
    PERFORM public.enqueue_message('sms', _r.guest_phone, _r.language, _template, 'transactional', _payload, now(), _r.event_id, _r.id, _r.user_id);
  END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.notify_rsvp_person(public.rsvps, text, jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.pair_buddy(_rsvp uuid, _buddy uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a rsvps; b rsvps; _title text; _starts timestamptz;
BEGIN
  SELECT * INTO a FROM rsvps WHERE id = _rsvp;
  IF a.id IS NULL OR NOT public.can_manage_event(a.event_id) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  IF a.buddy_rsvp_id IS NOT NULL THEN UPDATE rsvps SET buddy_rsvp_id = NULL WHERE id = a.buddy_rsvp_id; END IF;
  IF _buddy IS NULL THEN UPDATE rsvps SET buddy_rsvp_id = NULL WHERE id = _rsvp; RETURN; END IF;
  SELECT * INTO b FROM rsvps WHERE id = _buddy AND event_id = a.event_id AND id <> a.id;
  IF b.id IS NULL THEN RAISE EXCEPTION 'invalid_buddy'; END IF;
  IF b.buddy_rsvp_id IS NOT NULL THEN UPDATE rsvps SET buddy_rsvp_id = NULL WHERE id = b.buddy_rsvp_id; END IF;
  UPDATE rsvps SET buddy_rsvp_id = b.id WHERE id = a.id;
  UPDATE rsvps SET buddy_rsvp_id = a.id WHERE id = b.id;
  SELECT title, starts_at INTO _title, _starts FROM events WHERE id = a.event_id;
  PERFORM public.notify_rsvp_person(a, 'buddy_intro', jsonb_build_object('name', split_part(coalesce(a.guest_name,''),' ',1), 'buddy', split_part(coalesce(b.guest_name,''),' ',1), 'title', _title, 'starts_at', _starts, 'event_id', a.event_id, 'code', a.checkin_code, 'first_timer', true));
  PERFORM public.notify_rsvp_person(b, 'buddy_intro', jsonb_build_object('name', split_part(coalesce(b.guest_name,''),' ',1), 'buddy', split_part(coalesce(a.guest_name,''),' ',1), 'title', _title, 'starts_at', _starts, 'event_id', a.event_id, 'code', b.checkin_code, 'first_timer', false));
END $$;
GRANT EXECUTE ON FUNCTION public.pair_buddy(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_small_groups(_event uuid, _groups text[]) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _clean text[];
BEGIN
  IF NOT public.can_manage_event(_event) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  SELECT coalesce(array_agg(DISTINCT left(trim(g),40)), '{}') INTO _clean FROM unnest(coalesce(_groups,'{}')) g WHERE trim(g) <> '';
  IF cardinality(_clean) > 12 THEN RAISE EXCEPTION 'too_many'; END IF;
  UPDATE events SET small_groups = _clean WHERE id = _event;
  UPDATE rsvps SET small_group = NULL WHERE event_id = _event AND small_group IS NOT NULL AND NOT (small_group = ANY(_clean));
END $$;
GRANT EXECUTE ON FUNCTION public.set_small_groups(uuid, text[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.assign_small_group(_rsvp uuid, _group text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _ev uuid; _gs text[];
BEGIN
  SELECT r.event_id, e.small_groups INTO _ev, _gs FROM rsvps r JOIN events e ON e.id = r.event_id WHERE r.id = _rsvp;
  IF _ev IS NULL OR NOT public.can_manage_event(_ev) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  IF _group IS NOT NULL AND NOT (_group = ANY(_gs)) THEN RAISE EXCEPTION 'invalid_group'; END IF;
  UPDATE rsvps SET small_group = _group WHERE id = _rsvp;
END $$;
GRANT EXECUTE ON FUNCTION public.assign_small_group(uuid, text) TO authenticated;

-- Member profile: hosts where I'm a regular
CREATE OR REPLACE FUNCTION public.my_regular_hosts() RETURNS TABLE(host_id uuid, host_name text, checkins integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT e.host_id, p.full_name, count(*)::int
  FROM rsvps r JOIN events e ON e.id = r.event_id LEFT JOIN profiles p ON p.id = e.host_id
  WHERE r.checked_in_at IS NOT NULL AND e.host_id <> auth.uid()
    AND (r.user_id = auth.uid() OR lower(r.guest_email) = lower((SELECT email FROM auth.users WHERE id = auth.uid())))
  GROUP BY e.host_id, p.full_name HAVING count(*) >= 3 ORDER BY 3 DESC LIMIT 12;
$$;
GRANT EXECUTE ON FUNCTION public.my_regular_hosts() TO authenticated;

-- First-timer "what to expect" message
CREATE OR REPLACE FUNCTION public.first_timer_welcome() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _host uuid; _hname text; _title text; _starts timestamptz; _loc text; _note text;
BEGIN
  IF NEW.status NOT IN ('going','maybe') OR NEW.is_walk_in THEN RETURN NEW; END IF;
  SELECT e.host_id, p.full_name, e.title, e.starts_at, e.location_name, e.meeting_note INTO _host, _hname, _title, _starts, _loc, _note
    FROM events e LEFT JOIN profiles p ON p.id = e.host_id WHERE e.id = NEW.event_id;
  IF _host = NEW.user_id THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM rsvps o JOIN events e ON e.id = o.event_id WHERE e.host_id = _host AND o.id <> NEW.id AND o.event_id <> NEW.event_id
      AND public.rsvp_person_key(o) = public.rsvp_person_key(NEW) AND o.status NOT IN ('cancelled','declined')) THEN RETURN NEW; END IF;
  PERFORM public.notify_rsvp_person(NEW, 'first_timer_welcome', jsonb_build_object('name', split_part(coalesce(NEW.guest_name,''),' ',1), 'host', split_part(coalesce(_hname,''),' ',1), 'title', _title, 'starts_at', _starts, 'location', _loc, 'note', _note, 'event_id', NEW.event_id, 'code', NEW.checkin_code));
  RETURN NEW;
EXCEPTION WHEN others THEN RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS rsvps_first_timer_welcome ON public.rsvps;
CREATE TRIGGER rsvps_first_timer_welcome AFTER INSERT ON public.rsvps FOR EACH ROW EXECUTE FUNCTION public.first_timer_welcome();