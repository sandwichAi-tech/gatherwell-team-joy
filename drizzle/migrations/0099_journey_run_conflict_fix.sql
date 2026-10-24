
-- ON CONFLICT must reference the partial unique index by columns + predicate, not as a constraint.
CREATE OR REPLACE FUNCTION public.start_journey_run(_journey UUID, _rsvp UUID, _event UUID, _team UUID, _next TIMESTAMPTZ)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _steps jsonb;
BEGIN
  SELECT coalesce(jsonb_agg(jsonb_build_object('kind', s.kind, 'config', s.config) ORDER BY s.sort_order), '[]'::jsonb)
    INTO _steps FROM public.message_journey_steps s WHERE s.journey_id = _journey;
  IF jsonb_array_length(_steps) = 0 THEN RETURN; END IF;
  INSERT INTO public.message_journey_runs (journey_id, team_id, rsvp_id, event_id, steps_snapshot, next_run_at)
  VALUES (_journey, _team, _rsvp, _event, _steps, _next)
  ON CONFLICT (journey_id, rsvp_id) WHERE status IN ('running','paused') DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.start_journey_run(uuid, uuid, uuid, uuid, timestamptz) FROM PUBLIC, anon, authenticated;
