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
    PERFORM public.enqueue_message('sms', c.phone, c.language, 'gathering_invite', 'announcements',
      jsonb_build_object('event_id', e.id, 'title', e.title, 'starts_at', e.starts_at, 'timezone', e.timezone, 'host', _host,
        'name', split_part(coalesce(c.name,''),' ',1), 'path', _path), now(), _event, NULL, NULL, e.team_id, NULL);
    _n := _n + 1;
  END LOOP;
  RETURN _n;
END $$;

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
    PERFORM public.enqueue_message('sms', _ph, i.language, 'text_rsvp_out', 'transactional', jsonb_build_object('event_id', e.id, 'title', e.title, 'path', _path), now(), e.id, r.id, NULL, e.team_id, NULL);
    RETURN jsonb_build_object('result','cancelled','event_id', e.id);
  END IF;

  IF e.status <> 'published' THEN
    PERFORM public.enqueue_message('sms', _ph, i.language, 'text_rsvp_closed', 'transactional', jsonb_build_object('event_id', e.id, 'title', e.title), now(), e.id, NULL, NULL, e.team_id, NULL);
    RETURN jsonb_build_object('result','closed');
  END IF;
  _needs := e.price_cents IS NOT NULL OR e.requires_waiver OR e.team_registration
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(e.rsvp_questions,'[]'::jsonb)) q WHERE (q->>'required')::boolean);
  IF _needs AND (r IS NULL OR r.status NOT IN ('going','waitlist','requested')) THEN
    PERFORM public.enqueue_message('sms', _ph, i.language, 'text_rsvp_finish', 'transactional', jsonb_build_object('event_id', e.id, 'title', e.title, 'path', _path), now(), e.id, NULL, NULL, e.team_id, NULL);
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
  PERFORM public.enqueue_message('sms', _ph, i.language, 'text_rsvp_' || _st, 'transactional',
    jsonb_build_object('event_id', e.id, 'title', e.title, 'starts_at', e.starts_at, 'timezone', e.timezone, 'code', _code, 'path', _path), now(), e.id, _id, NULL, e.team_id, NULL);
  RETURN jsonb_build_object('result', _st, 'event_id', e.id, 'code', _code);
END $$;