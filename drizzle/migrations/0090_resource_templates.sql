CREATE TABLE public.resource_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('video_lesson','guide','mini_course','bundle','recipe','live_workshop','track')),
  target text NOT NULL CHECK (target IN ('track','course','download','recipe')),
  title_en text NOT NULL DEFAULT '' CHECK (length(title_en) <= 120),
  title_es text NOT NULL DEFAULT '' CHECK (length(title_es) <= 120),
  description_en text, description_es text,
  structure jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_kind text, source_id uuid,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX resource_templates_team_idx ON public.resource_templates(team_id);
GRANT SELECT, DELETE ON public.resource_templates TO authenticated;
GRANT ALL ON public.resource_templates TO service_role;
ALTER TABLE public.resource_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read starters and own team resource templates" ON public.resource_templates FOR SELECT TO authenticated
  USING (team_id IS NULL OR public.team_capability(team_id, 'content') OR public.is_team_member(team_id, ARRAY['leader']));
CREATE POLICY "Content builders delete team resource templates" ON public.resource_templates FOR DELETE TO authenticated
  USING (team_id IS NOT NULL AND (public.team_capability(team_id, 'content') OR public.is_team_member(team_id, ARRAY['leader'])));

CREATE OR REPLACE FUNCTION public.can_build_resources(_team uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND (public.team_capability(_team, 'content') OR public.is_team_member(_team, ARRAY['leader']));
$$;

CREATE OR REPLACE FUNCTION public.use_resource_template(_template uuid, _team uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.resource_templates; s jsonb; sec jsonb; l jsonb; it jsonb; new_id uuid; trk uuid; i int; j int;
  te text; ts text;
BEGIN
  IF _team IS NULL OR NOT public.can_build_resources(_team) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  SELECT * INTO r FROM public.resource_templates WHERE id = _template AND (team_id IS NULL OR team_id = _team);
  IF NOT FOUND THEN RAISE EXCEPTION 'template_not_found'; END IF;
  s := r.structure;
  te := left(coalesce(nullif(s->>'title_en',''), r.title_en), 120); ts := left(coalesce(nullif(s->>'title_es',''), r.title_es), 120);
  IF r.target = 'recipe' THEN
    INSERT INTO public.recipes (team_id, title_en, title_es, prep_minutes, tags, ingredients, steps, created_by, is_published)
    VALUES (_team, te, ts, nullif(s->>'prep_minutes','')::int,
      coalesce(ARRAY(SELECT jsonb_array_elements_text(coalesce(s->'tags','[]'::jsonb))), '{}'),
      coalesce(s->'ingredients', '{"en":[],"es":[]}'::jsonb), coalesce(s->'steps', '{"en":[],"es":[]}'::jsonb), auth.uid(), false)
    RETURNING id INTO new_id;
  ELSIF r.target = 'track' THEN
    INSERT INTO public.tracks (team_id, title_en, title_es, description_en, description_es, is_published)
    VALUES (_team, te, ts, coalesce(s->>'description_en', r.description_en), coalesce(s->>'description_es', r.description_es), false) RETURNING id INTO new_id;
    i := 0;
    FOR l IN SELECT * FROM jsonb_array_elements(coalesce(s->'lessons','[]'::jsonb)) LOOP
      INSERT INTO public.lessons (track_id, title_en, title_es, type, url, duration_minutes, notes_en, notes_es, description_en, description_es, sort_order, is_published)
      VALUES (new_id, left(coalesce(l->>'title_en',''),200), left(coalesce(l->>'title_es',''),200), coalesce(l->>'type','text'),
        CASE WHEN l->>'type' IN ('link','video') AND l->>'url' LIKE 'https://%' THEN l->>'url' END,
        nullif(l->>'duration_minutes','')::int, l->>'notes_en', l->>'notes_es', l->>'description_en', l->>'description_es', i, false);
      i := i + 1;
    END LOOP;
  ELSE
    INSERT INTO public.offers (host_id, team_id, kind, title_en, title_es, summary_en, summary_es, description_en, description_es, price_cents, status, visibility)
    VALUES (auth.uid(), _team, r.target, te, ts, s->>'summary_en', s->>'summary_es', coalesce(s->>'description_en', r.description_en), coalesce(s->>'description_es', r.description_es), 0, 'draft', 'team')
    RETURNING id INTO new_id;
    IF r.target = 'course' THEN
      i := 0;
      FOR sec IN SELECT * FROM jsonb_array_elements(coalesce(s->'sections','[]'::jsonb)) LOOP
        INSERT INTO public.tracks (team_id, offer_id, title_en, title_es, sort_order, is_published)
        VALUES (_team, new_id, left(coalesce(sec->>'title_en',''),200), left(coalesce(sec->>'title_es',''),200), i, false) RETURNING id INTO trk;
        j := 0;
        FOR l IN SELECT * FROM jsonb_array_elements(coalesce(sec->'lessons','[]'::jsonb)) LOOP
          INSERT INTO public.lessons (track_id, title_en, title_es, type, url, duration_minutes, notes_en, notes_es, description_en, description_es, sort_order, is_published)
          VALUES (trk, left(coalesce(l->>'title_en',''),200), left(coalesce(l->>'title_es',''),200), coalesce(l->>'type','text'),
            CASE WHEN l->>'type' IN ('link','video') AND l->>'url' LIKE 'https://%' THEN l->>'url' END,
            nullif(l->>'duration_minutes','')::int, l->>'notes_en', l->>'notes_es', l->>'description_en', l->>'description_es', j, false);
          j := j + 1;
        END LOOP;
        i := i + 1;
      END LOOP;
    ELSE
      i := 0;
      FOR it IN SELECT * FROM jsonb_array_elements(coalesce(s->'items','[]'::jsonb)) LOOP
        INSERT INTO public.offer_items (offer_id, sort_order, type, title_en, title_es, body_en, body_es, url, is_published)
        VALUES (new_id, i, coalesce(it->>'type','text'), left(coalesce(it->>'title_en',''),200), left(coalesce(it->>'title_es',''),200), it->>'body_en', it->>'body_es',
          CASE WHEN it->>'type' IN ('link','embed') AND it->>'url' LIKE 'https://%' THEN it->>'url' END, false);
        i := i + 1;
      END LOOP;
    END IF;
  END IF;
  INSERT INTO public.team_audit (team_id, actor, action, target, meta) VALUES (_team, auth.uid(), 'resource_template.used', new_id, jsonb_build_object('template', _template, 'target', r.target));
  RETURN jsonb_build_object('target', r.target, 'id', new_id);
END $$;

CREATE OR REPLACE FUNCTION public.save_resource_template(_source_kind text, _source uuid, _title_en text, _title_es text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _team uuid; _kind text; _target text; s jsonb; new_id uuid; tr public.tracks; o public.offers; rc public.recipes;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_allowed'; END IF;
  IF _source_kind = 'track' THEN
    SELECT * INTO tr FROM public.tracks WHERE id = _source AND offer_id IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
    _team := tr.team_id; _kind := 'track'; _target := 'track';
    s := jsonb_build_object('description_en', tr.description_en, 'description_es', tr.description_es, 'lessons', coalesce((
      SELECT jsonb_agg(jsonb_build_object('type', l.type, 'title_en', l.title_en, 'title_es', l.title_es, 'duration_minutes', l.duration_minutes,
        'notes_en', l.notes_en, 'notes_es', l.notes_es, 'description_en', l.description_en, 'description_es', l.description_es,
        'url', CASE WHEN l.type IN ('link','video') THEN l.url END, 'needs_asset', l.storage_path IS NOT NULL) ORDER BY l.sort_order, l.created_at)
      FROM public.lessons l WHERE l.track_id = tr.id), '[]'::jsonb));
  ELSIF _source_kind = 'offer' THEN
    SELECT * INTO o FROM public.offers WHERE id = _source AND kind IN ('course','download');
    IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
    _team := o.team_id; _target := o.kind; _kind := CASE WHEN o.kind = 'course' THEN 'mini_course' ELSE 'bundle' END;
    IF o.host_id <> auth.uid() AND NOT public.can_build_resources(_team) THEN RAISE EXCEPTION 'not_allowed'; END IF;
    s := jsonb_build_object('summary_en', o.summary_en, 'summary_es', o.summary_es, 'description_en', o.description_en, 'description_es', o.description_es,
      'sections', coalesce((SELECT jsonb_agg(jsonb_build_object('title_en', t.title_en, 'title_es', t.title_es, 'lessons', coalesce((
          SELECT jsonb_agg(jsonb_build_object('type', l.type, 'title_en', l.title_en, 'title_es', l.title_es, 'duration_minutes', l.duration_minutes,
            'notes_en', l.notes_en, 'notes_es', l.notes_es, 'description_en', l.description_en, 'description_es', l.description_es,
            'url', CASE WHEN l.type IN ('link','video') THEN l.url END, 'needs_asset', l.storage_path IS NOT NULL) ORDER BY l.sort_order, l.created_at)
          FROM public.lessons l WHERE l.track_id = t.id), '[]'::jsonb)) ORDER BY t.sort_order, t.created_at)
        FROM public.tracks t WHERE t.offer_id = o.id), '[]'::jsonb),
      'items', coalesce((SELECT jsonb_agg(jsonb_build_object('type', i.type, 'title_en', i.title_en, 'title_es', i.title_es, 'body_en', i.body_en, 'body_es', i.body_es,
          'url', CASE WHEN i.type IN ('link','embed') THEN i.url END, 'needs_asset', i.type = 'file') ORDER BY i.sort_order)
        FROM public.offer_items i WHERE i.offer_id = o.id AND i.replaced_by IS NULL), '[]'::jsonb));
  ELSIF _source_kind = 'recipe' THEN
    SELECT * INTO rc FROM public.recipes WHERE id = _source AND team_id IS NOT NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
    _team := rc.team_id; _kind := 'recipe'; _target := 'recipe';
    s := jsonb_build_object('prep_minutes', rc.prep_minutes, 'tags', to_jsonb(rc.tags), 'ingredients', rc.ingredients, 'steps', rc.steps);
  ELSE RAISE EXCEPTION 'not_found'; END IF;
  IF NOT public.can_build_resources(_team) AND NOT (_source_kind = 'offer' AND o.host_id = auth.uid() AND public.is_team_member(_team, NULL)) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  IF coalesce(btrim(_title_en),'') = '' AND coalesce(btrim(_title_es),'') = '' THEN RAISE EXCEPTION 'title_required'; END IF;
  INSERT INTO public.resource_templates (team_id, kind, target, title_en, title_es, structure, source_kind, source_id, created_by)
  VALUES (_team, _kind, _target, left(coalesce(btrim(_title_en),''),120), left(coalesce(btrim(_title_es),''),120), s, _source_kind, _source, auth.uid())
  RETURNING id INTO new_id;
  INSERT INTO public.team_audit (team_id, actor, action, target, meta) VALUES (_team, auth.uid(), 'resource_template.saved', new_id, jsonb_build_object('source_kind', _source_kind, 'source', _source));
  RETURN new_id;
END $$;

REVOKE EXECUTE ON FUNCTION public.can_build_resources(uuid), public.use_resource_template(uuid, uuid), public.save_resource_template(text, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_build_resources(uuid), public.use_resource_template(uuid, uuid), public.save_resource_template(text, uuid, text, text) TO authenticated;

INSERT INTO public.resource_templates (team_id, kind, target, sort_order, title_en, title_es, description_en, description_es, structure) VALUES
(NULL, 'video_lesson', 'track', 1, 'Quick video lesson', 'Lección rápida en video',
 'One short video with a takeaway and a next step.', 'Un video corto con una idea clave y un siguiente paso.',
 '{"lessons":[{"type":"video","duration_minutes":10,"title_en":"[Your lesson title]","title_es":"[Título de tu lección]","notes_en":"[Add your video link, then write the one idea people should remember.]","notes_es":"[Agrega el enlace de tu video y escribe la idea que deben recordar.]"},{"type":"text","duration_minutes":3,"title_en":"Try this next","title_es":"Prueba esto después","notes_en":"[One small action to take this week.]","notes_es":"[Una acción pequeña para esta semana.]"}]}'),
(NULL, 'guide', 'download', 2, 'Downloadable guide or worksheet', 'Guía o hoja de trabajo descargable',
 'A short introduction plus a file people can download.', 'Una breve introducción y un archivo para descargar.',
 '{"summary_en":"[What this guide helps people do]","summary_es":"[Qué ayuda a hacer esta guía]","items":[{"type":"text","title_en":"How to use this guide","title_es":"Cómo usar esta guía","body_en":"[Explain when and how to use the worksheet.]","body_es":"[Explica cuándo y cómo usar la hoja de trabajo.]"},{"type":"file","title_en":"[Upload your PDF or worksheet]","title_es":"[Sube tu PDF u hoja de trabajo]","needs_asset":true}]}'),
(NULL, 'mini_course', 'course', 3, 'Mini-course', 'Minicurso',
 'Three short lessons in one section, ready to edit.', 'Tres lecciones cortas en una sección, listas para editar.',
 '{"summary_en":"[Who this course is for and what they will learn]","summary_es":"[Para quién es este curso y qué aprenderán]","sections":[{"title_en":"Getting started","title_es":"Primeros pasos","lessons":[{"type":"text","duration_minutes":5,"title_en":"[Welcome and what to expect]","title_es":"[Bienvenida y qué esperar]"},{"type":"video","duration_minutes":10,"title_en":"[Core lesson]","title_es":"[Lección principal]"},{"type":"text","duration_minutes":5,"title_en":"[Practice and reflection]","title_es":"[Práctica y reflexión]"}]}]}'),
(NULL, 'bundle', 'download', 4, 'Resource bundle', 'Paquete de recursos',
 'A welcome note, a helpful link and a file, grouped together.', 'Una nota de bienvenida, un enlace útil y un archivo, en un solo lugar.',
 '{"summary_en":"[What is inside this bundle]","summary_es":"[Qué incluye este paquete]","items":[{"type":"text","title_en":"Start here","title_es":"Empieza aquí","body_en":"[A short welcome and how to use these resources.]","body_es":"[Una bienvenida corta y cómo usar estos recursos.]"},{"type":"link","title_en":"[Add a helpful link]","title_es":"[Agrega un enlace útil]"},{"type":"file","title_en":"[Upload a file]","title_es":"[Sube un archivo]","needs_asset":true}]}'),
(NULL, 'recipe', 'recipe', 5, 'Recipe', 'Receta',
 'Ingredients and steps with placeholders to replace.', 'Ingredientes y pasos con espacios para reemplazar.',
 '{"title_en":"[Recipe name]","title_es":"[Nombre de la receta]","prep_minutes":10,"tags":["quick"],"ingredients":{"en":["[Ingredient 1]","[Ingredient 2]"],"es":["[Ingrediente 1]","[Ingrediente 2]"]},"steps":{"en":["[Step 1]","[Step 2]"],"es":["[Paso 1]","[Paso 2]"]}}'),
(NULL, 'live_workshop', 'track', 6, 'Live workshop + replay', 'Taller en vivo + repetición',
 'A live session, then a place for the replay and follow-up.', 'Una sesión en vivo y luego un espacio para la repetición y el seguimiento.',
 '{"lessons":[{"type":"live","duration_minutes":60,"title_en":"[Workshop title]","title_es":"[Título del taller]","notes_en":"[Set the date and join link before publishing. Add the replay link afterwards.]","notes_es":"[Define la fecha y el enlace antes de publicar. Agrega la repetición después.]"},{"type":"text","duration_minutes":5,"title_en":"Follow-up","title_es":"Seguimiento","notes_en":"[Key takeaways and next steps.]","notes_es":"[Ideas clave y siguientes pasos.]"}]}');