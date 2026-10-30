ALTER TABLE public.lesson_summaries ADD COLUMN IF NOT EXISTS source_hash text;
COMMENT ON COLUMN public.lesson_summaries.source_hash IS 'Hash of the lesson notes and file at the time the summary was saved; a different current hash means the summary may be out of date.';

CREATE OR REPLACE FUNCTION public.lesson_source_hash(_lesson uuid)
 RETURNS text LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public'
AS $$
  SELECT md5(coalesce(notes_en,'') || E'\x1f' || coalesce(notes_es,'') || E'\x1f' || coalesce(storage_path,'') || E'\x1f' || coalesce(attachments::text,''))
  FROM public.lessons WHERE id = _lesson
$$;
GRANT EXECUTE ON FUNCTION public.lesson_source_hash(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.lesson_summary_stamp_source()
 RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.summary_en IS DISTINCT FROM OLD.summary_en OR NEW.summary_es IS DISTINCT FROM OLD.summary_es
     OR NEW.points_en IS DISTINCT FROM OLD.points_en OR NEW.points_es IS DISTINCT FROM OLD.points_es THEN
    NEW.source_hash := public.lesson_source_hash(NEW.lesson_id);
  ELSE
    NEW.source_hash := OLD.source_hash;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS lesson_summary_stamp_source ON public.lesson_summaries;
CREATE TRIGGER lesson_summary_stamp_source BEFORE INSERT OR UPDATE ON public.lesson_summaries FOR EACH ROW EXECUTE FUNCTION public.lesson_summary_stamp_source();