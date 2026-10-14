CREATE OR REPLACE FUNCTION public.storage_allows(_bytes bigint)
 RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); _mb int;
BEGIN
  IF _uid IS NULL THEN RETURN false; END IF;
  -- A first profile photo up to 5 MB is always allowed, even before any team or plan.
  IF greatest(_bytes, 0) <= 5 * 1024 * 1024 AND EXISTS (SELECT 1 FROM profiles WHERE id = _uid AND avatar_url IS NULL) THEN RETURN true; END IF;
  _mb := coalesce((plan_limits(effective_plan(_uid)->>'plan')->>'storage_mb')::int, 0);
  RETURN storage_used_bytes(_uid) + greatest(_bytes, 0) <= _mb::bigint * 1024 * 1024;
END; $function$;