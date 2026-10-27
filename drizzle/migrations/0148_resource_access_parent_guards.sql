CREATE OR REPLACE FUNCTION public.can_access_offer(_offer uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM offers o WHERE o.id=_offer AND (o.host_id=auth.uid() OR (o.placement IS NULL AND is_team_member(o.team_id,ARRAY['leader'])) OR (resource_is_live(o.available_from) AND (o.placement IS NULL OR o.status='published') AND (o.parent_course_id IS NULL OR public.can_access_offer(o.parent_course_id)) AND ((o.price_cents=0 AND can_use_team_templates(o.team_id)) OR EXISTS(SELECT 1 FROM offer_purchases p WHERE p.offer_id=o.id AND p.user_id=auth.uid() AND (p.paused_until IS NULL OR p.paused_until<=now()) AND (p.status='paid' OR (p.status IN ('active','past_due') AND (p.renews_at IS NULL OR p.renews_at>now()-interval '3 days')))) OR EXISTS(SELECT 1 FROM entitlements e WHERE e.offer_id=o.id AND e.user_id=auth.uid() AND e.revoked_at IS NULL AND e.starts_at<=now() AND (e.ends_at IS NULL OR e.ends_at>now()))))));
$$;
CREATE POLICY "Contained offer access gate" ON public.offers AS RESTRICTIVE FOR SELECT TO authenticated USING (parent_course_id IS NULL OR host_id=auth.uid() OR public.can_access_offer(parent_course_id));
CREATE OR REPLACE FUNCTION public.resource_commerce_access(_offer uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM offers o WHERE o.id=_offer AND (o.host_id=auth.uid() OR (o.status='published' AND resource_is_live(o.available_from) AND (o.parent_course_id IS NULL OR public.can_access_offer(o.parent_course_id)) AND (o.price_cents=0 OR EXISTS(SELECT 1 FROM offer_purchases p WHERE p.offer_id=o.id AND p.user_id=auth.uid() AND (p.paused_until IS NULL OR p.paused_until<=now()) AND (p.status='paid' OR (p.status IN ('active','past_due') AND (p.renews_at IS NULL OR p.renews_at>now()-interval '3 days')))) OR EXISTS(SELECT 1 FROM entitlements e WHERE e.offer_id=o.id AND e.user_id=auth.uid() AND e.revoked_at IS NULL AND e.starts_at<=now() AND (e.ends_at IS NULL OR e.ends_at>now()))))));
$$;
CREATE POLICY "Contained recipe course membership" ON public.recipes FOR SELECT TO authenticated USING (is_published AND parent_course_id IS NOT NULL AND public.can_access_offer(parent_course_id));
CREATE OR REPLACE FUNCTION public.resource_course_attachments(_course uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT CASE WHEN NOT public.can_access_offer(_course) THEN '[]'::jsonb ELSE coalesce((SELECT jsonb_agg(x.row) FROM (
 SELECT jsonb_build_object('id',r.id,'kind','recipe','title_en',r.title_en,'title_es',r.title_es) row FROM recipes r WHERE r.parent_course_id=_course AND r.is_published
 UNION ALL SELECT jsonb_build_object('id',o.id,'kind','offer','title_en',o.title_en,'title_es',o.title_es) FROM offers o WHERE o.parent_course_id=_course AND o.status='published'
 UNION ALL SELECT jsonb_build_object('id',q.id,'kind','quiz','title_en',q.title_en,'title_es',q.title_es) FROM quizzes q JOIN offers o ON o.id=q.commerce_offer_id WHERE o.parent_course_id=_course AND q.is_published
 ) x),'[]'::jsonb) END;
$$;
REVOKE ALL ON FUNCTION public.resource_course_attachments(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.resource_course_attachments(uuid) TO authenticated;
COMMENT ON COLUMN public.tracks.commerce_offer_id IS 'Standalone resource commerce reuses offers; distinct from offer_id course containment.';
COMMENT ON COLUMN public.offers.resource_type IS 'Resource presentation type; offer kind remains the existing commerce contract.';