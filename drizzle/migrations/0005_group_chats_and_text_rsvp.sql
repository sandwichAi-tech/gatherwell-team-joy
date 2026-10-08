
-- 1. Group chat links (several per team / gathering)
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS chat_links jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS chat_links jsonb NOT NULL DEFAULT '[]'::jsonb;
UPDATE public.teams SET chat_links = jsonb_build_array(jsonb_build_object('url', whatsapp_url)) WHERE whatsapp_url IS NOT NULL AND chat_links = '[]'::jsonb;
UPDATE public.events SET chat_links = jsonb_build_array(jsonb_build_object('url', whatsapp_url)) WHERE whatsapp_url IS NOT NULL AND chat_links = '[]'::jsonb;
COMMENT ON COLUMN public.teams.whatsapp_url IS 'DEPRECATED: replaced by chat_links';
COMMENT ON COLUMN public.events.whatsapp_url IS 'DEPRECATED: replaced by chat_links';

CREATE OR REPLACE FUNCTION public.chat_platform(_url text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN _url ~ '^https://chat\.whatsapp\.com/[A-Za-z0-9]{10,40}$' THEN 'whatsapp'
    WHEN _url ~ '^https://(t\.me|telegram\.me)/(\+|joinchat/)?[A-Za-z0-9_-]{4,64}$' THEN 'telegram'
    WHEN _url ~ '^https://signal\.group/#[A-Za-z0-9_-]{10,200}$' THEN 'signal'
    WHEN _url ~ '^https://(web\.)?groupme\.com/join_group/[0-9]+/[A-Za-z0-9]+$' THEN 'groupme'
    WHEN _url ~ '^https://(m\.me/j/[A-Za-z0-9_-]{6,64}|(www\.)?messenger\.com/[A-Za-z0-9_/-]{4,100})$' THEN 'messenger'
    WHEN _url ~ '^https://(discord\.gg|(www\.)?discord\.com/invite)/[A-Za-z0-9-]{2,40}$' THEN 'discord'
    ELSE NULL END $$;

CREATE OR REPLACE FUNCTION public.validate_chat_links() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE l jsonb;
BEGIN
  IF jsonb_typeof(NEW.chat_links) <> 'array' OR jsonb_array_length(NEW.chat_links) > 5 THEN RAISE EXCEPTION 'too_many_links'; END IF;
  FOR l IN SELECT * FROM jsonb_array_elements(NEW.chat_links) LOOP
    IF public.chat_platform(l->>'url') IS NULL THEN RAISE EXCEPTION 'bad_chat_link'; END IF;
  END LOOP;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS validate_chat_links ON public.teams;
CREATE TRIGGER validate_chat_links BEFORE INSERT OR UPDATE OF chat_links ON public.teams FOR EACH ROW EXECUTE FUNCTION public.validate_chat_links();
DROP TRIGGER IF EXISTS validate_chat_links ON public.events;
CREATE TRIGGER validate_chat_links BEFORE INSERT OR UPDATE OF chat_links ON public.events FOR EACH ROW EXECUTE FUNCTION public.validate_chat_links();

-- 2. Text invites with "Reply IN"
CREATE TABLE public.sms_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  phone text NOT NULL,
  name text,
  language text NOT NULL DEFAULT 'en',
  sent_by uuid,
  reply text,
  replied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sms_invites_phone_idx ON public.sms_invites (phone, created_at DESC);
CREATE INDEX sms_invites_event_idx ON public.sms_invites (event_id);
GRANT SELECT ON public.sms_invites TO authenticated;
GRANT ALL ON public.sms_invites TO service_role;
ALTER TABLE public.sms_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Hosts read their gathering text invites" ON public.sms_invites FOR SELECT TO authenticated USING (public.can_manage_event(event_id));

-- People who opted in to texts at this team's gatherings, not opted out, not already on this gathering.
CREATE OR REPLACE FUNCTION public.text_invite_candidates(_event uuid)
RETURNS TABLE(phone text, name text, language text, last_seen timestamptz, invited boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _team uuid;
BEGIN
  IF NOT public.can_manage_event(_event) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT team_id INTO _team FROM public.events WHERE id = _event;
  RETURN QUERY
  SELECT DISTINCT ON (ph) ph, r.guest_name, r.language, r.created_at,
    EXISTS (SELECT 1 FROM public.sms_invites i WHERE i.event_id = _event AND i.phone = ph)
  FROM (SELECT r0.*, public.normalize_phone(r0.guest_phone) AS ph FROM public.rsvps r0
        JOIN public.events e ON e.id = r0.event_id
        WHERE e.team_id = _team AND r0.sms_opt_in AND r0.guest_phone IS NOT NULL) r
  WHERE ph IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.sms_optouts o WHERE o.phone = ph)
    AND NOT EXISTS (SELECT 1 FROM public.rsvps x WHERE x.event_id = _event AND x.status <> 'cancelled' AND public.normalize_phone(x.guest_phone) = ph)
  ORDER BY ph, r.created_at DESC
  LIMIT 300;
END $$;

CREATE OR REPLACE FUNCTION public.send_text_invites(_event uuid, _phones text[])
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e record; c record; _n int := 0; _host text; _path text;
BEGIN
  IF NOT public.can_manage_event(_event) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF coalesce(array_length(_phones,1),0) = 0 OR array_length(_phones,1) > 200 THEN RAISE EXCEPTION 'bad_count'; END IF;
  SELECT * INTO e FROM public.events WHERE id = _event;
  IF e.status <> 'published' OR e.starts_at < now() THEN RAISE EXCEPTION 'not_open'; END IF;
  SELECT full_name INTO _host FROM public.profiles WHERE id = auth.uid();
  _path := '/e/' || e.id || CASE WHEN e.visibility = 'invite' AND e.invite_token IS NOT NULL THEN '?k=' || e.invite_token ELSE '' END;
  FOR c IN SELECT * FROM public.text_invite_candidates(_event) t WHERE t.phone = ANY (SELECT public.normalize_phone(p) FROM unnest(_phones) p) LOOP
    INSERT INTO public.sms_invites (event_id, phone, name, language, sent_by) VALUES (_event, c.phone, c.name, coalesce(c.language,'en'), auth.uid());
    PERFORM public.enqueue_message('sms', c.phone, c.language, 'gathering_invite', 'invite',
      jsonb_build_object('event_id', e.id, 'title', e.title, 'starts_at', e.starts_at, 'timezone', e.timezone, 'host', _host,
        'name', split_part(coalesce(c.name,''),' ',1), 'path', _path), now(), _event, NULL, NULL, e.team_id, NULL);
    _n := _n + 1;
  END LOOP;
  RETURN _n;
END $$;

-- Inbound reply handling: STOP/HELP as before, plus IN / OUT for the latest invite (7 days).
CREATE OR REPLACE FUNCTION public.handle_sms_reply(_from text, _body text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _w text := upper(trim(regexp_replace(coalesce(_body,''), '[^[:alpha:]]', '', 'g')));
  _ph text := public.normalize_phone(_from); i record; e record; r record; _st text; _cap int; _code text; _id uuid; _path text; _needs boolean;
BEGIN
  IF _ph IS NULL THEN RETURN jsonb_build_object('result','ignored'); END IF;
  IF _w IN ('STOP','STOPALL','UNSUBSCRIBE','CANCEL','END','QUIT','CANCELAR','ALTO','BAJA','HELP','INFO','AYUDA','START','UNSTOP','INICIAR') THEN
    RETURN jsonb_build_object('result', public.handle_sms_inbound(_from, _body));
  END IF;
  IF _w NOT IN ('IN','IMIN','YES','SI','SÍ','OUT','NO') THEN RETURN jsonb_build_object('result','ignored'); END IF;
  SELECT si.* INTO i FROM public.sms_invites si JOIN public.events ev ON ev.id = si.event_id
    WHERE si.phone = _ph AND si.created_at > now() - interval '7 days' AND ev.starts_at > now() - interval '2 hours'
    ORDER BY si.created_at DESC LIMIT 1;
  IF i IS NULL THEN
    IF _w IN ('YES','SI','SÍ') THEN RETURN jsonb_build_object('result', public.handle_sms_inbound(_from, _body)); END IF;
    RETURN jsonb_build_object('result','no_invite');
  END IF;
  IF EXISTS (SELECT 1 FROM public.sms_optouts WHERE phone = _ph) THEN RETURN jsonb_build_object('result','opted_out'); END IF;
  SELECT * INTO e FROM public.events WHERE id = i.event_id FOR UPDATE;
  _path := '/e/' || e.id || CASE WHEN e.visibility = 'invite' AND e.invite_token IS NOT NULL THEN '?k=' || e.invite_token ELSE '' END;
  SELECT * INTO r FROM public.rsvps WHERE event_id = e.id AND public.normalize_phone(guest_phone) = _ph ORDER BY created_at DESC LIMIT 1;
  UPDATE public.sms_invites SET reply = _w, replied_at = now() WHERE id = i.id;

  IF _w IN ('OUT','NO') THEN
    IF r IS NOT NULL AND r.status <> 'cancelled' THEN UPDATE public.rsvps SET status = 'cancelled' WHERE id = r.id; END IF;
    PERFORM public.enqueue_message('sms', _ph, i.language, 'text_rsvp_out', 'rsvp', jsonb_build_object('event_id', e.id, 'title', e.title, 'path', _path), now(), e.id, r.id, NULL, e.team_id, NULL);
    RETURN jsonb_build_object('result','cancelled','event_id', e.id);
  END IF;

  IF e.status <> 'published' THEN
    PERFORM public.enqueue_message('sms', _ph, i.language, 'text_rsvp_closed', 'rsvp', jsonb_build_object('event_id', e.id, 'title', e.title), now(), e.id, NULL, NULL, e.team_id, NULL);
    RETURN jsonb_build_object('result','closed');
  END IF;
  _needs := e.price_cents IS NOT NULL OR e.requires_waiver OR e.team_registration
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(e.rsvp_questions,'[]'::jsonb)) q WHERE (q->>'required')::boolean);
  IF _needs AND (r IS NULL OR r.status NOT IN ('going','waitlist','requested')) THEN
    PERFORM public.enqueue_message('sms', _ph, i.language, 'text_rsvp_finish', 'rsvp', jsonb_build_object('event_id', e.id, 'title', e.title, 'path', _path), now(), e.id, NULL, NULL, e.team_id, NULL);
    RETURN jsonb_build_object('result','finish_online','event_id', e.id);
  END IF;
  IF r IS NOT NULL AND r.status IN ('going','waitlist','requested') THEN
    _st := r.status; _id := r.id; _code := r.checkin_code;
  ELSE
    _st := 'going';
    _cap := public.guest_cap(e.id);
    IF _cap IS NOT NULL AND public.event_seats_used(e.id) + 1 > _cap THEN _st := 'waitlist'; END IF;
    IF e.require_approval THEN _st := 'requested'; END IF;
    IF r IS NOT NULL THEN
      UPDATE public.rsvps SET status = _st, plus_ones = 0, sms_opt_in = true WHERE id = r.id RETURNING id, checkin_code INTO _id, _code;
    ELSE
      INSERT INTO public.rsvps (event_id, guest_name, guest_phone, language, plus_ones, status, sms_opt_in, email_opt_in)
      VALUES (e.id, coalesce(nullif(trim(i.name),''), 'Guest'), _ph, i.language, 0, _st, true, false)
      RETURNING id, checkin_code INTO _id, _code;
    END IF;
    IF _st = 'requested' THEN PERFORM public.notify_rsvp_request(_id); END IF;
  END IF;
  PERFORM public.enqueue_message('sms', _ph, i.language, 'text_rsvp_' || _st, 'rsvp',
    jsonb_build_object('event_id', e.id, 'title', e.title, 'starts_at', e.starts_at, 'timezone', e.timezone, 'code', _code, 'path', _path), now(), e.id, _id, NULL, e.team_id, NULL);
  RETURN jsonb_build_object('result', _st, 'event_id', e.id, 'code', _code);
END $$;

REVOKE ALL ON FUNCTION public.handle_sms_reply(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_sms_reply(text, text) TO service_role;
REVOKE ALL ON FUNCTION public.text_invite_candidates(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.text_invite_candidates(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.send_text_invites(uuid, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_text_invites(uuid, text[]) TO authenticated, service_role;
