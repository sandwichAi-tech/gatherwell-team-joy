-- Publishing/unpublishing a resource keeps every course placement in step, and a new-model resource cannot go live with no destination.
CREATE OR REPLACE FUNCTION public.resource_publish_destinations() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE k text; pub boolean; oldpub boolean; contained uuid;
BEGIN
 IF TG_TABLE_NAME='tracks' THEN k:='track'; pub:=NEW.is_published; oldpub:=OLD.is_published; contained:=NEW.offer_id;
 ELSIF TG_TABLE_NAME='recipes' THEN k:='recipe'; pub:=NEW.is_published; oldpub:=OLD.is_published; contained:=NEW.parent_course_id;
 ELSIF TG_TABLE_NAME='quizzes' THEN k:='quiz'; pub:=NEW.is_published; oldpub:=OLD.is_published; contained:=NEW.offer_id;
 ELSE
  IF NEW.kind<>'download' OR EXISTS(SELECT 1 FROM tracks WHERE commerce_offer_id=NEW.id) OR EXISTS(SELECT 1 FROM recipes WHERE commerce_offer_id=NEW.id) OR EXISTS(SELECT 1 FROM quizzes WHERE commerce_offer_id=NEW.id) THEN RETURN NEW; END IF;
  k:='offer'; pub:=NEW.status='published'; oldpub:=OLD.status='published'; contained:=NEW.parent_course_id;
 END IF;
 IF pub IS NOT DISTINCT FROM oldpub THEN RETURN NEW; END IF;
 UPDATE lessons l SET is_published=pub FROM tracks t WHERE t.id=l.track_id AND t.offer_id IS NOT NULL AND l.detached_at IS NULL AND l.is_published IS DISTINCT FROM pub
  AND CASE k WHEN 'track' THEN l.resource_track_id=NEW.id WHEN 'recipe' THEN l.resource_recipe_id=NEW.id WHEN 'quiz' THEN l.resource_quiz_id=NEW.id ELSE l.resource_offer_id=NEW.id END;
 IF pub AND NEW.on_team IS NOT NULL AND NOT NEW.on_team AND NOT coalesce(NEW.on_coach,false) AND contained IS NULL AND NOT EXISTS(
  SELECT 1 FROM lessons l JOIN tracks t ON t.id=l.track_id WHERE t.offer_id IS NOT NULL AND l.detached_at IS NULL
   AND CASE k WHEN 'track' THEN l.resource_track_id=NEW.id WHEN 'recipe' THEN l.resource_recipe_id=NEW.id WHEN 'quiz' THEN l.resource_quiz_id=NEW.id ELSE l.resource_offer_id=NEW.id END)
 THEN RAISE EXCEPTION 'destination_required'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER resource_publish_destinations AFTER UPDATE OF is_published ON public.tracks FOR EACH ROW EXECUTE FUNCTION public.resource_publish_destinations();
CREATE TRIGGER resource_publish_destinations AFTER UPDATE OF is_published ON public.recipes FOR EACH ROW EXECUTE FUNCTION public.resource_publish_destinations();
CREATE TRIGGER resource_publish_destinations AFTER UPDATE OF is_published ON public.quizzes FOR EACH ROW EXECUTE FUNCTION public.resource_publish_destinations();
CREATE TRIGGER resource_publish_destinations AFTER UPDATE OF status ON public.offers FOR EACH ROW EXECUTE FUNCTION public.resource_publish_destinations();
