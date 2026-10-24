
-- Fix advance_journey_runs: no event_is_full function exists (use events.capacity),
-- profiles has full_name only, and render_message_vars takes a text date.
CREATE OR REPLACE FUNCTION public.advance_journey_runs(_limit INT DEFAULT 50)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE run record; step jsonb; n int := 0; idx int; done boolean; tpl record; r record;
        _channel text; _recipient text; _subject text; _body text; _event_title text; _host text; _starts timestamptz; _date text; _not_full boolean;
BEGIN
  FOR run IN SELECT jr.*, j.status AS journey_status FROM public.message_journey_runs jr
             JOIN public.message_journeys j ON j.id = jr.journey_id
             WHERE jr.status = 'running' AND jr.next_run_at <= now() AND j.status = 'active'
             ORDER BY jr.next_run_at LIMIT _limit FOR UPDATE OF jr SKIP LOCKED LOOP
    idx := run.current_step; done := false;
    SELECT guest_email, guest_phone, guest_name, user_id, coalesce(language,'en') AS language INTO r FROM public.rsvps WHERE id = run.rsvp_id;
    SELECT title, starts_at INTO _event_title, _starts FROM public.events WHERE id = run.event_id;
    _date := to_char(_starts, 'Dy, Mon DD at HH24:MI');
    SELECT coalesce(p.full_name, 'your host') INTO _host FROM public.events e JOIN public.profiles p ON p.id = e.host_id WHERE e.id = run.event_id;
    SELECT (capacity IS NULL OR (SELECT count(*) FROM public.rsvps x WHERE x.event_id = run.event_id AND x.status = 'going') < capacity)
      INTO _not_full FROM public.events WHERE id = run.event_id;
    WHILE NOT done AND idx <= jsonb_array_length(run.steps_snapshot) LOOP
      step := run.steps_snapshot -> (idx - 1);
      IF step->>'kind' = 'wait' THEN
        UPDATE public.message_journey_runs SET current_step = idx + 1, next_run_at = now() + make_interval(hours => (step->'config'->>'hours')::int), updated_at = now() WHERE id = run.id;
        done := true;
      ELSIF step->>'kind' = 'condition' THEN
        IF (step->'config'->>'condition' = 'rsvp_status_going' AND EXISTS (SELECT 1 FROM public.rsvps WHERE id = run.rsvp_id AND status = 'going'))
           OR (step->'config'->>'condition' = 'event_not_full' AND _not_full)
           OR (step->'config'->>'condition' = 'not_checked_in' AND NOT EXISTS (SELECT 1 FROM public.rsvps WHERE id = run.rsvp_id AND checked_in_at IS NOT NULL)) THEN
          idx := idx + 1;
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
          _subject := public.render_message_vars(coalesce(tpl.subject,''), r.guest_name, _event_title, _date, _host);
          _body := public.render_message_vars(tpl.body, r.guest_name, _event_title, _date, _host);
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
