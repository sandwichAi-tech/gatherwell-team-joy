-- Offers: authoring metadata, visibility, enrollment window, commerce config
ALTER TABLE public.offers ADD COLUMN visibility text NOT NULL DEFAULT 'team';
ALTER TABLE public.offers ADD COLUMN summary_en text;
ALTER TABLE public.offers ADD COLUMN summary_es text;
ALTER TABLE public.offers ADD COLUMN category text;
ALTER TABLE public.offers ADD COLUMN tags text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.offers ADD COLUMN support_email text;
ALTER TABLE public.offers ADD COLUMN accessibility_notes text;
ALTER TABLE public.offers ADD COLUMN coauthor_name text;
ALTER TABLE public.offers ADD COLUMN version_label text;
ALTER TABLE public.offers ADD COLUMN license_en text;
ALTER TABLE public.offers ADD COLUMN license_es text;
ALTER TABLE public.offers ADD COLUMN billing_interval text;
ALTER TABLE public.offers ADD COLUMN currency text NOT NULL DEFAULT 'usd';
ALTER TABLE public.offers ADD COLUMN enroll_opens_at timestamptz;
ALTER TABLE public.offers ADD COLUMN enroll_closes_at timestamptz;
ALTER TABLE public.offers ADD CONSTRAINT offers_visibility_check CHECK (visibility IN ('team','public','unlisted','private'));
ALTER TABLE public.offers ADD CONSTRAINT offers_billing_interval_check CHECK (billing_interval IS NULL OR billing_interval IN ('month','year'));

-- Lessons: descriptions, draft/preview, prerequisites, attachments, linked live event, new types
ALTER TABLE public.lessons ADD COLUMN description_en text;
ALTER TABLE public.lessons ADD COLUMN description_es text;
ALTER TABLE public.lessons ADD COLUMN is_preview boolean NOT NULL DEFAULT false;
ALTER TABLE public.lessons ADD COLUMN is_published boolean NOT NULL DEFAULT true;
ALTER TABLE public.lessons ADD COLUMN prerequisite_lesson_id uuid REFERENCES public.lessons(id) ON DELETE SET NULL;
ALTER TABLE public.lessons ADD COLUMN attachments jsonb NOT NULL DEFAULT '[]';
ALTER TABLE public.lessons ADD COLUMN event_id uuid;
ALTER TABLE public.lessons DROP CONSTRAINT lessons_type_check;
ALTER TABLE public.lessons ADD CONSTRAINT lessons_type_check CHECK (type IN ('video','pdf','link','live','text','audio','file'));

-- Instructor notes: host/editor-only, never exposed to learners
CREATE TABLE public.lesson_instructor_notes (
  lesson_id uuid PRIMARY KEY REFERENCES public.lessons(id) ON DELETE CASCADE,
  notes_en text,
  notes_es text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_instructor_notes TO authenticated;
GRANT ALL ON public.lesson_instructor_notes TO service_role;
ALTER TABLE public.lesson_instructor_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Editors manage instructor notes" ON public.lesson_instructor_notes FOR ALL TO authenticated
  USING (public.can_edit_track((SELECT l.track_id FROM public.lessons l WHERE l.id = lesson_id)))
  WITH CHECK (public.can_edit_track((SELECT l.track_id FROM public.lessons l WHERE l.id = lesson_id)));

-- Audited manual grants
CREATE TABLE public.offer_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  granted_by uuid NOT NULL,
  granted_to uuid NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.offer_grants TO authenticated;
GRANT ALL ON public.offer_grants TO service_role;
ALTER TABLE public.offer_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Host or recipient reads grants" ON public.offer_grants FOR SELECT TO authenticated
  USING (granted_by = auth.uid() OR granted_to = auth.uid());

-- Access helper: host, team member, live purchaser, or active entitlement holder
CREATE OR REPLACE FUNCTION public.can_access_offer(_offer uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.offers o WHERE o.id = _offer AND (
      o.host_id = auth.uid()
      OR public.can_use_team_templates(o.team_id)
      OR EXISTS (SELECT 1 FROM public.offer_purchases p WHERE p.offer_id = o.id AND p.user_id = auth.uid() AND p.status IN ('active','past_due','paid'))
      OR EXISTS (SELECT 1 FROM public.entitlements e WHERE e.offer_id = o.id AND e.user_id = auth.uid() AND e.revoked_at IS NULL AND (e.ends_at IS NULL OR e.ends_at > now()))
    )
  );
$$;

-- Discovery/access RLS additions
CREATE POLICY "Authenticated read published public offers" ON public.offers FOR SELECT TO authenticated
  USING (status = 'published' AND visibility IN ('public','unlisted'));
CREATE POLICY "Entitled read published tracks" ON public.tracks FOR SELECT TO authenticated
  USING (is_published AND offer_id IS NOT NULL AND public.can_access_offer(offer_id));
CREATE POLICY "Entitled read published lessons" ON public.lessons FOR SELECT TO authenticated
  USING (
    (is_published AND EXISTS (SELECT 1 FROM public.tracks t WHERE t.id = lessons.track_id AND t.offer_id IS NOT NULL AND public.can_access_offer(t.offer_id)))
    OR (is_preview AND is_published AND EXISTS (SELECT 1 FROM public.tracks t JOIN public.offers o ON o.id = t.offer_id WHERE t.id = lessons.track_id AND o.status = 'published' AND o.visibility IN ('public','unlisted')))
  );

-- Entitled learners read the lesson media and covers of offers they can access
CREATE POLICY "Entitled learners read learn media" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'learn-media' AND (
    EXISTS (SELECT 1 FROM public.lessons l JOIN public.tracks t ON t.id = l.track_id WHERE l.storage_path = name AND t.offer_id IS NOT NULL AND public.can_access_offer(t.offer_id))
    OR EXISTS (SELECT 1 FROM public.tracks t WHERE t.cover_url = name AND t.offer_id IS NOT NULL AND public.can_access_offer(t.offer_id))
  ));

-- Safe public payload for guest browsing (no file paths, no notes, real counts only)
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
    ), '[]'::jsonb)
  );
END; $$;

-- Free enrollment for any signed-in adult on a public/unlisted published free offer
CREATE OR REPLACE FUNCTION public.enroll_free(_offer uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE o public.offers;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_signed_in'; END IF;
  SELECT * INTO o FROM public.offers WHERE id = _offer AND status = 'published';
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF o.visibility NOT IN ('public','unlisted') AND NOT public.can_use_team_templates(o.team_id) THEN RAISE EXCEPTION 'not_found'; END IF;
  IF o.enroll_opens_at IS NOT NULL AND now() < o.enroll_opens_at THEN RAISE EXCEPTION 'enrollment_not_open'; END IF;
  IF o.enroll_closes_at IS NOT NULL AND now() > o.enroll_closes_at THEN RAISE EXCEPTION 'enrollment_closed'; END IF;
  IF o.price_cents > 0 THEN RAISE EXCEPTION 'payment_required'; END IF;
  INSERT INTO public.offer_purchases (offer_id, user_id, status, amount_cents)
  VALUES (o.id, auth.uid(), CASE WHEN o.kind = 'download' THEN 'paid' ELSE 'active' END, 0)
  ON CONFLICT (offer_id, user_id) DO NOTHING;
  IF NOT EXISTS (SELECT 1 FROM public.entitlements e WHERE e.offer_id = o.id AND e.user_id = auth.uid() AND e.revoked_at IS NULL) THEN
    INSERT INTO public.entitlements (user_id, kind, offer_id, source) VALUES (auth.uid(), 'offer', o.id, 'free_enrollment');
  END IF;
END; $$;

-- Publication readiness blockers (host-facing, truthful)
CREATE OR REPLACE FUNCTION public.offer_readiness(_offer uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE o public.offers; b text[] := '{}'; n_tracks int; n_lessons int;
BEGIN
  SELECT * INTO o FROM public.offers WHERE id = _offer AND o.host_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF length(trim(coalesce(o.title_en,''))) = 0 AND length(trim(coalesce(o.title_es,''))) = 0 THEN b := b || 'missing_title'; END IF;
  IF length(trim(coalesce(o.summary_en,''))) = 0 AND length(trim(coalesce(o.summary_es,''))) = 0 THEN b := b || 'missing_summary'; END IF;
  IF length(trim(coalesce(o.description_en,''))) = 0 AND length(trim(coalesce(o.description_es,''))) = 0 THEN b := b || 'missing_description'; END IF;
  IF o.kind = 'download' AND o.file_path IS NULL THEN b := b || 'missing_file'; END IF;
  IF o.kind IN ('course','membership') THEN
    SELECT count(*) INTO n_tracks FROM public.tracks t WHERE t.offer_id = o.id AND t.is_published;
    SELECT count(*) INTO n_lessons FROM public.lessons l JOIN public.tracks t ON t.id = l.track_id WHERE t.offer_id = o.id AND t.is_published AND l.is_published;
    IF n_tracks = 0 THEN b := b || 'no_sections'; END IF;
    IF n_lessons = 0 THEN b := b || 'no_lessons'; END IF;
  END IF;
  IF o.price_cents > 0 THEN b := b || 'paid_setup_required'; END IF;
  RETURN jsonb_build_object('blockers', b, 'sections', coalesce(n_tracks,0), 'lessons', coalesce(n_lessons,0));
END; $$;

-- Duplicate an offer with its sections and lessons (host only; copy starts as draft)
CREATE OR REPLACE FUNCTION public.duplicate_offer(_offer uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE o public.offers; new_id uuid := gen_random_uuid(); t record; new_track uuid;
BEGIN
  SELECT * INTO o FROM public.offers WHERE id = _offer AND host_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  INSERT INTO public.offers (id, host_id, team_id, kind, title_en, title_es, description_en, description_es, includes_en, includes_es,
    price_cents, cover_style, cover_url, file_path, drip_days, status, refund_policy,
    visibility, summary_en, summary_es, category, tags, support_email, accessibility_notes, coauthor_name,
    version_label, license_en, license_es, billing_interval, currency, enroll_opens_at, enroll_closes_at)
  VALUES (new_id, o.host_id, o.team_id, o.kind, left(o.title_en || ' (copy)', 120), left(o.title_es || ' (copia)', 120), o.description_en, o.description_es, o.includes_en, o.includes_es,
    o.price_cents, o.cover_style, o.cover_url, o.file_path, o.drip_days, 'draft', o.refund_policy,
    o.visibility, o.summary_en, o.summary_es, o.category, o.tags, o.support_email, o.accessibility_notes, o.coauthor_name,
    o.version_label, o.license_en, o.license_es, o.billing_interval, o.currency, o.enroll_opens_at, o.enroll_closes_at);
  FOR t IN SELECT * FROM public.tracks WHERE offer_id = o.id ORDER BY sort_order, created_at LOOP
    new_track := gen_random_uuid();
    INSERT INTO public.tracks (id, team_id, offer_id, title_en, title_es, description_en, description_es, cover_url, cover_style, sort_order, is_start_here, is_published)
    VALUES (new_track, t.team_id, new_id, t.title_en, t.title_es, t.description_en, t.description_es, t.cover_url, t.cover_style, t.sort_order, t.is_start_here, t.is_published);
    INSERT INTO public.lessons (id, track_id, title_en, title_es, type, url, storage_path, duration_minutes, live_starts_at, replay_url, notes_en, notes_es, sort_order,
      description_en, description_es, is_preview, is_published, attachments, event_id)
    SELECT gen_random_uuid(), new_track, l.title_en, l.title_es, l.type, l.url, l.storage_path, l.duration_minutes, l.live_starts_at, l.replay_url, l.notes_en, l.notes_es, l.sort_order,
      l.description_en, l.description_es, l.is_preview, l.is_published, l.attachments, l.event_id
    FROM public.lessons l WHERE l.track_id = t.id ORDER BY l.sort_order, l.created_at;
  END LOOP;
  RETURN new_id;
END; $$;

-- Audited manual grant by the host; recipient must hold a confirmed account
CREATE OR REPLACE FUNCTION public.grant_offer_access(_offer uuid, _email text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE o public.offers; uid uuid;
BEGIN
  SELECT * INTO o FROM public.offers WHERE id = _offer AND host_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  SELECT u.id INTO uid FROM auth.users u WHERE lower(u.email) = lower(btrim(_email)) AND u.email_confirmed_at IS NOT NULL;
  IF uid IS NULL THEN RETURN 'no_account'; END IF;
  IF EXISTS (SELECT 1 FROM public.entitlements e WHERE e.offer_id = o.id AND e.user_id = uid AND e.revoked_at IS NULL)
     OR EXISTS (SELECT 1 FROM public.offer_purchases p WHERE p.offer_id = o.id AND p.user_id = uid AND p.status IN ('active','past_due','paid')) THEN
    RETURN 'already';
  END IF;
  INSERT INTO public.entitlements (user_id, kind, offer_id, source) VALUES (uid, 'offer', o.id, 'manual_grant');
  INSERT INTO public.offer_grants (offer_id, granted_by, granted_to) VALUES (o.id, auth.uid(), uid);
  RETURN 'granted';
END; $$;

-- Learner library: caller's enrolled/granted offers with real progress counts
CREATE OR REPLACE FUNCTION public.my_learning()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'id', o.id, 'kind', o.kind, 'title_en', o.title_en, 'title_es', o.title_es,
      'summary_en', o.summary_en, 'summary_es', o.summary_es,
      'cover_style', o.cover_style, 'cover_url', o.cover_url, 'status', o.status,
      'host_name', (SELECT p.full_name FROM public.profiles p WHERE p.id = o.host_id),
      'source', src.source, 'enrolled_at', src.at,
      'lessons', (SELECT count(*) FROM public.lessons l JOIN public.tracks t ON t.id = l.track_id WHERE t.offer_id = o.id AND t.is_published AND l.is_published),
      'done', (SELECT count(*) FROM public.lesson_progress lp WHERE lp.user_id = auth.uid() AND lp.lesson_id IN (SELECT l.id FROM public.lessons l JOIN public.tracks t ON t.id = l.track_id WHERE t.offer_id = o.id))
    ) ORDER BY src.at DESC)
    FROM (
      SELECT p.offer_id, 'purchase'::text AS source, p.created_at AS at FROM public.offer_purchases p WHERE p.user_id = auth.uid() AND p.status IN ('active','past_due','paid')
      UNION ALL
      SELECT e.offer_id, e.source, e.created_at FROM public.entitlements e WHERE e.user_id = auth.uid() AND e.offer_id IS NOT NULL AND e.revoked_at IS NULL AND (e.ends_at IS NULL OR e.ends_at > now())
    ) src
    JOIN public.offers o ON o.id = src.offer_id
    WHERE o.status <> 'archived' OR src.source IS NOT NULL
  ), '[]'::jsonb);
END; $$;
