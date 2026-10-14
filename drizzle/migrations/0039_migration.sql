CREATE OR REPLACE FUNCTION public.event_price(_id uuid)
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN e.price_cents IS NULL OR e.price_cents <= 0 THEN NULL ELSE jsonb_build_object('price_cents', e.price_cents, 'pass_fee', e.pass_fee,
    'fee_pct', current_fee_pct(e.host_id), 'cover_service_fee', e.cover_service_fee,
    'service_fee_percent', ps.service_fee_percent, 'service_fee_fixed', ps.service_fee_fixed, 'refund_policy', e.refund_policy) END
  FROM events e
  LEFT JOIN plan_settings ps ON ps.plan = CASE WHEN effective_plan(e.host_id)->>'plan' IN ('pro','growth') THEN effective_plan(e.host_id)->>'plan' ELSE 'free' END
  WHERE e.id = _id AND e.status = 'published' AND (e.visibility = 'public' OR public.can_view_event(e.id));
$function$;