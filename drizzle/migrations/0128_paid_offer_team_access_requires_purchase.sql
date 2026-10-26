-- Team membership alone opens only free team offers; paid offers need a purchase or an entitlement (the host is the seller).
CREATE OR REPLACE FUNCTION public.can_access_offer(_offer uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.offers o WHERE o.id = _offer AND (
      o.host_id = auth.uid()
      OR public.is_team_member(o.team_id, ARRAY['leader'])
      OR (public.resource_is_live(o.available_from) AND (
        (COALESCE(o.price_cents, 0) = 0 AND public.can_use_team_templates(o.team_id))
        OR EXISTS (SELECT 1 FROM public.offer_purchases p WHERE p.offer_id = o.id AND p.user_id = auth.uid() AND p.status IN ('active','past_due','paid'))
        OR EXISTS (SELECT 1 FROM public.entitlements e WHERE e.offer_id = o.id AND e.user_id = auth.uid() AND e.revoked_at IS NULL AND (e.ends_at IS NULL OR e.ends_at > now()))))
    ));
$function$;