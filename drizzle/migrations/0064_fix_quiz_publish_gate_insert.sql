-- 0064: quiz publish gate must not run quiz_blockers on INSERT (row invisible to the
-- security-definer function at BEFORE INSERT time). New quizzes are always created as
-- drafts; publishing happens via UPDATE once questions exist.

CREATE OR REPLACE FUNCTION public.quiz_enforce_publish()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.is_published THEN RAISE EXCEPTION 'quiz_not_ready'; END IF;
    RETURN NEW;
  END IF;
  IF NEW.is_published AND (OLD.is_published IS DISTINCT FROM true) THEN
    IF cardinality(public.quiz_blockers(NEW.id)) > 0 THEN RAISE EXCEPTION 'quiz_not_ready'; END IF;
  END IF;
  RETURN NEW;
END;
$function$;