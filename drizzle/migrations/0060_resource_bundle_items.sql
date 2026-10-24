-- Ordered bundle items for download/resource offers, with version history on replace.
CREATE TABLE public.offer_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  sort_order int NOT NULL DEFAULT 0,
  type text NOT NULL DEFAULT 'text' CHECK (type IN ('text','file','link','embed')),
  title_en text NOT NULL DEFAULT '',
  title_es text NOT NULL DEFAULT '',
  body_en text,
  body_es text,
  url text,
  storage_path text,
  is_preview boolean NOT NULL DEFAULT false,
  allow_download boolean NOT NULL DEFAULT true,
  is_published boolean NOT NULL DEFAULT false,
  replaced_by uuid REFERENCES public.offer_items(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX offer_items_offer_idx ON public.offer_items(offer_id, sort_order);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.offer_items TO authenticated;
GRANT ALL ON public.offer_items TO service_role;
ALTER TABLE public.offer_items ENABLE ROW LEVEL SECURITY;
-- Host manages their own offer's items
CREATE POLICY "Host manages bundle items" ON public.offer_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.offers o WHERE o.id = offer_id AND o.host_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.offers o WHERE o.id = offer_id AND o.host_id = auth.uid()));
-- Entitled learners read published items of offers they can access
CREATE POLICY "Entitled read published bundle items" ON public.offer_items FOR SELECT TO authenticated
  USING (is_published AND EXISTS (SELECT 1 FROM public.offers o WHERE o.id = offer_id AND public.can_access_offer(o.id)));

-- Replace an item with a new version; the old row stays (replaced_by set) so prior entitled-version history is preserved
CREATE OR REPLACE FUNCTION public.replace_offer_item(_item uuid, _p jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE old public.offer_items; new_id uuid := gen_random_uuid();
BEGIN
  SELECT * INTO old FROM public.offer_items WHERE id = _item;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.offers o WHERE o.id = old.offer_id AND o.host_id = auth.uid()) THEN RAISE EXCEPTION 'not_found'; END IF;
  INSERT INTO public.offer_items (id, offer_id, sort_order, type, title_en, title_es, body_en, body_es, url, storage_path, is_preview, allow_download, is_published)
  VALUES (new_id, old.offer_id, old.sort_order,
    coalesce(_p->>'type', old.type), coalesce(_p->>'title_en', old.title_en), coalesce(_p->>'title_es', old.title_es),
    coalesce(_p->>'body_en', old.body_en), coalesce(_p->>'body_es', old.body_es),
    coalesce(_p->>'url', old.url), coalesce(_p->>'storage_path', old.storage_path),
    coalesce((_p->>'is_preview')::boolean, old.is_preview), coalesce((_p->>'allow_download')::boolean, old.allow_download), true);
  UPDATE public.offer_items SET replaced_by = new_id, is_published = false WHERE id = old.id;
  RETURN new_id;
END; $$;

-- Public payload: bundle items for download offers (metadata only — no storage_path, no signed URLs)
CREATE OR REPLACE FUNCTION public.get_public_offer(_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE o public.offers; host_name text;
BEGIN
  SELECT * INTO o FROM public.offers WHERE id = _id AND status = 'published' AND visibility IN ('public','unlisted');
  IF o.id IS NULL THEN RETURN NULL; END IF;
  SELECT p.full_name INTO host_name FROM public.profiles p WHERE p.id = o.host_id;
  RETURN jsonb_build_object(
    'id', o.id, 'kind', o.kind,
    'title_en', o.title_en, 'title_es', o.title_es,
    'summary_en', o.summary_en, 'summary_es', o.summary_es,
    'description_en', o.description_en, 'description_es', o.description_es,
    'includes_en', o.includes_en, 'includes_es', o.includes_es,
    'category', o.category, 'tags', o.tags,
    'cover_style', o.cover_style, 'cover_url', o.cover_url,
    'host_name', host_name, 'coauthor_name', o.coauthor_name,
    'accessibility_notes', o.accessibility_notes,
    'version_label', o.version_label, 'license_en', o.license_en, 'license_es', o.license_es,
    'price_cents', o.price_cents, 'currency', o.currency, 'billing_interval', o.billing_interval,
    'enroll_opens_at', o.enroll_opens_at, 'enroll_closes_at', o.enroll_closes_at,
    'sections', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', t.id, 'title_en', t.title_en, 'title_es', t.title_es,
        'description_en', t.description_en, 'description_es', t.description_es,
        'lessons', (SELECT jsonb_agg(jsonb_build_object(
            'id', l.id, 'title_en', l.title_en, 'title_es', l.title_es,
            'type', l.type, 'duration_minutes', l.duration_minutes, 'is_preview', l.is_preview
          ) ORDER BY l.sort_order, l.created_at)
          FROM public.lessons l WHERE l.track_id = t.id AND l.is_published)
      ) ORDER BY t.sort_order, t.created_at)
      FROM public.tracks t WHERE t.offer_id = o.id AND t.is_published
    ), '[]'::jsonb),
    'items', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', i.id, 'type', i.type, 'title_en', i.title_en, 'title_es', i.title_es,
        'is_preview', i.is_preview, 'allow_download', i.allow_download
      ) ORDER BY i.sort_order, i.created_at)
      FROM public.offer_items i WHERE i.offer_id = o.id AND i.is_published AND i.replaced_by IS NULL
    ), '[]'::jsonb)
  );
END; $$;

-- Readiness: a download offer needs a file or at least one published bundle item
CREATE OR REPLACE FUNCTION public.offer_readiness(_offer uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE o public.offers; b text[] := '{}'; n_tracks int; n_lessons int; n_items int;
BEGIN
  SELECT * INTO o FROM public.offers WHERE id = _offer AND host_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF length(trim(coalesce(o.title_en,''))) = 0 AND length(trim(coalesce(o.title_es,''))) = 0 THEN b := b || 'missing_title'; END IF;
  IF length(trim(coalesce(o.summary_en,''))) = 0 AND length(trim(coalesce(o.summary_es,''))) = 0 THEN b := b || 'missing_summary'; END IF;
  IF length(trim(coalesce(o.description_en,''))) = 0 AND length(trim(coalesce(o.description_es,''))) = 0 THEN b := b || 'missing_description'; END IF;
  IF o.kind = 'download' THEN
    SELECT count(*) INTO n_items FROM public.offer_items i WHERE i.offer_id = o.id AND i.is_published AND i.replaced_by IS NULL;
    IF o.file_path IS NULL AND n_items = 0 THEN b := b || 'missing_file'; END IF;
  END IF;
  IF o.kind IN ('course','membership') THEN
    SELECT count(*) INTO n_tracks FROM public.tracks t WHERE t.offer_id = o.id AND t.is_published;
    SELECT count(*) INTO n_lessons FROM public.lessons l JOIN public.tracks t ON t.id = l.track_id WHERE t.offer_id = o.id AND t.is_published AND l.is_published;
    IF n_tracks = 0 THEN b := b || 'no_sections'; END IF;
    IF n_lessons = 0 THEN b := b || 'no_lessons'; END IF;
  END IF;
  IF o.price_cents > 0 THEN b := b || 'paid_setup_required'; END IF;
  RETURN jsonb_build_object('blockers', b, 'sections', coalesce(n_tracks,0), 'lessons', coalesce(n_lessons,0));
END; $$;