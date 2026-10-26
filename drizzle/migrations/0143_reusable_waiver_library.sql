CREATE TABLE public.waiver_library(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,owner_id uuid NOT NULL, name text NOT NULL,body_en text NOT NULL,body_es text NOT NULL DEFAULT '',version int NOT NULL DEFAULT 1,archived boolean NOT NULL DEFAULT false,updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.waiver_library TO authenticated; GRANT ALL ON public.waiver_library TO service_role;
ALTER TABLE public.waiver_library ENABLE ROW LEVEL SECURITY;
CREATE POLICY library_managers ON public.waiver_library FOR SELECT TO authenticated USING(public.team_capability(team_id,'events'));
CREATE TABLE public.waiver_library_versions(waiver_id uuid REFERENCES public.waiver_library(id) ON DELETE CASCADE,version int NOT NULL,name text NOT NULL,body_en text NOT NULL,body_es text NOT NULL,content_sha256 text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(waiver_id,version));
GRANT SELECT ON public.waiver_library_versions TO authenticated; GRANT ALL ON public.waiver_library_versions TO service_role;
ALTER TABLE public.waiver_library_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY library_history_managers ON public.waiver_library_versions FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.waiver_library w WHERE w.id=waiver_id AND public.team_capability(w.team_id,'events')));
CREATE TRIGGER library_version_immutable BEFORE UPDATE ON public.waiver_library_versions FOR EACH ROW EXECUTE FUNCTION public.block_history_rewrite();
ALTER TABLE public.event_waivers ADD COLUMN library_id uuid REFERENCES public.waiver_library(id), ADD COLUMN library_version int;
CREATE UNIQUE INDEX event_library_attachment ON public.event_waivers(event_id,library_id) WHERE library_id IS NOT NULL AND archived_at IS NULL;
CREATE OR REPLACE FUNCTION public.save_library_waiver(_team uuid,_id uuid,_name text,_en text,_es text,_archive boolean DEFAULT false) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE w public.waiver_library; v int; id uuid;
BEGIN
 IF NOT public.team_capability(_team,'events') THEN RAISE EXCEPTION 'forbidden'; END IF;
 IF length(trim(_name)) NOT BETWEEN 1 AND 120 OR length(trim(_en)) NOT BETWEEN 1 AND 12000 OR length(coalesce(_es,''))>12000 THEN RAISE EXCEPTION 'invalid_waiver'; END IF;
 IF _id IS NULL THEN INSERT INTO public.waiver_library(team_id,owner_id,name,body_en,body_es) VALUES(_team,auth.uid(),trim(_name),trim(_en),trim(coalesce(_es,''))) RETURNING * INTO w;
 ELSE SELECT * INTO w FROM public.waiver_library WHERE waiver_library.id=_id AND team_id=_team FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'forbidden'; END IF;
 UPDATE public.waiver_library SET name=trim(_name),body_en=trim(_en),body_es=trim(coalesce(_es,'')),version=w.version+CASE WHEN (w.name,w.body_en,w.body_es) IS DISTINCT FROM(trim(_name),trim(_en),trim(coalesce(_es,''))) THEN 1 ELSE 0 END,archived=_archive,updated_at=now() WHERE waiver_library.id=_id RETURNING * INTO w;
 END IF;
 INSERT INTO public.waiver_library_versions(waiver_id,version,name,body_en,body_es,content_sha256) VALUES(w.id,w.version,w.name,w.body_en,w.body_es,public.policy_text_sha(concat_ws(chr(31),w.name,w.body_en,w.body_es))) ON CONFLICT DO NOTHING;
 RETURN w.id;
END $$;
REVOKE ALL ON FUNCTION public.save_library_waiver(uuid,uuid,text,text,text,boolean) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.save_library_waiver(uuid,uuid,text,text,text,boolean) TO authenticated;
CREATE OR REPLACE FUNCTION public.attach_library_waiver(_event uuid,_waiver uuid,_version int) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e public.events; w public.waiver_library; v public.waiver_library_versions; id uuid;
BEGIN
 SELECT * INTO e FROM public.events WHERE events.id=_event;
 IF NOT public.can_manage_event(_event) THEN RAISE EXCEPTION 'forbidden'; END IF;
 SELECT * INTO w FROM public.waiver_library WHERE waiver_library.id=_waiver AND team_id=e.team_id AND NOT archived;
 IF NOT FOUND OR NOT public.team_capability(w.team_id,'events') THEN RAISE EXCEPTION 'forbidden'; END IF;
 SELECT * INTO v FROM public.waiver_library_versions WHERE waiver_id=w.id AND version=_version;
 IF NOT FOUND THEN RAISE EXCEPTION 'waiver_stale'; END IF;
 SELECT event_waivers.id INTO id FROM public.event_waivers WHERE event_id=e.id AND library_id=w.id AND archived_at IS NULL;
 IF id IS NOT NULL THEN RETURN id; END IF;
 INSERT INTO public.event_waivers(event_id,library_id,library_version,title_en,title_es,body_en,body_es,required) VALUES(e.id,w.id,v.version,v.name,v.name,v.body_en,v.body_es,true) RETURNING event_waivers.id INTO id;
 RETURN id;
END $$;
REVOKE ALL ON FUNCTION public.attach_library_waiver(uuid,uuid,int) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.attach_library_waiver(uuid,uuid,int) TO authenticated;