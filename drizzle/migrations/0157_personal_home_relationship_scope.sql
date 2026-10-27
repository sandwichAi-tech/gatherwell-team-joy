CREATE OR REPLACE FUNCTION public.home_offer_relationship(_offer uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM offers o WHERE o.id=_offer AND o.status='published' AND resource_is_live(o.available_from) AND (
 EXISTS(SELECT 1 FROM entitlements e WHERE e.offer_id=o.id AND e.user_id=auth.uid() AND e.revoked_at IS NULL AND e.starts_at<=now() AND (e.ends_at IS NULL OR e.ends_at>now()))
 OR EXISTS(SELECT 1 FROM offer_purchases p WHERE p.offer_id=o.id AND p.user_id=auth.uid() AND (p.paused_until IS NULL OR p.paused_until<=now()) AND (p.status='paid' OR (p.status IN ('active','past_due') AND (p.renews_at IS NULL OR p.renews_at>now()))))))
$$;
REVOKE ALL ON FUNCTION public.home_offer_relationship(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.home_offer_relationship(uuid) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.personal_home()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); hosting boolean; result jsonb;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
 SELECT coalesce(p.view_mode='hosting',p.role_intent IN ('host','leader'),false) INTO hosting FROM profiles p WHERE p.id=uid;
 hosting:=coalesce(hosting,false);
 SELECT jsonb_build_object('mode',CASE WHEN hosting THEN 'hosting' ELSE 'attending' END,
 'events',coalesce((SELECT jsonb_agg(row_to_json(x) ORDER BY x.starts_at) FROM (
 SELECT e.id,e.title,e.starts_at,e.ends_at,e.location_name,e.address,e.lat,e.lng,e.map_url,e.format,e.status,
 CASE WHEN hosting THEN NULL ELSE r.status END registration_status,
 CASE WHEN NOT hosting AND r.status='going' THEN r.checkin_code ELSE NULL END checkin_code,
 CASE WHEN NOT hosting THEN r.checked_in_at ELSE NULL END checked_in_at
 FROM events e LEFT JOIN rsvps r ON NOT hosting AND r.event_id=e.id AND r.user_id=uid AND r.status IN ('going','waitlist','maybe') AND r.merged_into_rsvp_id IS NULL
 WHERE e.status='published' AND coalesce(e.ends_at,e.starts_at+interval '2 hours')>=now()
 AND CASE WHEN hosting THEN (e.host_id=uid OR public.can_manage_event(e.id)) ELSE r.id IS NOT NULL END
 ORDER BY e.starts_at LIMIT 30) x),'[]'::jsonb),
 'drafts',CASE WHEN hosting THEN (SELECT count(*) FROM events e WHERE e.status='draft' AND (e.host_id=uid OR public.can_manage_event(e.id))) ELSE 0 END,
 'resources',coalesce((SELECT jsonb_agg(row_to_json(x)) FROM (
 SELECT o.id,'offer'::text entity,o.kind::text kind,o.title_en,o.title_es,o.price_cents,o.status
 FROM offers o WHERE CASE WHEN hosting THEN o.host_id=uid AND o.status<>'archived' ELSE o.status='published' AND resource_is_live(o.available_from) AND (public.home_offer_relationship(o.id) OR (o.price_cents=0 AND EXISTS(SELECT 1 FROM saved_offerings s WHERE s.user_id=uid AND s.kind='offer' AND s.target_id=o.id))) AND public.can_access_offer(o.id) END
 UNION ALL
 SELECT t.id,'track',t.resource_kind,t.title_en,t.title_es,coalesce(o.price_cents,0),CASE WHEN t.is_published THEN 'published' ELSE 'draft' END
 FROM tracks t LEFT JOIN offers o ON o.id=coalesce(t.commerce_offer_id,t.offer_id)
 WHERE CASE WHEN hosting THEN t.host_id=uid ELSE t.is_published AND public.can_read_track(t.id) AND (public.home_offer_relationship(coalesce(t.commerce_offer_id,t.offer_id)) OR EXISTS(SELECT 1 FROM entitlements en WHERE en.user_id=uid AND en.track_id=t.id AND en.revoked_at IS NULL AND en.starts_at<=now() AND (en.ends_at IS NULL OR en.ends_at>now()))) END
 UNION ALL
 SELECT r.id,'recipe','recipe',r.title_en,r.title_es,coalesce(o.price_cents,0),CASE WHEN r.is_published THEN 'published' ELSE 'draft' END
 FROM recipes r LEFT JOIN offers o ON o.id=r.commerce_offer_id
 WHERE CASE WHEN hosting THEN coalesce(r.private_owner,r.created_by)=uid ELSE r.is_published AND resource_is_live(r.available_from) AND (r.commerce_offer_id IS NULL OR public.resource_commerce_access(r.commerce_offer_id)) AND (r.parent_course_id IS NULL OR public.home_offer_relationship(r.parent_course_id)) AND (public.home_offer_relationship(r.commerce_offer_id) OR (EXISTS(SELECT 1 FROM saved_recipes s WHERE s.user_id=uid AND s.recipe_id=r.id) AND (r.commerce_offer_id IS NOT NULL OR EXISTS(SELECT 1 FROM teams tm WHERE tm.id=r.team_id AND public.team_channel_access(tm.id))))) END
 UNION ALL
 SELECT q.id,'quiz','quiz',q.title_en,q.title_es,coalesce(o.price_cents,0),CASE WHEN q.is_published THEN 'published' ELSE 'draft' END
 FROM quizzes q LEFT JOIN offers o ON o.id=q.commerce_offer_id
 WHERE CASE WHEN hosting THEN coalesce(q.host_id,q.created_by)=uid ELSE q.is_published AND q.lesson_id IS NULL AND public.home_offer_relationship(q.commerce_offer_id) AND public.resource_commerce_access(q.commerce_offer_id) END
 LIMIT 60) x),'[]'::jsonb),
 'coaches',CASE WHEN hosting THEN '[]'::jsonb ELSE coalesce((SELECT jsonb_agg(jsonb_build_object('id',p.id,'slug',p.slug,'name',p.full_name)) FROM profiles p WHERE p.host_public AND p.slug IS NOT NULL AND (EXISTS(SELECT 1 FROM follows f WHERE f.follower_id=uid AND f.target_kind='host' AND f.target_id=p.id) OR EXISTS(SELECT 1 FROM teams t WHERE t.owner_id=p.id AND t.owner_id<>uid AND public.team_channel_access(t.id,uid)))),'[]'::jsonb) END
 ) INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.personal_home() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.personal_home() TO authenticated,service_role;
COMMENT ON FUNCTION public.personal_home() IS 'Personal Home only: caller identity and persisted display mode; explicit relationships, no catalog or automatic team library. No contacts, purchases, progress or raw media paths.';