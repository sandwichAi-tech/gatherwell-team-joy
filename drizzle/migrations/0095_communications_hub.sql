
-- Communications hub: message templates, automations, journeys (beta)

-- 1. Messaging capability for workspace roles
CREATE OR REPLACE FUNCTION public.team_capability(_team uuid, _cap text) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _role text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM teams WHERE id = _team AND owner_id = auth.uid()) THEN RETURN true; END IF;
  SELECT workspace_role INTO _role FROM team_members WHERE team_id = _team AND user_id = auth.uid() AND suspended_at IS NULL;
  IF _role IS NULL THEN RETURN false; END IF;
  RETURN CASE _role
    WHEN 'admin' THEN _cap IN ('members','settings','content','billing_view','events','invites','audit','assign','moderate','analytics','messages')
    WHEN 'host' THEN _cap IN ('events','content','messages')
    WHEN 'content_editor' THEN _cap IN ('content')
    WHEN 'checkin' THEN _cap IN ('checkin')
    WHEN 'moderator' THEN _cap IN ('moderate')
    WHEN 'analyst' THEN _cap IN ('analytics')
    ELSE false END;
END $$;

-- 2. Message templates (team_id NULL = ZoheeWell starter, read-only to all signed-in)
CREATE TABLE public.message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  created_by uuid,
  name text NOT NULL,
  channel text NOT NULL DEFAULT 'email',
  language text NOT NULL DEFAULT 'en',
  subject text,
  body text NOT NULL,
  variables text[] NOT NULL DEFAULT '{}',
  audience text NOT NULL DEFAULT 'attendees',
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT message_templates_channel_check CHECK (channel IN ('email','sms','in_app')),
  CONSTRAINT message_templates_name_len CHECK (char_length(name) BETWEEN 1 AND 120),
  CONSTRAINT message_templates_body_len CHECK (char_length(body) BETWEEN 1 AND 4000)
);
GRANT SELECT ON public.message_templates TO authenticated;
GRANT ALL ON public.message_templates TO service_role;
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read team and starter templates" ON public.message_templates FOR SELECT TO authenticated
  USING (team_id IS NULL OR public.is_team_member(team_id, ARRAY['leader','host','member','owner','admin','content_editor','checkin','moderator','analyst']));

-- 3. Automations
CREATE TABLE public.message_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name text NOT NULL,
  trigger text NOT NULL,
  timing_hours integer NOT NULL DEFAULT 24,
  audience text NOT NULL DEFAULT 'attendees',
  channel text NOT NULL DEFAULT 'email',
  template_id uuid REFERENCES public.message_templates(id) ON DELETE SET NULL,
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT message_automations_trigger_check CHECK (trigger IN ('registration_confirmation','event_reminder','event_cancellation')),
  CONSTRAINT message_automations_channel_check CHECK (channel IN ('email','sms','in_app')),
  CONSTRAINT message_automations_status_check CHECK (status IN ('draft','active','paused')),
  CONSTRAINT message_automations_timing_check CHECK (timing_hours BETWEEN 1 AND 720)
);
GRANT SELECT ON public.message_automations TO authenticated;
GRANT ALL ON public.message_automations TO service_role;
ALTER TABLE public.message_automations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read team automations" ON public.message_automations FOR SELECT TO authenticated
  USING (public.is_team_member(team_id, ARRAY['leader','host','member','owner','admin','content_editor','checkin','moderator','analyst']));

-- 4. Journeys + steps
CREATE TABLE public.message_journeys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name text NOT NULL,
  start_trigger text NOT NULL DEFAULT 'registration_confirmation',
  status text NOT NULL DEFAULT 'draft',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT message_journeys_trigger_check CHECK (start_trigger IN ('registration_confirmation','event_reminder','event_cancellation')),
  CONSTRAINT message_journeys_status_check CHECK (status IN ('draft','active','paused'))
);
GRANT SELECT ON public.message_journeys TO authenticated;
GRANT ALL ON public.message_journeys TO service_role;
ALTER TABLE public.message_journeys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read team journeys" ON public.message_journeys FOR SELECT TO authenticated
  USING (public.is_team_member(team_id, ARRAY['leader','host','member','owner','admin','content_editor','checkin','moderator','analyst']));

CREATE TABLE public.message_journey_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id uuid NOT NULL REFERENCES public.message_journeys(id) ON DELETE CASCADE,
  sort_order integer NOT NULL,
  kind text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}',
  CONSTRAINT message_journey_steps_kind_check CHECK (kind IN ('wait','send','condition'))
);
GRANT SELECT ON public.message_journey_steps TO authenticated;
GRANT ALL ON public.message_journey_steps TO service_role;
ALTER TABLE public.message_journey_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read journey steps" ON public.message_journey_steps FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.message_journeys j WHERE j.id = journey_id AND public.is_team_member(j.team_id, ARRAY['leader','host','member','owner','admin','content_editor','checkin','moderator','analyst'])));

-- 5. Outbox attribution for automation/journey sends
ALTER TABLE public.notification_outbox
  ADD COLUMN automation_id uuid,
  ADD COLUMN journey_step_id uuid;
COMMENT ON COLUMN public.notification_outbox.automation_id IS 'Set when the row was enqueued by a message automation.';
COMMENT ON COLUMN public.notification_outbox.journey_step_id IS 'Set when the row was enqueued by a journey step.';

-- 6. Variable substitution helper ({{name}}, {{event}}, {{date}}, {{host}})
CREATE OR REPLACE FUNCTION public.render_message_vars(_text text, _name text, _event text, _date text, _host text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT replace(replace(replace(replace(coalesce(_text,''), '{{name}}', coalesce(_name,'')), '{{event}}', coalesce(_event,'')), '{{date}}', coalesce(_date,'')), '{{host}}', coalesce(_host,''));
$$;

-- 7. Enqueue one automation message for one RSVP (outbox for email/sms, notifications for in_app)
CREATE OR REPLACE FUNCTION public.enqueue_automation_message(_auto public.message_automations, _rsvp public.rsvps, _send_after timestamptz) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _tpl public.message_templates; _event public.events; _host text; _subject text; _body text; _date text;
BEGIN
  IF _auto.template_id IS NULL THEN RETURN; END IF;
  SELECT * INTO _tpl FROM public.message_templates WHERE id = _auto.template_id AND NOT archived;
  IF _tpl IS NULL THEN RETURN; END IF;
  SELECT * INTO _event FROM public.events WHERE id = _rsvp.event_id;
  SELECT full_name INTO _host FROM public.profiles WHERE id = _event.host_id;
  _date := to_char(_event.starts_at, 'FMDay, FMMonth DD at HH24:MI');
  _subject := public.render_message_vars(_tpl.subject, _rsvp.guest_name, _event.title, _date, _host);
  _body := public.render_message_vars(_tpl.body, _rsvp.guest_name, _event.title, _date, _host);
  IF _auto.channel = 'in_app' THEN
    IF _rsvp.user_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, kind, title, body, link)
      VALUES (_rsvp.user_id, 'automation', coalesce(nullif(_subject,''), _tpl.name), _body, '/e/' || _event.id);
    END IF;
    RETURN;
  END IF;
  INSERT INTO public.notification_outbox (event_id, rsvp_id, channel, recipient, template, payload, send_after, status, kind, user_id, team_id, language, automation_id)
  VALUES (_rsvp.event_id, _rsvp.id, _auto.channel,
    CASE WHEN _auto.channel = 'sms' THEN _rsvp.guest_phone ELSE _rsvp.guest_email END,
    'custom_message',
    jsonb_build_object('subject', _subject, 'body', _body, 'title', _event.title, 'event_id', _event.id, 'name', _rsvp.guest_name),
    _send_after, 'pending', 'automation', _rsvp.user_id, _auto.team_id, coalesce(_rsvp.language, 'en'), _auto.id);
END $$;

-- 8. RSVP trigger: registration confirmation now + schedule event reminders
CREATE OR REPLACE FUNCTION public.automations_on_rsvp() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _auto public.message_automations; _event public.events;
BEGIN
  IF NEW.status NOT IN ('going','requested') THEN RETURN NEW; END IF;
  SELECT * INTO _event FROM public.events WHERE id = NEW.event_id;
  FOR _auto IN SELECT * FROM public.message_automations
    WHERE team_id = _event.team_id AND status = 'active'
      AND (event_id IS NULL OR event_id = NEW.event_id)
      AND trigger IN ('registration_confirmation','event_reminder') LOOP
    IF _auto.trigger = 'registration_confirmation' THEN
      PERFORM public.enqueue_automation_message(_auto, NEW, now());
    ELSIF _event.starts_at - make_interval(hours => _auto.timing_hours) > now() THEN
      PERFORM public.enqueue_automation_message(_auto, NEW, _event.starts_at - make_interval(hours => _auto.timing_hours));
    END IF;
  END LOOP;
  RETURN NEW;
END $$;
CREATE TRIGGER automations_on_rsvp AFTER INSERT ON public.rsvps FOR EACH ROW EXECUTE FUNCTION public.automations_on_rsvp();

-- 9. Event cancellation trigger
CREATE OR REPLACE FUNCTION public.automations_on_cancel() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _auto public.message_automations; _r public.rsvps;
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    FOR _auto IN SELECT * FROM public.message_automations
      WHERE team_id = NEW.team_id AND status = 'active' AND trigger = 'event_cancellation'
        AND (event_id IS NULL OR event_id = NEW.id) LOOP
      FOR _r IN SELECT * FROM public.rsvps WHERE event_id = NEW.id AND status IN ('going','maybe','waitlist') LOOP
        PERFORM public.enqueue_automation_message(_auto, _r, now());
      END LOOP;
    END LOOP;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER automations_on_cancel AFTER UPDATE OF status ON public.events FOR EACH ROW EXECUTE FUNCTION public.automations_on_cancel();

-- 10. Template RPCs (writes are RPC-only; capability-checked)
CREATE OR REPLACE FUNCTION public.save_message_template(_team uuid, _id uuid, _name text, _channel text, _language text, _subject text, _body text, _audience text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _new uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF NOT public.team_capability(_team, 'messages') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _channel NOT IN ('email','sms','in_app') THEN RAISE EXCEPTION 'invalid_channel'; END IF;
  IF _language NOT IN ('en','es') THEN RAISE EXCEPTION 'invalid_language'; END IF;
  IF char_length(trim(_name)) = 0 OR char_length(_name) > 120 THEN RAISE EXCEPTION 'invalid_name'; END IF;
  IF char_length(trim(_body)) = 0 OR char_length(_body) > 4000 THEN RAISE EXCEPTION 'invalid_body'; END IF;
  IF _channel = 'sms' AND char_length(_body) > 480 THEN RAISE EXCEPTION 'sms_too_long'; END IF;
  IF _id IS NULL THEN
    INSERT INTO public.message_templates (team_id, created_by, name, channel, language, subject, body, audience,
      variables)
    VALUES (_team, auth.uid(), trim(_name), _channel, _language, nullif(trim(coalesce(_subject,'')),''), _body, coalesce(nullif(_audience,''),'attendees'),
      (SELECT coalesce(array_agg(DISTINCT m[1]), '{}') FROM regexp_matches(_body, '\{\{([a-z_]+)\}\}', 'g') m))
    RETURNING id INTO _new;
  ELSE
    UPDATE public.message_templates SET name = trim(_name), channel = _channel, language = _language,
      subject = nullif(trim(coalesce(_subject,'')),''), body = _body, audience = coalesce(nullif(_audience,''),'attendees'),
      variables = (SELECT coalesce(array_agg(DISTINCT m[1]), '{}') FROM regexp_matches(_body, '\{\{([a-z_]+)\}\}', 'g') m),
      updated_at = now()
    WHERE id = _id AND team_id = _team RETURNING id INTO _new;
    IF _new IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  END IF;
  RETURN _new;
END $$;
GRANT EXECUTE ON FUNCTION public.save_message_template(uuid, uuid, text, text, text, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.duplicate_message_template(_id uuid, _team uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _src public.message_templates; _new uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF NOT public.team_capability(_team, 'messages') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO _src FROM public.message_templates WHERE id = _id AND NOT archived
    AND (team_id IS NULL OR public.is_team_member(team_id, ARRAY['leader','host','member','owner','admin','content_editor','checkin','moderator','analyst']));
  IF _src IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  INSERT INTO public.message_templates (team_id, created_by, name, channel, language, subject, body, audience, variables)
  VALUES (_team, auth.uid(), _src.name || ' (copy)', _src.channel, _src.language, _src.subject, _src.body, _src.audience, _src.variables)
  RETURNING id INTO _new;
  RETURN _new;
END $$;
GRANT EXECUTE ON FUNCTION public.duplicate_message_template(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.archive_message_template(_id uuid, _archived boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _team uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  SELECT team_id INTO _team FROM public.message_templates WHERE id = _id;
  IF _team IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF NOT public.team_capability(_team, 'messages') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.message_templates SET archived = _archived, updated_at = now() WHERE id = _id;
END $$;
GRANT EXECUTE ON FUNCTION public.archive_message_template(uuid, boolean) TO authenticated;

-- 11. Automation RPCs
CREATE OR REPLACE FUNCTION public.save_message_automation(_team uuid, _id uuid, _name text, _trigger text, _timing_hours integer, _audience text, _channel text, _template_id uuid, _event_id uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _new uuid; _tpl public.message_templates;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF NOT public.team_capability(_team, 'messages') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _trigger NOT IN ('registration_confirmation','event_reminder','event_cancellation') THEN RAISE EXCEPTION 'invalid_trigger'; END IF;
  IF _channel NOT IN ('email','sms','in_app') THEN RAISE EXCEPTION 'invalid_channel'; END IF;
  IF char_length(trim(_name)) = 0 OR char_length(_name) > 120 THEN RAISE EXCEPTION 'invalid_name'; END IF;
  IF _timing_hours IS NULL OR _timing_hours < 1 OR _timing_hours > 720 THEN RAISE EXCEPTION 'invalid_timing'; END IF;
  IF _template_id IS NOT NULL THEN
    SELECT * INTO _tpl FROM public.message_templates WHERE id = _template_id AND NOT archived AND (team_id IS NULL OR team_id = _team);
    IF _tpl IS NULL THEN RAISE EXCEPTION 'template_not_found'; END IF;
    IF _tpl.channel <> _channel THEN RAISE EXCEPTION 'channel_mismatch'; END IF;
  END IF;
  IF _event_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.events WHERE id = _event_id AND team_id = _team) THEN RAISE EXCEPTION 'event_not_found'; END IF;
  IF _id IS NULL THEN
    INSERT INTO public.message_automations (team_id, name, trigger, timing_hours, audience, channel, template_id, event_id, created_by)
    VALUES (_team, trim(_name), _trigger, _timing_hours, coalesce(nullif(_audience,''),'attendees'), _channel, _template_id, _event_id, auth.uid())
    RETURNING id INTO _new;
  ELSE
    UPDATE public.message_automations SET name = trim(_name), trigger = _trigger, timing_hours = _timing_hours,
      audience = coalesce(nullif(_audience,''),'attendees'), channel = _channel, template_id = _template_id, event_id = _event_id, updated_at = now()
    WHERE id = _id AND team_id = _team RETURNING id INTO _new;
    IF _new IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  END IF;
  RETURN _new;
END $$;
GRANT EXECUTE ON FUNCTION public.save_message_automation(uuid, uuid, text, text, integer, text, text, uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_automation_status(_id uuid, _status text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _a public.message_automations;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  SELECT * INTO _a FROM public.message_automations WHERE id = _id;
  IF _a IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF NOT public.team_capability(_a.team_id, 'messages') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _status NOT IN ('draft','active','paused') THEN RAISE EXCEPTION 'invalid_status'; END IF;
  IF _status = 'active' THEN
    IF _a.template_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.message_templates WHERE id = _a.template_id AND NOT archived) THEN
      RAISE EXCEPTION 'template_required';
    END IF;
  END IF;
  UPDATE public.message_automations SET status = _status, updated_at = now() WHERE id = _id;
END $$;
GRANT EXECUTE ON FUNCTION public.set_automation_status(uuid, text) TO authenticated;

-- 12. Journey RPCs (steps replaced atomically in one transaction)
CREATE OR REPLACE FUNCTION public.save_message_journey(_team uuid, _id uuid, _name text, _start_trigger text, _steps jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _new uuid; _step jsonb; _i int := 0; _kind text; _tpl uuid; _hours int; _cond text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF NOT public.team_capability(_team, 'messages') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _start_trigger NOT IN ('registration_confirmation','event_reminder','event_cancellation') THEN RAISE EXCEPTION 'invalid_trigger'; END IF;
  IF char_length(trim(_name)) = 0 OR char_length(_name) > 120 THEN RAISE EXCEPTION 'invalid_name'; END IF;
  IF _steps IS NULL OR jsonb_typeof(_steps) <> 'array' OR jsonb_array_length(_steps) = 0 OR jsonb_array_length(_steps) > 20 THEN RAISE EXCEPTION 'invalid_steps'; END IF;
  FOR _step IN SELECT * FROM jsonb_array_elements(_steps) LOOP
    _kind := _step->>'kind';
    IF _kind NOT IN ('wait','send','condition') THEN RAISE EXCEPTION 'invalid_step_kind'; END IF;
    IF _kind = 'wait' THEN
      _hours := coalesce((_step->>'hours')::int, 0);
      IF _hours < 1 OR _hours > 720 THEN RAISE EXCEPTION 'invalid_wait'; END IF;
    ELSIF _kind = 'send' THEN
      _tpl := nullif(_step->>'template_id','')::uuid;
      IF _tpl IS NULL OR NOT EXISTS (SELECT 1 FROM public.message_templates WHERE id = _tpl AND NOT archived AND (team_id IS NULL OR team_id = _team)) THEN
        RAISE EXCEPTION 'template_not_found';
      END IF;
    ELSE
      _cond := _step->>'condition';
      IF _cond NOT IN ('rsvp_status_going','event_not_full','not_checked_in') THEN RAISE EXCEPTION 'invalid_condition'; END IF;
    END IF;
  END LOOP;
  IF _id IS NULL THEN
    INSERT INTO public.message_journeys (team_id, name, start_trigger, created_by) VALUES (_team, trim(_name), _start_trigger, auth.uid()) RETURNING id INTO _new;
  ELSE
    UPDATE public.message_journeys SET name = trim(_name), start_trigger = _start_trigger, updated_at = now()
    WHERE id = _id AND team_id = _team RETURNING id INTO _new;
    IF _new IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
    DELETE FROM public.message_journey_steps WHERE journey_id = _new;
  END IF;
  FOR _step IN SELECT * FROM jsonb_array_elements(_steps) LOOP
    _i := _i + 1;
    INSERT INTO public.message_journey_steps (journey_id, sort_order, kind, config)
    VALUES (_new, _i, _step->>'kind', _step - 'kind');
  END LOOP;
  RETURN _new;
END $$;
GRANT EXECUTE ON FUNCTION public.save_message_journey(uuid, uuid, text, text, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_journey_status(_id uuid, _status text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _j public.message_journeys;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  SELECT * INTO _j FROM public.message_journeys WHERE id = _id;
  IF _j IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF NOT public.team_capability(_j.team_id, 'messages') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _status NOT IN ('draft','active','paused') THEN RAISE EXCEPTION 'invalid_status'; END IF;
  IF _status = 'active' AND NOT EXISTS (SELECT 1 FROM public.message_journey_steps WHERE journey_id = _id AND kind = 'send') THEN
    RAISE EXCEPTION 'send_step_required';
  END IF;
  UPDATE public.message_journeys SET status = _status, updated_at = now() WHERE id = _id;
END $$;
GRANT EXECUTE ON FUNCTION public.set_journey_status(uuid, text) TO authenticated;

-- 13. Automation activity: caller-scoped outbox history for a team
CREATE OR REPLACE FUNCTION public.automation_activity(_team uuid, _limit integer) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF NOT public.team_capability(_team, 'messages') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN coalesce((SELECT jsonb_agg(row_to_json(s)) FROM (
    SELECT o.id, o.channel, o.template, o.kind, o.status, o.send_after, o.sent_at, o.error, o.automation_id,
      a.name AS automation_name, e.title AS event_title
    FROM public.notification_outbox o
    LEFT JOIN public.message_automations a ON a.id = o.automation_id
    LEFT JOIN public.events e ON e.id = o.event_id
    WHERE o.team_id = _team AND o.kind = 'automation'
    ORDER BY o.created_at DESC LIMIT least(greatest(coalesce(_limit, 20), 1), 100)) s), '[]'::jsonb);
END $$;
GRANT EXECUTE ON FUNCTION public.automation_activity(uuid, integer) TO authenticated;

-- 14. ZoheeWell starter templates (team_id NULL, bilingual, honest copy)
INSERT INTO public.message_templates (team_id, created_by, name, channel, language, subject, body, audience, variables) VALUES
(NULL, NULL, 'Welcome — registration confirmed', 'email', 'en', 'You''re in: {{event}}', 'Hi {{name}},

Your spot at {{event}} is confirmed.

When: {{date}}
Hosted by {{host}}

We can''t wait to see you.', 'attendees', '{name,event,date,host}'),
(NULL, NULL, 'Bienvenida — registro confirmado', 'email', 'es', 'Estás en la lista: {{event}}', 'Hola {{name}},

Tu lugar en {{event}} está confirmado.

Cuándo: {{date}}
Anfitriona: {{host}}

Te esperamos con gusto.', 'attendees', '{name,event,date,host}'),
(NULL, NULL, 'Friendly reminder', 'email', 'en', 'Coming up: {{event}}', 'Hi {{name}},

A friendly reminder about {{event}} on {{date}}.

See you soon,
{{host}}', 'attendees', '{name,event,date,host}'),
(NULL, NULL, 'Recordatorio amable', 'email', 'es', 'Próximamente: {{event}}', 'Hola {{name}},

Un recordatorio amable de {{event}} el {{date}}.

Nos vemos pronto,
{{host}}', 'attendees', '{name,event,date,host}'),
(NULL, NULL, 'Cancellation note', 'email', 'en', 'Cancelled: {{event}}', 'Hi {{name}},

We''re sorry — {{event}} ({{date}}) has been cancelled. Thank you for signing up.

{{host}}', 'attendees', '{name,event,date,host}'),
(NULL, NULL, 'Aviso de cancelación', 'email', 'es', 'Cancelado: {{event}}', 'Hola {{name}},

Lo sentimos — {{event}} ({{date}}) se canceló. Gracias por apuntarte.

{{host}}', 'attendees', '{name,event,date,host}'),
(NULL, NULL, 'Text reminder', 'sms', 'en', NULL, 'ZoheeWell: reminder for {{event}} on {{date}}. See you there!', 'attendees', '{event,date}'),
(NULL, NULL, 'Recordatorio por texto', 'sms', 'es', NULL, 'ZoheeWell: recordatorio de {{event}} el {{date}}. ¡Nos vemos!', 'attendees', '{event,date}');
