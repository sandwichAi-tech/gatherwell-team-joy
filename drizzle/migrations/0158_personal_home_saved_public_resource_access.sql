DO $$ DECLARE definition text; BEGIN
 definition:=pg_get_functiondef('public.personal_home()'::regprocedure);
 definition:=replace(definition,'AND public.can_access_offer(o.id) END','AND (public.can_access_offer(o.id) OR (o.placement=''coach'' AND o.visibility=''public'' AND o.price_cents=0 AND o.parent_course_id IS NULL)) END');
 EXECUTE definition;
END $$;