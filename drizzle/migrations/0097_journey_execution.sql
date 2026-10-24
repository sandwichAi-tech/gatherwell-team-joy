
-- Durable, auditable journey runs. Steps are snapshotted at run start so editing a
-- journey never mutates an in-flight run.
CREATE TABLE public.message_journey_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id UUID NOT NULL REFERENCES public.message_journeys(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  rsvp_id UUID NOT NULL REFERENCES public.rsvps(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','paused','completed','failed')),
  current_step INT NOT NULL DEFAULT 1,
  steps_snapshot JSONB NOT NULL,
  next_run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- One live run per journey per registration: repeat triggers cannot duplicate sends.
CREATE UNIQUE INDEX message_journey_runs_live_uniq
  ON public.message_journey_runs (journey_id, rsvp_id) WHERE status IN ('running','paused');
CREATE INDEX message_journey_runs_due_idx ON public.message_journey_runs (next_run_at) WHERE status = 'running';
GRANT SELECT ON public.message_journey_runs TO authenticated;
GRANT ALL ON public.message_journey_runs TO service_role;
ALTER TABLE public.message_journey_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team reads journey runs" ON public.message_journey_runs FOR SELECT TO authenticated
  USING (public.team_capability(team_id, 'messages'));

-- Start a run: snapshot the journey's current steps into the run.
CREATE OR REPLACE FUNCTION public.start_journey_run(_journey UUID, _rsvp UUID, _event UUID, _team UUID, _next TIMESTAMPTZ)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _steps jsonb;
BEGIN
  SELECT coalesce(jsonb_agg(jsonb_build_object('kind', s.kind, 'config', s.config) ORDER BY s.sort_order), '[]'::jsonb)
    INTO _steps FROM public.message_journey_steps s WHERE s.journey_id = _journey;
  IF jsonb_array_length(_steps) = 0 THEN RETURN; END IF;
  INSERT INTO public.message_journey_runs (journey_id, team_id, rsvp_id, event_id, steps_snapshot, next_run_at)
  VALUES (_journey, _team, _rsvp, _event, _steps, _next)
  ON CONFLICT ON CONSTRAINT message_journey_runs_live_uniq DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.start_journey_run(uuid, uuid, uuid, uuid, timestamptz) FROM PUBLIC, anon, authenticated;

-- Registration trigger: start runs for active journeys on this team.
CREATE OR REPLACE FUNCTION public.journey_on_rsvp() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE j record; _starts timestamptz;
BEGIN
  SELECT starts_at INTO _starts FROM public.events WHERE id = NEW.event_id;
  FOR j IN SELECT id, start_trigger FROM public.message_journeys
           WHERE team_id = (SELECT team_id FROM public.events WHERE id = NEW.event_id) AND status = 'active' LOOP
    IF j.start_trigger = 'registration_confirmation' THEN
      PERFORM public.start_journey_run(j.id, NEW.id, NEW.event_id, (SELECT team_id FROM public.events WHERE id = NEW.event_id), now());
    ELSIF j.start_trigger = 'event_reminder' THEN
      PERFORM public.start_journey_run(j.id, NEW.id, NEW.event_id, (SELECT team_id FROM public.events WHERE id = NEW.event_id), greatest(now(), _starts - interval '24 hours'));
    END IF;
  END LOOP;
  RETURN NEW;
END $$;
CREATE TRIGGER journey_on_rsvp AFTER INSERT ON public.rsvps FOR EACH ROW EXECUTE FUNCTION public.journey_on_rsvp();

-- Cancellation trigger: start runs for event_cancellation journeys for every going registration.
CREATE OR REPLACE FUNCTION public.journey_on_event_cancel() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE j record; r record;
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    FOR j IN SELECT id FROM public.message_journeys WHERE team_id = NEW.team_id AND status = 'active' AND start_trigger = 'event_cancellation' LOOP
      FOR r IN SELECT id FROM public.rsvps WHERE event_id = NEW.id AND status = 'going' LOOP
        PERFORM public.start_journey_run(j.id, r.id, NEW.id, NEW.team_id, now());
      END LOOP;
    END LOOP;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER journey_on_event_cancel AFTER UPDATE OF status ON public.events FOR EACH ROW EXECUTE FUNCTION public.journey_on_event_cancel();

-- Advance due runs. Called from the existing outbox processor; same pipeline, same gates.
CREATE OR REPLACE FUNCTION public.advance_journey_runs(_limit INT DEFAULT 50)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE run record; step jsonb; n int := 0; idx int; done boolean; tpl record; r record;
        _channel text; _recipient text; _subject text; _body text; _event_title text; _host text; _starts timestamptz; _es boolean;
BEGIN
  FOR run IN SELECT jr.*, j.status AS journey_status FROM public.message_journey_runs jr
             JOIN public.message_journeys j ON j.id = jr.journey_id
             WHERE jr.status = 'running' AND jr.next_run_at <= now() AND j.status = 'active'
             ORDER BY jr.next_run_at LIMIT _limit FOR UPDATE OF jr SKIP LOCKED LOOP
    idx := run.current_step; done := false;
    SELECT guest_email, guest_phone, guest_name, user_id, coalesce(language,'en') INTO r FROM public.rsvps WHERE id = run.rsvp_id;
    SELECT title, starts_at INTO _event_title, _starts FROM public.events WHERE id = run.event_id;
    SELECT coalesce(p.display_name, p.full_name, 'your host') INTO _host FROM public.events e JOIN public.profiles p ON p.id = e.host_id WHERE e.id = run.event_id;
    _es := coalesce(r.language, 'en') = 'es';
    WHILE NOT done AND idx <= jsonb_array_length(run.steps_snapshot) LOOP
      step := run.steps_snapshot -> (idx - 1);
      IF step->>'kind' = 'wait' THEN
        UPDATE public.message_journey_runs SET current_step = idx + 1, next_run_at = now() + make_interval(hours => (step->'config'->>'hours')::int), updated_at = now() WHERE id = run.id;
        done := true;
      ELSIF step->>'kind' = 'condition' THEN
        IF (step->'config'->>'condition' = 'rsvp_status_going' AND EXISTS (SELECT 1 FROM public.rsvps WHERE id = run.rsvp_id AND status = 'going'))
           OR (step->'config'->>'condition' = 'event_not_full' AND NOT public.event_is_full(run.event_id))
           OR (step->'config'->>'condition' = 'not_checked_in' AND NOT EXISTS (SELECT 1 FROM public.rsvps WHERE id = run.rsvp_id AND checked_in_at IS NOT NULL)) THEN
          idx := idx + 1; -- condition passed: continue
        ELSE
          UPDATE public.message_journey_runs SET status = 'completed', note = 'condition_skip', updated_at = now() WHERE id = run.id;
          done := true;
        END IF;
      ELSIF step->>'kind' = 'send' THEN
        SELECT * INTO tpl FROM public.message_templates WHERE id = (step->'config'->>'template_id')::uuid AND archived_at IS NULL;
        IF NOT FOUND THEN
          UPDATE public.message_journey_runs SET status = 'failed', note = 'template_missing', updated_at = now() WHERE id = run.id; done := true;
        ELSE
          _channel := tpl.channel;
          _subject := public.render_message_vars(coalesce(tpl.subject,''), r.guest_name, _event_title, _starts, _host);
          _body := public.render_message_vars(tpl.body, r.guest_name, _event_title, _starts, _host);
          IF _channel = 'in_app' THEN
            IF r.user_id IS NULL THEN
              UPDATE public.message_journey_runs SET status = 'failed', note = 'no_recipient', updated_at = now() WHERE id = run.id; done := true;
            ELSE
              INSERT INTO public.notifications (user_id, kind, title, body, link) VALUES (r.user_id, 'journey', _subject, _body, '/event/' || run.event_id);
              idx := idx + 1;
            END IF;
          ELSE
            _recipient := CASE WHEN _channel = 'email' THEN r.guest_email ELSE r.guest_phone END;
            IF _recipient IS NULL OR _recipient = '' THEN
              UPDATE public.message_journey_runs SET status = 'failed', note = 'no_recipient', updated_at = now() WHERE id = run.id; done := true;
            ELSE
              INSERT INTO public.notification_outbox (team_id, event_id, rsvp_id, user_id, channel, recipient, language, template, kind, payload, send_after)
              VALUES (run.team_id, run.event_id, run.rsvp_id, r.user_id, _channel, _recipient, coalesce(r.language,'en'), 'custom_message', 'automation',
                      jsonb_build_object('subject', _subject, 'body', _body, 'title', _subject, 'event_id', run.event_id, 'journey_id', run.journey_id, 'journey_run_id', run.id), now());
              idx := idx + 1;
            END IF;
          END IF;
        END IF;
      ELSE
        UPDATE public.message_journey_runs SET status = 'failed', note = 'unknown_step', updated_at = now() WHERE id = run.id; done := true;
      END IF;
    END LOOP;
    IF NOT done AND idx > jsonb_array_length(run.steps_snapshot) THEN
      UPDATE public.message_journey_runs SET status = 'completed', current_step = idx, updated_at = now() WHERE id = run.id;
    END IF;
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.advance_journey_runs(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.advance_journey_runs(int) TO service_role;

-- Pause/resume cascades to live runs; editing steps never touches snapshots.
CREATE OR REPLACE FUNCTION public.set_journey_status(_id UUID, _status TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _team uuid; _sends int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  SELECT team_id INTO _team FROM public.message_journeys WHERE id = _id;
  IF _team IS NULL OR NOT public.team_capability(_team, 'messages') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _status NOT IN ('draft','active','paused') THEN RAISE EXCEPTION 'invalid_status'; END IF;
  IF _status = 'active' THEN
    SELECT count(*) INTO _sends FROM public.message_journey_steps WHERE journey_id = _id AND kind = 'send';
    IF _sends = 0 THEN RAISE EXCEPTION 'send_step_required'; END IF;
  END IF;
  UPDATE public.message_journeys SET status = _status, updated_at = now() WHERE id = _id;
  IF _status = 'paused' THEN
    UPDATE public.message_journey_runs SET status = 'paused', updated_at = now() WHERE journey_id = _id AND status = 'running';
  ELSIF _status = 'active' THEN
    UPDATE public.message_journey_runs SET status = 'running', updated_at = now() WHERE journey_id = _id AND status = 'paused';
  END IF;
END $$;

-- Run/activity view: status and step position only, never recipient details.
CREATE OR REPLACE FUNCTION public.journey_run_activity(_team UUID, _journey UUID DEFAULT NULL, _limit INT DEFAULT 20)
RETURNS TABLE(id UUID, journey_id UUID, journey_name TEXT, event_title TEXT, status TEXT, current_step INT, step_count INT, current_step_kind TEXT, next_run_at TIMESTAMPTZ, note TEXT, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF NOT public.team_capability(_team, 'messages') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
    SELECT r.id, r.journey_id, j.name, e.title, r.status, r.current_step, jsonb_array_length(r.steps_snapshot)::int,
           CASE WHEN r.current_step <= jsonb_array_length(r.steps_snapshot) THEN r.steps_snapshot->(r.current_step-1)->>'kind' ELSE NULL END,
           r.next_run_at, r.note, r.created_at, r.updated_at
    FROM public.message_journey_runs r
    JOIN public.message_journeys j ON j.id = r.journey_id
    JOIN public.events e ON e.id = r.event_id
    WHERE r.team_id = _team AND (_journey IS NULL OR r.journey_id = _journey)
    ORDER BY r.created_at DESC LIMIT least(_limit, 100);
END $$;
