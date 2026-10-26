-- Course lesson release schedule (offers.drip_days; 0 = everything opens at once).
-- Access start = earliest live entitlement/purchase, else free-team membership join, never before activation.
CREATE OR REPLACE FUNCTION public.course_access_start(_offer uuid, _user uuid)
RETURNS timestamptz LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT greatest(coalesce(
    least(
      (SELECT min(coalesce(e.starts_at, e.created_at)) FROM public.entitlements e
        WHERE e.offer_id = o.id AND e.user_id = _user AND e.revoked_at IS NULL AND (e.ends_at IS NULL OR e.ends_at > now())),
      (SELECT min(p.created_at) FROM public.offer_purchases p
        WHERE p.offer_id = o.id AND p.user_id = _user AND p.status IN ('active','past_due','paid'))),
    CASE WHEN coalesce(o.price_cents, 0) = 0 THEN
      (SELECT min(tm.joined_at) FROM public.team_members tm WHERE tm.team_id = o.team_id AND tm.user_id = _user) END,
    o.created_at), o.available_from)
  FROM public.offers o WHERE o.id = _offer;
$$;

-- NULL = open now for the caller (non-course, no schedule, preview, manager); otherwise the release time.
CREATE OR REPLACE FUNCTION public.lesson_unlock_at(_lesson uuid)
RETURNS timestamptz LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE l public.lessons; o public.offers; idx int;
BEGIN
  SELECT * INTO l FROM public.lessons WHERE id = _lesson;
  IF NOT FOUND OR l.is_preview THEN RETURN NULL; END IF;
  SELECT o2.* INTO o FROM public.tracks t JOIN public.offers o2 ON o2.id = t.offer_id WHERE t.id = l.track_id;
  IF NOT FOUND OR o.kind <> 'course' OR coalesce(o.drip_days, 0) = 0 THEN RETURN NULL; END IF;
  IF auth.uid() IS NOT NULL AND (o.host_id = auth.uid() OR public.is_team_member(o.team_id, ARRAY['leader']) OR public.can_edit_track(l.track_id)) THEN RETURN NULL; END IF;
  SELECT r.n INTO idx FROM (
    SELECT l2.id, row_number() OVER (ORDER BY t.sort_order, t.created_at, l2.sort_order, l2.created_at) - 1 AS n
    FROM public.lessons l2 JOIN public.tracks t ON t.id = l2.track_id
    WHERE t.offer_id = o.id AND t.is_published AND l2.is_published) r WHERE r.id = _lesson;
  IF idx IS NULL OR idx = 0 THEN RETURN NULL; END IF;
  IF auth.uid() IS NULL THEN RETURN 'infinity'::timestamptz; END IF;
  RETURN public.course_access_start(o.id, auth.uid()) + make_interval(days => idx * o.drip_days);
END $$;

CREATE OR REPLACE FUNCTION public.lesson_is_unlocked(_lesson uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT coalesce(public.lesson_unlock_at(_lesson) <= now(), true);
$$;

-- Titles + release time of the caller's still-locked lessons (no content, URLs or files).
CREATE OR REPLACE FUNCTION public.my_locked_lessons()
RETURNS TABLE(id uuid, track_id uuid, title_en text, title_es text, type text, sort_order int, duration_minutes int, unlock_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT l.id, l.track_id, l.title_en, l.title_es, l.type, l.sort_order, l.duration_minutes, public.lesson_unlock_at(l.id)
  FROM public.lessons l JOIN public.tracks t ON t.id = l.track_id JOIN public.offers o ON o.id = t.offer_id
  WHERE auth.uid() IS NOT NULL AND o.kind = 'course' AND coalesce(o.drip_days, 0) > 0
    AND t.is_published AND l.is_published AND public.can_access_offer(o.id)
    AND NOT public.lesson_is_unlocked(l.id);
$$;
REVOKE ALL ON FUNCTION public.my_locked_lessons() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.my_locked_lessons() TO authenticated;
GRANT EXECUTE ON FUNCTION public.lesson_is_unlocked(uuid), public.lesson_unlock_at(uuid) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.learn_object_unlocked(_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.lessons l
    WHERE (l.storage_path = _name OR coalesce(l.attachments, '[]'::jsonb) @> jsonb_build_array(jsonb_build_object('path', _name)))
      AND NOT public.lesson_is_unlocked(l.id));
$$;
GRANT EXECUTE ON FUNCTION public.learn_object_unlocked(text) TO authenticated, anon;

CREATE POLICY "Locked course lessons stay hidden" ON public.lessons AS RESTRICTIVE FOR SELECT USING (public.lesson_is_unlocked(id));
CREATE POLICY "Locked course lesson summaries stay hidden" ON public.lesson_summaries AS RESTRICTIVE FOR SELECT USING (public.lesson_is_unlocked(lesson_id));
CREATE POLICY "Locked course lesson files stay private" ON storage.objects AS RESTRICTIVE FOR SELECT USING (bucket_id <> 'learn-media' OR public.learn_object_unlocked(name));

CREATE OR REPLACE FUNCTION public.set_lesson_progress(_lesson uuid, _completed boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _track uuid; _pub boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT l.track_id, l.is_published INTO _track, _pub FROM public.lessons l WHERE l.id = _lesson;
  IF _track IS NULL OR NOT _pub THEN RAISE EXCEPTION 'not_found'; END IF;
  IF NOT public.can_read_track(_track) THEN RAISE EXCEPTION 'no_access'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.tracks t WHERE t.id = _track AND t.is_published AND public.resource_is_live(t.available_from)) THEN RAISE EXCEPTION 'not_available'; END IF;
  IF NOT public.lesson_is_unlocked(_lesson) THEN RAISE EXCEPTION 'locked'; END IF;
  IF _completed THEN
    INSERT INTO public.lesson_progress (user_id, lesson_id, started_at, completed_at)
    VALUES (auth.uid(), _lesson, now(), now())
    ON CONFLICT (user_id, lesson_id) DO UPDATE SET completed_at = coalesce(lesson_progress.completed_at, now());
  ELSE
    DELETE FROM public.lesson_progress WHERE user_id = auth.uid() AND lesson_id = _lesson;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.live_lesson_link(_lesson uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _l public.lessons; _url text;
BEGIN
  SELECT * INTO _l FROM public.lessons WHERE id = _lesson;
  IF NOT FOUND OR _l.type <> 'live' OR NOT public.can_read_track(_l.track_id) OR NOT public.lesson_is_unlocked(_lesson) THEN RETURN NULL; END IF;
  IF NOT public.can_edit_track(_l.track_id) AND (_l.live_starts_at IS NULL OR now() < _l.live_starts_at - interval '10 minutes') THEN RETURN NULL; END IF;
  SELECT url INTO _url FROM public.lesson_live_links WHERE lesson_id = _lesson;
  RETURN _url;
END $function$;

CREATE OR REPLACE FUNCTION public.quiz_access_error(_quiz uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE z public.quizzes; o public.offers; l public.lessons;
BEGIN
  IF auth.uid() IS NULL THEN RETURN 'not_found'; END IF;
  SELECT * INTO z FROM public.quizzes WHERE id = _quiz AND is_published;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF z.offer_id IS NULL THEN
    IF z.host_id = auth.uid() THEN RETURN NULL; END IF;
    IF NOT public.is_team_member(z.team_id, ARRAY['leader','host','member']) THEN RETURN 'not_found'; END IF;
    RETURN NULL;
  END IF;
  SELECT * INTO o FROM public.offers WHERE id = z.offer_id;
  IF o.status <> 'published' AND o.host_id <> auth.uid() THEN RETURN 'not_found'; END IF;
  IF o.host_id <> auth.uid() AND NOT public.can_access_offer(o.id) THEN RETURN 'no_access'; END IF;
  IF z.lesson_id IS NOT NULL THEN
    SELECT * INTO l FROM public.lessons WHERE id = z.lesson_id;
    IF l IS NULL OR NOT l.is_published THEN RETURN 'not_found'; END IF;
    IF NOT public.lesson_is_unlocked(l.id) THEN RETURN 'locked'; END IF;
    IF l.prerequisite_lesson_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.lesson_progress lp WHERE lp.lesson_id = l.prerequisite_lesson_id AND lp.user_id = auth.uid() AND lp.completed_at IS NOT NULL
    ) THEN RETURN 'prerequisite'; END IF;
  ELSIF o.host_id <> auth.uid() AND EXISTS (
      SELECT 1 FROM public.lessons l2 JOIN public.tracks t ON t.id = l2.track_id
      WHERE t.offer_id = z.offer_id AND t.is_published AND l2.is_published
        AND NOT EXISTS (SELECT 1 FROM public.lesson_progress lp WHERE lp.lesson_id = l2.id AND lp.user_id = auth.uid() AND lp.completed_at IS NOT NULL)
    ) THEN RETURN 'prerequisite';
  END IF;
  RETURN NULL;
END $function$;