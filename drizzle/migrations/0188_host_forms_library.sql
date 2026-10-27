ALTER TABLE public.waiver_library ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '', ADD COLUMN IF NOT EXISTS form_kind text NOT NULL DEFAULT 'waiver';
ALTER TABLE public.waiver_library_versions ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '', ADD COLUMN IF NOT EXISTS form_kind text NOT NULL DEFAULT 'waiver';
ALTER TABLE public.waiver_library ADD CONSTRAINT waiver_library_form_kind_chk CHECK (form_kind IN ('waiver','release','media','other') AND length(description)<=500);
ALTER TABLE public.waiver_library_versions ADD CONSTRAINT waiver_library_versions_form_kind_chk CHECK (form_kind IN ('waiver','release','media','other'));

-- Display-safe PDF name: letters, digits, space, dot, dash, underscore; always ends .pdf; never a path.
CREATE OR REPLACE FUNCTION public.safe_form_file_name(_n text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path=public AS $$
  SELECT CASE WHEN _n IS NULL THEN NULL ELSE left(coalesce(nullif(btrim(regexp_replace(regexp_replace(regexp_replace(_n,'^.*[\\/]',''),'\.pdf$','','i'),'[^A-Za-z0-9 ._-]+','-','g'),' .-'),''),'document'),100)||'.pdf' END $$;

CREATE OR REPLACE FUNCTION public.save_host_form(_team uuid, _id uuid, _name text, _description text, _kind text, _en text, _es text, _file text DEFAULT NULL, _filename text DEFAULT NULL, _archive boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $function$
DECLARE w waiver_library; fname text := public.safe_form_file_name(_filename); d text := btrim(coalesce(_description,''));
BEGIN
  IF auth.uid() IS NULL OR EXISTS(SELECT 1 FROM user_suspensions WHERE user_id=auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _kind IS NULL OR _kind NOT IN ('waiver','release','media','other') OR length(d)>500 OR length(btrim(coalesce(_name,''))) NOT BETWEEN 1 AND 120 OR length(coalesce(_en,''))>12000 OR length(coalesce(_es,''))>12000 OR (length(btrim(coalesce(_en,'')))=0 AND _file IS NULL) THEN RAISE EXCEPTION 'invalid_waiver'; END IF;
  IF _file IS NOT NULL AND (_file NOT LIKE auth.uid()::text||'/host-waivers/%.pdf' OR _file LIKE '%..%' OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='media' AND name=_file AND (metadata->>'size')::bigint<=10485760 AND metadata->>'mimetype'='application/pdf')) THEN RAISE EXCEPTION 'invalid_file'; END IF;
  IF _file IS NULL THEN fname := NULL; END IF;
  IF _id IS NULL THEN
    IF NOT team_capability(_team,'events') THEN RAISE EXCEPTION 'forbidden'; END IF;
    INSERT INTO waiver_library(team_id,owner_id,name,description,form_kind,body_en,body_es,file_path,file_name) VALUES(_team,auth.uid(),btrim(_name),d,_kind,btrim(coalesce(_en,'')),btrim(coalesce(_es,'')),_file,fname) RETURNING * INTO w;
  ELSE
    SELECT * INTO w FROM waiver_library WHERE id=_id AND owner_id=auth.uid() FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'forbidden'; END IF;
    UPDATE waiver_library SET name=btrim(_name),description=d,form_kind=_kind,body_en=btrim(coalesce(_en,'')),body_es=btrim(coalesce(_es,'')),file_path=_file,file_name=fname,
      version=w.version+CASE WHEN (w.name,w.description,w.form_kind,w.body_en,w.body_es,w.file_path) IS DISTINCT FROM (btrim(_name),d,_kind,btrim(coalesce(_en,'')),btrim(coalesce(_es,'')),_file) THEN 1 ELSE 0 END,
      archived=_archive,is_default=CASE WHEN _archive THEN false ELSE is_default END,updated_at=now() WHERE id=w.id RETURNING * INTO w;
  END IF;
  INSERT INTO waiver_library_versions(waiver_id,version,name,description,form_kind,body_en,body_es,content_sha256,file_path,file_name)
  VALUES(w.id,w.version,w.name,w.description,w.form_kind,w.body_en,w.body_es,policy_text_sha(concat_ws(chr(31),w.name,w.body_en,w.body_es,w.file_path,w.description,w.form_kind)),w.file_path,w.file_name) ON CONFLICT DO NOTHING;
  RETURN w.id;
END $function$;
REVOKE ALL ON FUNCTION public.save_host_form(uuid,uuid,text,text,text,text,text,text,text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_host_form(uuid,uuid,text,text,text,text,text,text,text,boolean) TO authenticated;

-- Legacy entry point keeps existing description/type.
CREATE OR REPLACE FUNCTION public.save_host_waiver(_team uuid, _id uuid, _name text, _en text, _es text, _file text DEFAULT NULL, _filename text DEFAULT NULL, _archive boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $function$
DECLARE d text := ''; k text := 'waiver';
BEGIN
  IF _id IS NOT NULL THEN SELECT description,form_kind INTO d,k FROM waiver_library WHERE id=_id AND owner_id=auth.uid(); END IF;
  RETURN public.save_host_form(_team,_id,_name,coalesce(d,''),coalesce(k,'waiver'),_en,_es,_file,_filename,_archive);
END $function$;

CREATE OR REPLACE FUNCTION public.attach_library_waiver(_event uuid, _waiver uuid, _version integer)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $function$
DECLARE e events; w waiver_library; v waiver_library_versions; wid uuid; av int; ek text;
BEGIN
  SELECT * INTO e FROM events WHERE id=_event FOR UPDATE;
  IF e.host_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO w FROM waiver_library WHERE id=_waiver AND owner_id=e.host_id AND NOT archived;
  IF NOT FOUND THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO v FROM waiver_library_versions WHERE waiver_id=w.id AND version=_version;
  IF NOT FOUND THEN RAISE EXCEPTION 'waiver_stale'; END IF;
  ek := CASE v.form_kind WHEN 'release' THEN 'release' WHEN 'media' THEN 'media' ELSE 'waiver' END;
  SELECT id,library_version INTO wid,av FROM event_waivers WHERE event_id=e.id AND library_id=w.id AND archived_at IS NULL;
  IF wid IS NOT NULL AND av=_version THEN RETURN wid; END IF;
  IF e.status<>'draft' OR e.agreements_locked THEN RAISE EXCEPTION 'waiver_pinned'; END IF;
  IF wid IS NOT NULL THEN
    UPDATE event_waivers SET kind=ek,library_version=v.version,title_en=v.name,title_es=v.name,body_en=v.body_en,body_es=v.body_es,file_path=v.file_path,file_name=v.file_name WHERE id=wid;
  ELSE
    INSERT INTO event_waivers(event_id,library_id,library_version,kind,title_en,title_es,body_en,body_es,file_path,file_name,required,position)
    VALUES(e.id,w.id,v.version,ek,v.name,v.name,v.body_en,v.body_es,v.file_path,v.file_name,true,coalesce((SELECT max(position)+1 FROM event_waivers WHERE event_id=e.id AND archived_at IS NULL),0)) RETURNING id INTO wid;
  END IF;
  RETURN wid;
END $function$;

-- Host-only, draft-only order for selected library forms; must name exactly the active library selections.
CREATE OR REPLACE FUNCTION public.reorder_event_host_forms(_event uuid, _library uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $function$
DECLARE e events; i int;
BEGIN
  SELECT * INTO e FROM events WHERE id=_event FOR UPDATE;
  IF e.host_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF e.status<>'draft' OR e.agreements_locked THEN RAISE EXCEPTION 'waiver_pinned'; END IF;
  IF _library IS NULL OR cardinality(_library)<>(SELECT count(DISTINCT x) FROM unnest(_library) x)
     OR ARRAY(SELECT x FROM unnest(_library) x ORDER BY x) IS DISTINCT FROM ARRAY(SELECT library_id FROM event_waivers WHERE event_id=e.id AND archived_at IS NULL AND library_id IS NOT NULL ORDER BY library_id)
  THEN RAISE EXCEPTION 'order_mismatch'; END IF;
  FOR i IN 1..cardinality(_library) LOOP
    UPDATE event_waivers SET position=i-1 WHERE event_id=e.id AND library_id=_library[i] AND archived_at IS NULL;
  END LOOP;
END $function$;
REVOKE ALL ON FUNCTION public.reorder_event_host_forms(uuid,uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reorder_event_host_forms(uuid,uuid[]) TO authenticated;

-- Caller-owned usage counts only (never other hosts' events).
CREATE OR REPLACE FUNCTION public.host_form_usage()
RETURNS TABLE(library_id uuid, drafts integer, published integer) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT w.library_id, count(DISTINCT e.id) FILTER (WHERE e.status='draft')::int, count(DISTINCT e.id) FILTER (WHERE e.status<>'draft')::int
  FROM event_waivers w JOIN events e ON e.id=w.event_id JOIN waiver_library l ON l.id=w.library_id AND l.owner_id=auth.uid()
  WHERE auth.uid() IS NOT NULL AND w.archived_at IS NULL AND e.host_id=auth.uid() AND e.status<>'cancelled'
  GROUP BY w.library_id $$;
REVOKE ALL ON FUNCTION public.host_form_usage() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.host_form_usage() TO authenticated;