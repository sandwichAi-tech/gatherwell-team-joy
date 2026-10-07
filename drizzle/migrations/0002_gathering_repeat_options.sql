ALTER TABLE public.events DROP CONSTRAINT events_recurrence_check;
ALTER TABLE public.events ADD CONSTRAINT events_recurrence_check CHECK (recurrence = ANY (ARRAY['none','weekly','daily','weekdays','biweekly','monthly','custom']));

CREATE OR REPLACE FUNCTION public.create_gathering(_team uuid, _p jsonb, _publish boolean, _weekly boolean)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _first uuid; _id uuid; _series uuid; _start timestamptz; _dur int; _tpl public.templates; _i int; _n int;
  _dates timestamptz[]; _rec text;
BEGIN
  IF NOT public.is_team_member(_team, ARRAY['leader','host']) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  PERFORM public.gathering_validate(_p);
  IF nullif(_p->>'template_id','') IS NOT NULL THEN
    SELECT * INTO _tpl FROM public.templates WHERE id = (_p->>'template_id')::uuid AND is_published
      AND (team_id IS NULL OR public.can_use_team_templates(team_id) OR public.is_team_member(team_id, ARRAY['leader']));
    IF _tpl.id IS NULL THEN RAISE EXCEPTION 'template_not_found'; END IF;
  END IF;
  _start := (_p->>'starts_at')::timestamptz; _dur := coalesce((_p->>'duration_minutes')::int, 60);
  _rec := coalesce(nullif(_p->>'recurrence',''), CASE WHEN _weekly THEN 'weekly' ELSE 'none' END);
  IF _rec NOT IN ('none','weekly','daily','weekdays','biweekly','monthly','custom') THEN RAISE EXCEPTION 'invalid_recurrence'; END IF;
  IF jsonb_typeof(_p->'occurrences') = 'array' AND jsonb_array_length(_p->'occurrences') > 0 THEN
    SELECT array_agg(DISTINCT x::timestamptz ORDER BY x::timestamptz) INTO _dates FROM jsonb_array_elements_text(_p->'occurrences') x;
    IF array_length(_dates,1) > 52 THEN RAISE EXCEPTION 'too_many_dates'; END IF;
    IF _dates[1] < now() - interval '1 day' OR _dates[array_length(_dates,1)] > now() + interval '400 days' THEN RAISE EXCEPTION 'invalid_dates'; END IF;
  ELSIF _weekly THEN
    SELECT array_agg(_start + make_interval(weeks => g)) INTO _dates FROM generate_series(0,7) g;
  ELSE
    _dates := ARRAY[_start];
  END IF;
  _n := array_length(_dates,1);
  IF _n > 1 THEN _series := gen_random_uuid(); ELSE _rec := 'none'; END IF;
  PERFORM set_config('gatherwell.launch', 'on', true);
  FOR _i IN 1.._n LOOP
    INSERT INTO public.events (team_id, host_id, title, description_en, description_es, cover_url, cover_style, category, category_label, theme, starts_at, ends_at, timezone,
      location_name, address, meeting_note, online_url, capacity, visibility, recurrence, series_id, template_id, status)
    VALUES (_team, auth.uid(), trim(_p->>'title'), nullif(_p->>'description_en',''), nullif(_p->>'description_es',''), nullif(_p->>'cover_url',''),
      coalesce((_p->>'cover_style')::int, 0), nullif(_p->>'category',''), CASE WHEN _p->>'category' = 'more' THEN nullif(trim(_p->>'category_label'),'') END, nullif(_p->>'theme',''), _dates[_i], _dates[_i] + make_interval(mins => _dur),
      coalesce(nullif(_p->>'timezone',''), 'UTC'), nullif(trim(coalesce(_p->>'location_name','')),''), nullif(trim(coalesce(_p->>'address','')),''),
      nullif(trim(coalesce(_p->>'meeting_note','')),''), nullif(trim(coalesce(_p->>'online_url','')),''), nullif(_p->>'capacity','')::int,
      coalesce(_p->>'visibility','team'), _rec, _series, _tpl.id,
      CASE WHEN _publish THEN 'published' ELSE 'draft' END)
    RETURNING id INTO _id;
    IF _first IS NULL THEN _first := _id; END IF;
    IF _tpl.id IS NOT NULL THEN
      INSERT INTO public.event_checklists (event_id, items)
      SELECT _id, coalesce(jsonb_agg(jsonb_build_object('label', item, 'done', false)), '[]'::jsonb) FROM jsonb_array_elements_text(_tpl.checklist) item;
    END IF;
  END LOOP;
  IF _tpl.id IS NOT NULL THEN
    UPDATE public.templates SET launches_count = launches_count + 1 WHERE id = _tpl.id;
    INSERT INTO public.activity (team_id, actor_id, type, payload) VALUES (_team, auth.uid(), 'template_launched', jsonb_build_object('template_id', _tpl.id, 'event_id', _first, 'title', _tpl.title));
  ELSIF _publish THEN
    INSERT INTO public.activity (team_id, actor_id, type, payload) VALUES (_team, auth.uid(), 'event_published', jsonb_build_object('event_id', _first, 'title', trim(_p->>'title'), 'weekly', _n > 1));
  END IF;
  PERFORM set_config('gatherwell.launch', 'off', true);
  RETURN _first;
END; $function$;