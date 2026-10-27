CREATE OR REPLACE FUNCTION public.public_resource_metadata(_kind text,_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT CASE WHEN x IS NULL THEN NULL ELSE x-'cover_path'-'file_path'-'content'||jsonb_build_object('content',coalesce((SELECT jsonb_agg(l-'storage_path') FROM jsonb_array_elements(coalesce(x->'content','[]'::jsonb)) l),'[]'::jsonb)) END FROM (SELECT public.get_resource_page(_kind,_id) x) p; $$;
REVOKE ALL ON FUNCTION public.get_resource_page(text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_resource_page(text,uuid) TO authenticated,service_role;
REVOKE ALL ON FUNCTION public.public_resource_metadata(text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_resource_metadata(text,uuid) TO anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.resource_offer_parent_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.parent_course_id IS NOT NULL AND (NEW.parent_course_id=NEW.id OR NEW.kind='course' OR NOT EXISTS(SELECT 1 FROM offers WHERE id=NEW.parent_course_id AND kind='course' AND host_id=NEW.host_id AND team_id=NEW.team_id)) THEN RAISE EXCEPTION 'invalid_course'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER resource_offer_parent_guard BEFORE INSERT OR UPDATE ON public.offers FOR EACH ROW EXECUTE FUNCTION public.resource_offer_parent_guard();