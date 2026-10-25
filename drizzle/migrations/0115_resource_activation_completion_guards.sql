ALTER TABLE public.tracks ADD COLUMN IF NOT EXISTS available_from timestamptz, ADD COLUMN IF NOT EXISTS available_tz text;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS available_from timestamptz, ADD COLUMN IF NOT EXISTS available_tz text;
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS available_from timestamptz, ADD COLUMN IF NOT EXISTS available_tz text;
COMMENT ON COLUMN public.tracks.available_from IS 'Optional activation instant; NULL = available on publish. Non-managers cannot open content before it.';

CREATE OR REPLACE FUNCTION public.resource_is_live(_from timestamptz)
RETURNS boolean LANGUAGE sql STABLE SET search_path TO 'public' AS $$ SELECT _from IS NULL OR _from <= now() $$;

CREATE OR REPLACE FUNCTION public.has_offer_access(_offer uuid, _uid uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT _uid IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.offers o WHERE o.id = _offer AND o.host_id = _uid)
    OR (EXISTS (SELECT 1 FROM public.offers o WHERE o.id = _offer AND public.resource_is_live(o.available_from))
      AND EXISTS (SELECT 1 FROM public.offer_purchases p WHERE p.offer_id = _offer AND p.user_id = _uid
      AND (p.paused_until IS NULL OR p.paused_until <= now())
      AND (p.status = 'paid' OR (p.status IN ('active','past_due') AND (p.renews_at IS NULL OR p.renews_at > now() - interval '3 days'))))));
$function$;

CREATE OR REPLACE FUNCTION public.can_access_offer(_offer uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.offers o WHERE o.id = _offer AND (
      o.host_id = auth.uid()
      OR public.is_team_member(o.team_id, ARRAY['leader'])
      OR (public.resource_is_live(o.available_from) AND (
        public.can_use_team_templates(o.team_id)
        OR EXISTS (SELECT 1 FROM public.offer_purchases p WHERE p.offer_id = o.id AND p.user_id = auth.uid() AND p.status IN ('active','past_due','paid'))
        OR EXISTS (SELECT 1 FROM public.entitlements e WHERE e.offer_id = o.id AND e.user_id = auth.uid() AND e.revoked_at IS NULL AND (e.ends_at IS NULL OR e.ends_at > now()))))
    ));
$function$;

CREATE OR REPLACE FUNCTION public.can_read_track(_track uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.tracks t WHERE t.id = _track AND (
    public.is_team_member(t.team_id, ARRAY['leader'])
    OR (t.is_published AND public.resource_is_live(t.available_from) AND (
      (public.can_use_team_templates(t.team_id) AND (t.offer_id IS NULL OR public.has_offer_access(t.offer_id, auth.uid())))
      OR (t.offer_id IS NOT NULL AND public.can_access_offer(t.offer_id))
      OR (t.offer_id IS NULL AND t.visibility IN ('public','unlisted'))))));
$function$;

DROP POLICY IF EXISTS "Public read lessons of public tracks" ON public.lessons;
CREATE POLICY "Public read lessons of public tracks" ON public.lessons FOR SELECT
USING (is_published AND EXISTS (SELECT 1 FROM public.tracks t WHERE t.id = lessons.track_id
  AND t.visibility IN ('public','unlisted') AND t.is_published AND public.resource_is_live(t.available_from)));

-- Completion: published, accessible, live lessons only; idempotent; returns progress.
CREATE OR REPLACE FUNCTION public.set_lesson_progress(_lesson uuid, _completed boolean)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _track uuid; _pub boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT l.track_id, l.is_published INTO _track, _pub FROM public.lessons l WHERE l.id = _lesson;
  IF _track IS NULL OR NOT _pub THEN RAISE EXCEPTION 'not_found'; END IF;
  IF NOT public.can_read_track(_track) THEN RAISE EXCEPTION 'no_access'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.tracks t WHERE t.id = _track AND t.is_published AND public.resource_is_live(t.available_from)) THEN RAISE EXCEPTION 'not_available'; END IF;
  IF _completed THEN
    INSERT INTO public.lesson_progress (user_id, lesson_id, started_at, completed_at)
    VALUES (auth.uid(), _lesson, now(), now())
    ON CONFLICT (user_id, lesson_id) DO UPDATE SET completed_at = coalesce(lesson_progress.completed_at, now());
  ELSE
    DELETE FROM public.lesson_progress WHERE user_id = auth.uid() AND lesson_id = _lesson;
  END IF;
END;
$function$;
REVOKE ALL ON FUNCTION public.set_lesson_progress(uuid, boolean) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.set_lesson_progress(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.log_track_completed()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _track public.tracks; _total int; _done int; _team uuid;
BEGIN
  SELECT t.* INTO _track FROM public.lessons l JOIN public.tracks t ON t.id = l.track_id WHERE l.id = NEW.lesson_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  SELECT count(*) INTO _total FROM public.lessons WHERE track_id = _track.id AND is_published;
  SELECT count(*) INTO _done FROM public.lesson_progress p JOIN public.lessons l ON l.id = p.lesson_id WHERE l.track_id = _track.id AND l.is_published AND p.user_id = NEW.user_id;
  IF _total = 0 OR _done < _total THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM public.activity WHERE type = 'track_completed' AND actor_id = NEW.user_id AND payload->>'track_id' = _track.id::text) THEN RETURN NEW; END IF;
  SELECT p.active_team_id INTO _team FROM public.profiles p
    WHERE p.id = NEW.user_id AND EXISTS (SELECT 1 FROM public.team_members m WHERE m.team_id = p.active_team_id AND m.user_id = NEW.user_id);
  INSERT INTO public.activity (team_id, actor_id, type, payload)
  VALUES (coalesce(_team, _track.team_id), NEW.user_id, 'track_completed',
    jsonb_build_object('track_id', _track.id, 'title', _track.title_en, 'title_es', _track.title_es));
  RETURN NEW;
END $function$;

-- Public, minimal availability lookup for published shareable items (no content).
CREATE OR REPLACE FUNCTION public.resource_availability(_id uuid)
 RETURNS timestamptz LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT coalesce(
    (SELECT available_from FROM public.offers WHERE id = _id AND status = 'published' AND visibility IN ('public','unlisted')),
    (SELECT available_from FROM public.tracks WHERE id = _id AND is_published AND visibility IN ('public','unlisted')));
$$;
GRANT EXECUTE ON FUNCTION public.resource_availability(uuid) TO anon, authenticated;

-- Blueprint placeholders ("[Your lesson title]") may never be published.
CREATE OR REPLACE FUNCTION public.has_blueprint_placeholder(VARIADIC _t text[])
 RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $$ SELECT EXISTS (SELECT 1 FROM unnest(_t) x WHERE x ~ '\[[^]]{3,}\]') $$;

CREATE OR REPLACE FUNCTION public.guard_blueprint_placeholders()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE _live boolean; _was boolean := false; _bad boolean;
BEGIN
  IF TG_TABLE_NAME = 'offers' THEN
    _live := NEW.status = 'published'; IF TG_OP = 'UPDATE' THEN _was := OLD.status = 'published'; END IF;
    IF NOT _live THEN RETURN NEW; END IF;
    IF _was AND NEW.title_en IS NOT DISTINCT FROM OLD.title_en AND NEW.title_es IS NOT DISTINCT FROM OLD.title_es
      AND NEW.description_en IS NOT DISTINCT FROM OLD.description_en AND NEW.description_es IS NOT DISTINCT FROM OLD.description_es THEN RETURN NEW; END IF;
    _bad := public.has_blueprint_placeholder(NEW.title_en, NEW.title_es, NEW.description_en, NEW.description_es);
  ELSIF TG_TABLE_NAME = 'tracks' THEN
    _live := NEW.is_published; IF TG_OP = 'UPDATE' THEN _was := OLD.is_published; END IF;
    IF NOT _live THEN RETURN NEW; END IF;
    IF _was AND NEW.title_en IS NOT DISTINCT FROM OLD.title_en AND NEW.title_es IS NOT DISTINCT FROM OLD.title_es
      AND NEW.description_en IS NOT DISTINCT FROM OLD.description_en AND NEW.description_es IS NOT DISTINCT FROM OLD.description_es THEN RETURN NEW; END IF;
    _bad := public.has_blueprint_placeholder(NEW.title_en, NEW.title_es, NEW.description_en, NEW.description_es);
  ELSIF TG_TABLE_NAME = 'lessons' THEN
    _live := NEW.is_published; IF TG_OP = 'UPDATE' THEN _was := OLD.is_published; END IF;
    IF NOT _live THEN RETURN NEW; END IF;
    IF _was AND NEW.title_en IS NOT DISTINCT FROM OLD.title_en AND NEW.title_es IS NOT DISTINCT FROM OLD.title_es
      AND NEW.notes_en IS NOT DISTINCT FROM OLD.notes_en AND NEW.notes_es IS NOT DISTINCT FROM OLD.notes_es THEN RETURN NEW; END IF;
    _bad := public.has_blueprint_placeholder(NEW.title_en, NEW.title_es, NEW.notes_en, NEW.notes_es, NEW.description_en, NEW.description_es);
  ELSE
    _live := NEW.is_published; IF TG_OP = 'UPDATE' THEN _was := OLD.is_published; END IF;
    IF NOT _live THEN RETURN NEW; END IF;
    IF _was AND NEW.title_en IS NOT DISTINCT FROM OLD.title_en AND NEW.title_es IS NOT DISTINCT FROM OLD.title_es THEN RETURN NEW; END IF;
    _bad := public.has_blueprint_placeholder(NEW.title_en, NEW.title_es);
  END IF;
  IF _bad THEN RAISE EXCEPTION 'blueprint_placeholder' USING ERRCODE = 'check_violation'; END IF;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS guard_blueprint_placeholders ON public.offers;
CREATE TRIGGER guard_blueprint_placeholders BEFORE INSERT OR UPDATE ON public.offers FOR EACH ROW EXECUTE FUNCTION public.guard_blueprint_placeholders();
DROP TRIGGER IF EXISTS guard_blueprint_placeholders ON public.tracks;
CREATE TRIGGER guard_blueprint_placeholders BEFORE INSERT OR UPDATE ON public.tracks FOR EACH ROW EXECUTE FUNCTION public.guard_blueprint_placeholders();
DROP TRIGGER IF EXISTS guard_blueprint_placeholders ON public.lessons;
CREATE TRIGGER guard_blueprint_placeholders BEFORE INSERT OR UPDATE ON public.lessons FOR EACH ROW EXECUTE FUNCTION public.guard_blueprint_placeholders();
DROP TRIGGER IF EXISTS guard_blueprint_placeholders ON public.recipes;
CREATE TRIGGER guard_blueprint_placeholders BEFORE INSERT OR UPDATE ON public.recipes FOR EACH ROW EXECUTE FUNCTION public.guard_blueprint_placeholders();