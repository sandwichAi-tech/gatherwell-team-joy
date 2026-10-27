ALTER TABLE public.tracks ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.quizzes ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- True when any placement, access, purchase or learner record exists for the resource.
CREATE OR REPLACE FUNCTION public.resource_protected(_kind text, _id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r record; o uuid;
BEGIN
 IF _kind='track' THEN SELECT * INTO r FROM tracks WHERE id=_id; IF NOT FOUND THEN RETURN false; END IF; o:=r.commerce_offer_id;
  IF r.is_published OR r.archived_at IS NOT NULL OR coalesce(r.on_team,false) OR coalesce(r.on_coach,false)
   OR EXISTS(SELECT 1 FROM lessons WHERE resource_track_id=_id)
   OR EXISTS(SELECT 1 FROM entitlements WHERE track_id=_id) OR EXISTS(SELECT 1 FROM orders WHERE track_id=_id)
   OR EXISTS(SELECT 1 FROM lesson_progress p JOIN lessons l ON l.id=p.lesson_id WHERE l.track_id=_id)
   OR EXISTS(SELECT 1 FROM quiz_attempts a JOIN quizzes q ON q.id=a.quiz_id JOIN lessons l ON l.id=q.lesson_id WHERE l.track_id=_id) THEN RETURN true; END IF;
 ELSIF _kind='recipe' THEN SELECT * INTO r FROM recipes WHERE id=_id; IF NOT FOUND THEN RETURN false; END IF; o:=r.commerce_offer_id;
  IF r.is_published OR r.archived_at IS NOT NULL OR coalesce(r.on_team,false) OR coalesce(r.on_coach,false) OR r.parent_course_id IS NOT NULL
   OR EXISTS(SELECT 1 FROM lessons WHERE resource_recipe_id=_id) OR EXISTS(SELECT 1 FROM saved_recipes WHERE recipe_id=_id) THEN RETURN true; END IF;
 ELSIF _kind='quiz' THEN SELECT * INTO r FROM quizzes WHERE id=_id; IF NOT FOUND THEN RETURN false; END IF; o:=r.commerce_offer_id;
  IF r.is_published OR r.archived_at IS NOT NULL OR coalesce(r.on_team,false) OR coalesce(r.on_coach,false)
   OR EXISTS(SELECT 1 FROM lessons WHERE resource_quiz_id=_id)
   OR EXISTS(SELECT 1 FROM quiz_attempts WHERE quiz_id=_id) OR EXISTS(SELECT 1 FROM assessment_receipts WHERE quiz_id=_id) THEN RETURN true; END IF;
 ELSIF _kind='offer' THEN SELECT * INTO r FROM offers WHERE id=_id; IF NOT FOUND THEN RETURN false; END IF; o:=_id;
  IF r.status<>'draft' OR coalesce(r.on_team,false) OR coalesce(r.on_coach,false) OR EXISTS(SELECT 1 FROM lessons WHERE resource_offer_id=_id)
   OR EXISTS(SELECT 1 FROM certificates WHERE offer_id=_id)
   OR EXISTS(SELECT 1 FROM lesson_progress p JOIN lessons l ON l.id=p.lesson_id JOIN tracks t ON t.id=l.track_id WHERE t.offer_id=_id)
   OR EXISTS(SELECT 1 FROM quiz_attempts a JOIN quizzes q ON q.id=a.quiz_id WHERE q.offer_id=_id) THEN RETURN true; END IF;
 ELSE RETURN false; END IF;
 RETURN o IS NOT NULL AND (EXISTS(SELECT 1 FROM entitlements WHERE offer_id=o) OR EXISTS(SELECT 1 FROM orders WHERE offer_id=o) OR EXISTS(SELECT 1 FROM offer_purchases WHERE offer_id=o) OR EXISTS(SELECT 1 FROM offer_grants WHERE offer_id=o));
END $$;
REVOKE ALL ON FUNCTION public.resource_protected(text,uuid) FROM public, anon;

CREATE OR REPLACE FUNCTION public.resource_owner_ok(_kind text, _id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
 SELECT auth.uid() IS NOT NULL AND CASE _kind
  WHEN 'track' THEN EXISTS(SELECT 1 FROM tracks WHERE id=_id) AND can_edit_track(_id)
  WHEN 'recipe' THEN EXISTS(SELECT 1 FROM recipes WHERE id=_id AND (created_by=auth.uid() OR is_team_member(team_id,ARRAY['leader'])))
  WHEN 'quiz' THEN EXISTS(SELECT 1 FROM quizzes WHERE id=_id) AND can_edit_quiz(_id)
  WHEN 'offer' THEN EXISTS(SELECT 1 FROM offers WHERE id=_id AND host_id=auth.uid())
  ELSE false END $$;
REVOKE ALL ON FUNCTION public.resource_owner_ok(text,uuid) FROM public, anon;

-- What removing would do: 'delete' only for an untouched draft, otherwise 'archive'.
CREATE OR REPLACE FUNCTION public.resource_removal_plan(_kind text, _id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
 IF NOT resource_owner_ok(_kind,_id) THEN RAISE EXCEPTION 'not_allowed'; END IF;
 RETURN jsonb_build_object('action',CASE WHEN resource_protected(_kind,_id) THEN 'archive' ELSE 'delete' END,'destinations',resource_destinations(_kind,_id));
END $$;
REVOKE ALL ON FUNCTION public.resource_removal_plan(text,uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.resource_removal_plan(text,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.remove_resource(_kind text, _id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE o uuid;
BEGIN
 IF NOT resource_owner_ok(_kind,_id) THEN RAISE EXCEPTION 'not_allowed'; END IF;
 IF NOT resource_protected(_kind,_id) THEN
  IF _kind='track' THEN DELETE FROM tracks WHERE id=_id; ELSIF _kind='recipe' THEN DELETE FROM recipes WHERE id=_id; ELSIF _kind='quiz' THEN DELETE FROM quizzes WHERE id=_id; ELSE DELETE FROM offers WHERE id=_id; END IF;
  RETURN 'deleted';
 END IF;
 -- Archive: off every placement and out of new discovery/sale; rows, access and history stay.
 UPDATE lessons SET detached_at=coalesce(detached_at,now()), is_published=false WHERE CASE _kind WHEN 'track' THEN resource_track_id=_id WHEN 'recipe' THEN resource_recipe_id=_id WHEN 'quiz' THEN resource_quiz_id=_id ELSE resource_offer_id=_id END;
 IF _kind='track' THEN UPDATE tracks SET is_published=false,on_team=false,on_coach=false,archived_at=coalesce(archived_at,now()) WHERE id=_id RETURNING commerce_offer_id INTO o;
 ELSIF _kind='recipe' THEN UPDATE recipes SET is_published=false,on_team=false,on_coach=false,archived_at=coalesce(archived_at,now()) WHERE id=_id RETURNING commerce_offer_id INTO o;
 ELSIF _kind='quiz' THEN UPDATE quizzes SET is_published=false,on_team=false,on_coach=false,archived_at=coalesce(archived_at,now()) WHERE id=_id RETURNING commerce_offer_id INTO o;
 ELSE o:=_id; END IF;
 IF o IS NOT NULL THEN UPDATE offers SET status='archived',on_team=false,on_coach=false WHERE id=o; END IF;
 RETURN 'archived';
END $$;
REVOKE ALL ON FUNCTION public.remove_resource(text,uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.remove_resource(text,uuid) TO authenticated;

-- Restore returns an archived resource as an unplaced draft; the host re-chooses destinations.
CREATE OR REPLACE FUNCTION public.restore_resource(_kind text, _id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE o uuid;
BEGIN
 IF NOT resource_owner_ok(_kind,_id) THEN RAISE EXCEPTION 'not_allowed'; END IF;
 IF _kind='track' THEN UPDATE tracks SET archived_at=NULL WHERE id=_id RETURNING commerce_offer_id INTO o;
 ELSIF _kind='recipe' THEN UPDATE recipes SET archived_at=NULL WHERE id=_id RETURNING commerce_offer_id INTO o;
 ELSIF _kind='quiz' THEN UPDATE quizzes SET archived_at=NULL WHERE id=_id RETURNING commerce_offer_id INTO o;
 ELSE o:=_id; END IF;
 IF o IS NOT NULL THEN UPDATE offers SET status='draft' WHERE id=o AND status='archived'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.restore_resource(text,uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.restore_resource(text,uuid) TO authenticated;

-- No signed-in action may cascade-delete protected history; backend jobs (no auth.uid) are unaffected.
CREATE OR REPLACE FUNCTION public.guard_resource_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE k text;
BEGIN
 IF auth.uid() IS NULL THEN RETURN OLD; END IF;
 k:=CASE TG_TABLE_NAME WHEN 'tracks' THEN 'track' WHEN 'recipes' THEN 'recipe' WHEN 'quizzes' THEN 'quiz' ELSE 'offer' END;
 IF resource_protected(k,OLD.id) THEN RAISE EXCEPTION 'resource_has_history' USING ERRCODE='P0001'; END IF;
 RETURN OLD;
END $$;
CREATE OR REPLACE FUNCTION public.guard_lesson_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
 IF auth.uid() IS NULL THEN RETURN OLD; END IF;
 IF EXISTS(SELECT 1 FROM lesson_progress WHERE lesson_id=OLD.id) OR EXISTS(SELECT 1 FROM quiz_attempts a JOIN quizzes q ON q.id=a.quiz_id WHERE q.lesson_id=OLD.id) THEN RAISE EXCEPTION 'resource_has_history' USING ERRCODE='P0001'; END IF;
 RETURN OLD;
END $$;
DROP TRIGGER IF EXISTS guard_resource_delete ON public.tracks;
CREATE TRIGGER guard_resource_delete BEFORE DELETE ON public.tracks FOR EACH ROW EXECUTE FUNCTION public.guard_resource_delete();
DROP TRIGGER IF EXISTS guard_resource_delete ON public.recipes;
CREATE TRIGGER guard_resource_delete BEFORE DELETE ON public.recipes FOR EACH ROW EXECUTE FUNCTION public.guard_resource_delete();
DROP TRIGGER IF EXISTS guard_resource_delete ON public.quizzes;
CREATE TRIGGER guard_resource_delete BEFORE DELETE ON public.quizzes FOR EACH ROW EXECUTE FUNCTION public.guard_resource_delete();
DROP TRIGGER IF EXISTS guard_resource_delete ON public.offers;
CREATE TRIGGER guard_resource_delete BEFORE DELETE ON public.offers FOR EACH ROW EXECUTE FUNCTION public.guard_resource_delete();
DROP TRIGGER IF EXISTS guard_lesson_delete ON public.lessons;
CREATE TRIGGER guard_lesson_delete BEFORE DELETE ON public.lessons FOR EACH ROW EXECUTE FUNCTION public.guard_lesson_delete();
