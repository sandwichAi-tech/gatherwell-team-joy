ALTER TABLE public.events ADD COLUMN IF NOT EXISTS builder_draft jsonb;
COMMENT ON COLUMN public.events.builder_draft IS 'Private editable form snapshot for incomplete drafts; never used for published event or guest reads.';
CREATE OR REPLACE FUNCTION public.save_event_builder_draft(_team uuid, _event uuid, _snapshot jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _id uuid; _safe jsonb; _existing public.events;
BEGIN
 IF auth.uid() IS NULL OR jsonb_typeof(_snapshot) <> 'object' OR octet_length(_snapshot::text)>150000 THEN RAISE EXCEPTION 'invalid_draft'; END IF;
 IF _event IS NOT NULL THEN
  SELECT * INTO _existing FROM public.events WHERE id=_event;
  IF _existing.id IS NULL OR _existing.status <> 'draft' OR NOT public.can_manage_event(_event) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  _id:=_event;
 ELSE
  IF NOT public.is_team_member(_team,ARRAY['leader','host']) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  _safe:=jsonb_build_object('title',coalesce(nullif(left(trim(_snapshot->>'title'),120),''),'Untitled event'),'starts_at',now()+interval '7 days','duration_minutes',60,'visibility','invite','capacity','','cover_style',0);
  _id:=public.create_gathering_at(_team,_safe,false,false);
 END IF;
 UPDATE public.events SET builder_draft=_snapshot, title=coalesce(nullif(left(trim(_snapshot->>'title'),120),''),title) WHERE id=_id AND status='draft';
 RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.save_event_builder_draft(uuid,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_event_builder_draft(uuid,uuid,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.event_minimum_publish_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.status='published' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM 'published') THEN
  IF length(trim(coalesce(NEW.title,'')))=0 THEN RAISE EXCEPTION 'invalid_title'; END IF;
  IF NEW.starts_at IS NULL OR nullif(NEW.timezone,'') IS NULL OR NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=NEW.timezone) THEN RAISE EXCEPTION 'date_required'; END IF;
  IF NEW.format NOT IN ('person','online','hybrid') THEN RAISE EXCEPTION 'invalid_format'; END IF;
  IF NEW.format IN ('person','hybrid') AND nullif(trim(NEW.location_name),'') IS NULL AND nullif(trim(NEW.address),'') IS NULL THEN RAISE EXCEPTION 'place_required'; END IF;
  IF NEW.format IN ('online','hybrid') AND coalesce(NEW.online_url,'') !~* '^https://[^/[:space:]]+([/][^[:space:]]*)?$' THEN RAISE EXCEPTION 'invalid_url'; END IF;
  NEW.builder_draft:=NULL;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER event_minimum_publish_guard BEFORE INSERT OR UPDATE OF status ON public.events FOR EACH ROW EXECUTE FUNCTION public.event_minimum_publish_guard();