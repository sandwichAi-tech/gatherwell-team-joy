DO $$ DECLARE definition text; BEGIN
 SELECT pg_get_functiondef('public.personal_home()'::regprocedure) INTO definition;
 IF position('hosting THEN t.host_id=uid ELSE t.is_published' in definition)=0 OR position('hosting THEN o.host_id=uid AND o.status' in definition)=0 THEN RAISE EXCEPTION 'personal_home_shape_changed'; END IF;
 definition:=replace(definition,'hosting THEN o.host_id=uid AND o.status','hosting THEN (o.host_id=uid OR public.can_manage_offering(''offer'',o.id)) AND o.status');
 definition:=replace(definition,'hosting THEN t.host_id=uid ELSE t.is_published','hosting THEN (t.host_id=uid OR public.can_edit_track(t.id)) ELSE t.is_published AND resource_is_live(t.available_from)');
 definition:=replace(definition,'EXISTS(SELECT 1 FROM saved_recipes s WHERE s.user_id=uid AND s.recipe_id=r.id) AND','EXISTS(SELECT 1 FROM saved_recipes s WHERE s.user_id=uid AND s.recipe_id=r.id) AND (coalesce(r.on_team,true) OR coalesce(r.on_coach,r.placement=''coach'') OR public.resource_course_included(''recipe'',r.id)) AND');
 EXECUTE definition;
END $$;