CREATE OR REPLACE FUNCTION public.assessment_collection_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE content text;
BEGIN
 IF TG_TABLE_NAME='quizzes' THEN
  IF TG_OP='UPDATE' AND OLD.assessment_config IS NOT NULL AND NEW.assessment_config IS NULL THEN RAISE EXCEPTION 'assessment_identity_locked'; END IF;
  IF NEW.assessment_config IS NOT NULL THEN
   IF NEW.is_published THEN RAISE EXCEPTION 'approved_assessment_content_required'; END IF;
   IF TG_OP='UPDATE' AND EXISTS(SELECT 1 FROM quiz_attempts WHERE quiz_id=OLD.id) THEN RAISE EXCEPTION 'assessment_history_locked'; END IF;
   IF jsonb_typeof(NEW.assessment_config)<>'object' OR NEW.assessment_config->>'kind' IS DISTINCT FROM 'wellness_assessment' OR length(NEW.assessment_config::text)>150000 THEN RAISE EXCEPTION 'invalid_assessment'; END IF;
   SELECT string_agg(v,' ') INTO content FROM (
    SELECT NEW.assessment_config->>'title_en' v UNION ALL SELECT NEW.assessment_config->>'title_es' UNION ALL SELECT NEW.assessment_config->>'description_en' UNION ALL SELECT NEW.assessment_config->>'description_es'
    UNION ALL SELECT q->>'prompt' FROM jsonb_array_elements(coalesce(NEW.assessment_config->'questions','[]')) q
    UNION ALL SELECT o->>'label' FROM jsonb_array_elements(coalesce(NEW.assessment_config->'questions','[]')) q CROSS JOIN LATERAL jsonb_array_elements(coalesce(q->'options','[]')) o
    UNION ALL SELECT r->>'title' FROM jsonb_array_elements(coalesce(NEW.assessment_config->'results','[]')) r
    UNION ALL SELECT r->>'body' FROM jsonb_array_elements(coalesce(NEW.assessment_config->'results','[]')) r
   ) texts;
   IF public.has_blocked_claim(content) THEN RAISE EXCEPTION 'blocked_claim'; END IF;
  END IF;
 ELSE IF EXISTS(SELECT 1 FROM quizzes WHERE id=NEW.quiz_id AND assessment_config IS NOT NULL) THEN RAISE EXCEPTION 'approved_assessment_content_required'; END IF;
 END IF;
 RETURN NEW;
END $$;