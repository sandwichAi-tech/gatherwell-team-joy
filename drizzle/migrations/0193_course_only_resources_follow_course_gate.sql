-- A resource placed only in courses (Team Resources and coach page both unchecked) is readable only through a course the caller can access, never via plain team membership.
CREATE OR REPLACE FUNCTION public.can_read_track(_track uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM tracks t WHERE t.id=_track AND (can_edit_track(t.id) OR (t.is_published AND resource_is_live(t.available_from) AND (t.commerce_offer_id IS NULL OR resource_commerce_access(t.commerce_offer_id)) AND CASE WHEN t.offer_id IS NOT NULL THEN can_access_offer(t.offer_id) ELSE (coalesce(t.on_team,true) AND can_use_team_templates(t.team_id)) OR t.visibility IN ('public','unlisted') OR public.resource_course_included('track',t.id) END)));
$$;
CREATE POLICY "Course-only tracks need course access" ON public.tracks AS RESTRICTIVE FOR SELECT TO authenticated USING (can_edit_track(id) OR offer_id IS NOT NULL OR coalesce(on_team,true) OR coalesce(on_coach,false) OR public.resource_course_included('track',id));
CREATE POLICY "Course-only recipes need course access" ON public.recipes AS RESTRICTIVE FOR SELECT TO authenticated USING (created_by=auth.uid() OR is_team_member(team_id,ARRAY['leader']) OR coalesce(on_team,true) OR coalesce(on_coach,false) OR public.resource_course_included('recipe',id));
CREATE POLICY "Course-only downloads need course access" ON public.offers AS RESTRICTIVE FOR SELECT TO authenticated USING (host_id=auth.uid() OR kind<>'download' OR coalesce(on_team,true) OR coalesce(on_coach,false) OR public.resource_course_included('offer',id));

CREATE OR REPLACE FUNCTION public.can_access_offer(_offer uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM offers o WHERE o.id=_offer AND (o.host_id=auth.uid() OR (o.kind='download' AND o.status='published' AND public.resource_course_included('offer',o.id)) OR (o.placement IS NULL AND is_team_member(o.team_id,ARRAY['leader'])) OR (resource_is_live(o.available_from) AND (o.placement IS NULL OR o.status='published') AND (o.parent_course_id IS NULL OR public.can_access_offer(o.parent_course_id)) AND ((o.price_cents=0 AND can_use_team_templates(o.team_id) AND (o.kind<>'download' OR coalesce(o.on_team,true) OR coalesce(o.on_coach,false))) OR EXISTS(SELECT 1 FROM offer_purchases p WHERE p.offer_id=o.id AND p.user_id=auth.uid() AND (p.paused_until IS NULL OR p.paused_until<=now()) AND (p.status='paid' OR (p.status IN ('active','past_due') AND (p.renews_at IS NULL OR p.renews_at>now()-interval '3 days')))) OR EXISTS(SELECT 1 FROM entitlements e WHERE e.offer_id=o.id AND e.user_id=auth.uid() AND e.revoked_at IS NULL AND e.starts_at<=now() AND (e.ends_at IS NULL OR e.ends_at>now()))))));
$$;

CREATE OR REPLACE FUNCTION public.quiz_access_error(_quiz uuid) RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE z quizzes; o offers; l lessons;
BEGIN
 IF auth.uid() IS NULL THEN RETURN 'not_found'; END IF;
 SELECT * INTO z FROM quizzes WHERE id=_quiz AND is_published;
 IF NOT FOUND THEN RETURN 'not_found'; END IF;
 IF z.offer_id IS NULL THEN
  IF z.host_id=auth.uid() THEN RETURN NULL; END IF;
  IF z.commerce_offer_id IS NOT NULL AND NOT resource_commerce_access(z.commerce_offer_id) THEN RETURN 'no_access'; END IF;
  IF coalesce(z.on_coach,z.placement='coach') OR public.resource_course_included('quiz',z.id) THEN RETURN NULL; END IF;
  IF NOT coalesce(z.on_team,true) OR NOT is_team_member(z.team_id,ARRAY['leader','host','member']) THEN RETURN 'not_found'; END IF; RETURN NULL;
 END IF;
 SELECT * INTO o FROM offers WHERE id=z.offer_id;
 IF o.status<>'published' AND o.host_id<>auth.uid() THEN RETURN 'not_found'; END IF;
 IF o.host_id<>auth.uid() AND NOT can_access_offer(o.id) THEN RETURN 'no_access'; END IF;
 IF z.lesson_id IS NOT NULL THEN
  SELECT * INTO l FROM lessons WHERE id=z.lesson_id;
  IF l IS NULL OR NOT l.is_published THEN RETURN 'not_found'; END IF;
  IF NOT lesson_is_unlocked(l.id) THEN RETURN 'locked'; END IF;
  IF l.prerequisite_lesson_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM lesson_progress WHERE lesson_id=l.prerequisite_lesson_id AND user_id=auth.uid() AND completed_at IS NOT NULL) THEN RETURN 'prerequisite'; END IF;
 ELSIF o.host_id<>auth.uid() AND EXISTS(SELECT 1 FROM lessons l2 JOIN tracks t ON t.id=l2.track_id WHERE t.offer_id=z.offer_id AND t.is_published AND l2.is_published AND NOT EXISTS(SELECT 1 FROM lesson_progress lp WHERE lp.lesson_id=l2.id AND lp.user_id=auth.uid() AND lp.completed_at IS NOT NULL)) THEN RETURN 'prerequisite'; END IF;
 RETURN NULL;
END $$;
