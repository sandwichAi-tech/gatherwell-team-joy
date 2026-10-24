CREATE OR REPLACE FUNCTION public.offer_readiness(_offer uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE o public.offers; b text[] := '{}'; n_tracks int; n_lessons int; n_items int;
BEGIN
  SELECT * INTO o FROM public.offers WHERE id = _offer AND host_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF length(trim(coalesce(o.title_en,''))) = 0 AND length(trim(coalesce(o.title_es,''))) = 0 THEN b := array_append(b, 'missing_title'); END IF;
  IF length(trim(coalesce(o.summary_en,''))) = 0 AND length(trim(coalesce(o.summary_es,''))) = 0 THEN b := array_append(b, 'missing_summary'); END IF;
  IF length(trim(coalesce(o.description_en,''))) = 0 AND length(trim(coalesce(o.description_es,''))) = 0 THEN b := array_append(b, 'missing_description'); END IF;
  IF o.kind = 'download' THEN
    SELECT count(*) INTO n_items FROM public.offer_items i WHERE i.offer_id = o.id AND i.is_published AND i.replaced_by IS NULL;
    IF o.file_path IS NULL AND n_items = 0 THEN b := array_append(b, 'missing_file'); END IF;
  END IF;
  IF o.kind IN ('course','membership') THEN
    SELECT count(*) INTO n_tracks FROM public.tracks t WHERE t.offer_id = o.id AND t.is_published;
    SELECT count(*) INTO n_lessons FROM public.lessons l JOIN public.tracks t ON t.id = l.track_id WHERE t.offer_id = o.id AND t.is_published AND l.is_published;
    IF n_tracks = 0 THEN b := array_append(b, 'no_sections'); END IF;
    IF n_lessons = 0 THEN b := array_append(b, 'no_lessons'); END IF;
  END IF;
  IF o.price_cents > 0 THEN b := array_append(b, 'paid_setup_required'); END IF;
  RETURN jsonb_build_object('blockers', b, 'sections', coalesce(n_tracks,0), 'lessons', coalesce(n_lessons,0));
END;
$function$;