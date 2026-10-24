-- 0068: get_public_offer gains a quizzes array — published quiz metadata only
-- (id, titles, required flag). No questions, options, keys, or scoring data.

CREATE OR REPLACE FUNCTION public.get_public_offer(_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
        'description_en', t.description_en, t.description_es,
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
    ), '[]'::jsonb),
    'quizzes', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', qz.id, 'title_en', qz.title_en, 'title_es', qz.title_es,
        'lesson_id', qz.lesson_id, 'is_required', qz.is_required, 'pass_pct', qz.pass_pct,
        'time_limit_minutes', qz.time_limit_minutes
      ) ORDER BY qz.sort_order, qz.created_at)
      FROM public.quizzes qz WHERE qz.offer_id = o.id AND qz.is_published
    ), '[]'::jsonb)
  );
END;
$function$;