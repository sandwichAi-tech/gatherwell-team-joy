CREATE OR REPLACE FUNCTION public.progress_core(_user uuid, _tz text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _tzv text := coalesce(nullif(_tz,''),'UTC'); _month date; _weeks date[]; _cur int := 0; _best int := 0; _run int := 0; _prev date; _w date; _this date;
  _res jsonb;
BEGIN
  BEGIN PERFORM now() AT TIME ZONE _tzv; EXCEPTION WHEN others THEN _tzv := 'UTC'; END;
  _month := date_trunc('month', now() AT TIME ZONE _tzv)::date;
  _this := date_trunc('week', now() AT TIME ZONE _tzv)::date;
  SELECT array_agg(DISTINCT date_trunc('week', r.checked_in_at AT TIME ZONE _tzv)::date ORDER BY date_trunc('week', r.checked_in_at AT TIME ZONE _tzv)::date)
    INTO _weeks FROM public.rsvps r WHERE r.user_id = _user AND r.checked_in_at IS NOT NULL;
  IF _weeks IS NOT NULL THEN
    FOREACH _w IN ARRAY _weeks LOOP
      IF _prev IS NOT NULL AND _w = _prev + 7 THEN _run := _run + 1; ELSE _run := 1; END IF;
      _best := greatest(_best, _run); _prev := _w;
    END LOOP;
    IF _prev >= _this - 7 THEN _cur := _run; END IF;
  END IF;
  SELECT jsonb_build_object(
    'attended', (SELECT count(*) FROM public.rsvps WHERE user_id = _user AND checked_in_at IS NOT NULL),
    'streak', _cur, 'best_streak', _best,
    'by_category', coalesce((SELECT jsonb_agg(jsonb_build_object('category', c, 'count', n) ORDER BY n DESC) FROM (
       SELECT coalesce(e.category,'other') c, count(*) n FROM public.rsvps r JOIN public.events e ON e.id = r.event_id
       WHERE r.user_id = _user AND r.checked_in_at IS NOT NULL GROUP BY 1) x), '[]'::jsonb),
    'lessons', (SELECT count(*) FROM public.lesson_progress WHERE user_id = _user AND completed_at IS NOT NULL),
    'month', jsonb_build_object(
      'start', _month,
      'gatherings', (SELECT count(*) FROM public.rsvps WHERE user_id = _user AND checked_in_at AT TIME ZONE _tzv >= _month),
      'goals_checked', (SELECT count(*) FROM public.progress_goal_checks WHERE user_id = _user AND checked_on >= _month),
      'new_people', (SELECT count(DISTINCT coalesce(o.user_id::text, lower(o.guest_email), o.guest_phone)) FROM public.rsvps m JOIN public.rsvps o ON o.event_id = m.event_id AND o.id <> m.id AND o.checked_in_at IS NOT NULL
         WHERE m.user_id = _user AND m.checked_in_at AT TIME ZONE _tzv >= _month AND coalesce(o.user_id::text, lower(o.guest_email), o.guest_phone) IS NOT NULL AND o.user_id IS DISTINCT FROM _user
         AND NOT EXISTS (SELECT 1 FROM public.rsvps pm JOIN public.rsvps po ON po.event_id = pm.event_id AND po.checked_in_at IS NOT NULL
           WHERE pm.user_id = _user AND pm.checked_in_at IS NOT NULL AND pm.checked_in_at AT TIME ZONE _tzv < _month
           AND coalesce(po.user_id::text, lower(po.guest_email), po.guest_phone) = coalesce(o.user_id::text, lower(o.guest_email), o.guest_phone))),
      'streak', _cur)) INTO _res;
  RETURN _res;
END $$;
REVOKE ALL ON FUNCTION public.progress_core(uuid, text) FROM public, anon, authenticated;