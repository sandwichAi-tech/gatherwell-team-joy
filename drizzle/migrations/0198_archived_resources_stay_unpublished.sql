CREATE OR REPLACE FUNCTION public.block_archived_publish()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
 IF NEW.archived_at IS NOT NULL AND NEW.is_published THEN RAISE EXCEPTION 'resource_archived'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS block_archived_publish ON public.tracks;
CREATE TRIGGER block_archived_publish BEFORE INSERT OR UPDATE ON public.tracks FOR EACH ROW EXECUTE FUNCTION public.block_archived_publish();
DROP TRIGGER IF EXISTS block_archived_publish ON public.recipes;
CREATE TRIGGER block_archived_publish BEFORE INSERT OR UPDATE ON public.recipes FOR EACH ROW EXECUTE FUNCTION public.block_archived_publish();
DROP TRIGGER IF EXISTS block_archived_publish ON public.quizzes;
CREATE TRIGGER block_archived_publish BEFORE INSERT OR UPDATE ON public.quizzes FOR EACH ROW EXECUTE FUNCTION public.block_archived_publish();
