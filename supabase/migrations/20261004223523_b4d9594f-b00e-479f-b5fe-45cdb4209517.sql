ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS series_id uuid,
  ADD COLUMN IF NOT EXISTS meeting_note text,
  ADD COLUMN IF NOT EXISTS cover_style smallint NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS events_series_idx ON public.events(series_id);
CREATE INDEX IF NOT EXISTS events_host_idx ON public.events(host_id, starts_at);

CREATE OR REPLACE FUNCTION public.gathering_validate(_p jsonb) RETURNS void LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
BEGIN
  IF coalesce(trim(_p->>'title'),'') = '' OR length(_p->>'title') > 120 THEN RAISE EXCEPTION 'invalid_title'; END IF;
  IF nullif(_p->>'starts_at','') IS NULL THEN RAISE EXCEPTION 'date_required'; END IF;
  IF coalesce((_p->>'duration_minutes')::int, 60) NOT BETWEEN 5 AND 1440 THEN RAISE EXCEPTION 'invalid_duration'; END IF;
  IF coalesce(_p->>'online_url','') <> '' AND (_p->>'online_url' !~* '^https://[^\s]+$' OR length(_p->>'online_url') > 500) THEN RAISE EXCEPTION 'invalid_url'; END IF;
  IF nullif(_p->>'capacity','') IS NOT NULL AND (_p->>'capacity')::int NOT BETWEEN 1 AND 10000 THEN RAISE EXCEPTION 'invalid_capacity'; END IF;
  IF coalesce(_p->>'visibility','team') NOT IN ('public','team') THEN RAISE EXCEPTION 'invalid_visibility'; END IF;
  IF coalesce((_p->>'cover_style')::int, 0) NOT BETWEEN 0 AND 5 THEN RAISE EXCEPTION 'invalid_style'; END IF;
  IF length(coalesce(_p->>'description_en','')) > 4000 OR length(coalesce(_p->>'description_es','')) > 4000
     OR length(coalesce(_p->>'address','')) > 300 OR length(coalesce(_p->>'location_name','')) > 160 OR length(coalesce(_p->>'meeting_note','')) > 300 THEN RAISE EXCEPTION 'too_long'; END IF;
END; $$;

-- Creates one gathering or a weekly series of 8, writing a single win.
CREATE OR REPLACE FUNCTION public.create_gathering(_team uuid, _p jsonb, _publish boolean, _weekly boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _first uuid; _id uuid; _series uuid; _start timestamptz; _dur int; _tpl public.templates; _i int; _n int;
BEGIN
  IF NOT public.is_team_member(_team, ARRAY['leader','host']) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  PERFORM public.gathering_validate(_p);
  IF nullif(_p->>'template_id','') IS NOT NULL THEN
    SELECT * INTO _tpl FROM public.templates WHERE id = (_p->>'template_id')::uuid AND is_published
      AND (team_id IS NULL OR public.can_use_team_templates(team_id) OR public.is_team_member(team_id, ARRAY['leader']));
    IF _tpl.id IS NULL THEN RAISE EXCEPTION 'template_not_found'; END IF;
  END IF;
  _start := (_p->>'starts_at')::timestamptz; _dur := coalesce((_p->>'duration_minutes')::int, 60);
  _n := CASE WHEN _weekly THEN 8 ELSE 1 END;
  IF _weekly THEN _series := gen_random_uuid(); END IF;
  PERFORM set_config('gatherwell.launch', 'on', true);
  FOR _i IN 0.._n - 1 LOOP
    INSERT INTO public.events (team_id, host_id, title, description_en, description_es, cover_url, cover_style, theme, starts_at, ends_at, timezone,
      location_name, address, meeting_note, online_url, capacity, visibility, recurrence, series_id, template_id, status)
    VALUES (_team, auth.uid(), trim(_p->>'title'), nullif(_p->>'description_en',''), nullif(_p->>'description_es',''), nullif(_p->>'cover_url',''),
      coalesce((_p->>'cover_style')::int, 0), nullif(_p->>'theme',''), _start + make_interval(weeks => _i), _start + make_interval(weeks => _i, mins => _dur),
      coalesce(nullif(_p->>'timezone',''), 'UTC'), nullif(trim(coalesce(_p->>'location_name','')),''), nullif(trim(coalesce(_p->>'address','')),''),
      nullif(trim(coalesce(_p->>'meeting_note','')),''), nullif(trim(coalesce(_p->>'online_url','')),''), nullif(_p->>'capacity','')::int,
      coalesce(_p->>'visibility','team'), CASE WHEN _weekly THEN 'weekly' ELSE 'none' END, _series, _tpl.id,
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
    INSERT INTO public.activity (team_id, actor_id, type, payload) VALUES (_team, auth.uid(), 'event_published', jsonb_build_object('event_id', _first, 'title', trim(_p->>'title'), 'weekly', _weekly));
  END IF;
  PERFORM set_config('gatherwell.launch', 'off', true);
  RETURN _first;
END; $$;

-- Edits one date or this and every later date in its weekly series.
CREATE OR REPLACE FUNCTION public.update_gathering(_event uuid, _p jsonb, _whole_series boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _e public.events; _shift interval; _dur int;
BEGIN
  SELECT * INTO _e FROM public.events WHERE id = _event;
  IF _e.id IS NULL OR NOT public.can_manage_event(_event) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  PERFORM public.gathering_validate(_p);
  _shift := (_p->>'starts_at')::timestamptz - _e.starts_at; _dur := coalesce((_p->>'duration_minutes')::int, 60);
  UPDATE public.events SET title = trim(_p->>'title'), description_en = nullif(_p->>'description_en',''), description_es = nullif(_p->>'description_es',''),
    cover_url = nullif(_p->>'cover_url',''), cover_style = coalesce((_p->>'cover_style')::int, 0), timezone = coalesce(nullif(_p->>'timezone',''), timezone),
    location_name = nullif(trim(coalesce(_p->>'location_name','')),''), address = nullif(trim(coalesce(_p->>'address','')),''),
    lat = CASE WHEN _p ? 'lat' THEN nullif(_p->>'lat','')::double precision ELSE lat END, lng = CASE WHEN _p ? 'lng' THEN nullif(_p->>'lng','')::double precision ELSE lng END,
    meeting_note = nullif(trim(coalesce(_p->>'meeting_note','')),''), online_url = nullif(trim(coalesce(_p->>'online_url','')),''),
    capacity = nullif(_p->>'capacity','')::int, visibility = coalesce(_p->>'visibility', visibility),
    starts_at = starts_at + _shift, ends_at = starts_at + _shift + make_interval(mins => _dur)
  WHERE (id = _event) OR (_whole_series AND _e.series_id IS NOT NULL AND series_id = _e.series_id AND starts_at > _e.starts_at AND status <> 'cancelled');
END; $$;

-- create_gathering also accepts lat/lng when present
CREATE OR REPLACE FUNCTION public.set_gathering_coords() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN RETURN NEW; END; $$;
DROP FUNCTION public.set_gathering_coords();

REVOKE EXECUTE ON FUNCTION public.create_gathering(uuid, jsonb, boolean, boolean), public.update_gathering(uuid, jsonb, boolean), public.gathering_validate(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_gathering(uuid, jsonb, boolean, boolean), public.update_gathering(uuid, jsonb, boolean) TO authenticated;