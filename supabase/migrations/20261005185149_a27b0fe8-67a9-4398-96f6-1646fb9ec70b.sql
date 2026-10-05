-- Smart AI features: follow-up inbox, daily brief, lesson summaries, team library, new member plan
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- 1. Follow-up drafts
CREATE TABLE public.followup_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  rsvp_id uuid NOT NULL UNIQUE REFERENCES public.rsvps(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  host_id uuid NOT NULL,
  guest_name text NOT NULL DEFAULT '',
  language text NOT NULL DEFAULT 'en',
  kind text NOT NULL CHECK (kind IN ('first_time','returning','no_show')),
  message text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','sent','skipped')),
  channel text CHECK (channel IN ('email','sms','whatsapp')),
  preview boolean NOT NULL DEFAULT false,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX followup_drafts_host_idx ON public.followup_drafts (host_id, status);
CREATE INDEX followup_drafts_team_sent_idx ON public.followup_drafts (team_id, sent_at);
GRANT SELECT, UPDATE ON public.followup_drafts TO authenticated;
GRANT ALL ON public.followup_drafts TO service_role;
ALTER TABLE public.followup_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Hosts and leaders read follow-ups" ON public.followup_drafts FOR SELECT TO authenticated
  USING (host_id = auth.uid() OR public.is_team_member(team_id, ARRAY['leader']));
CREATE POLICY "Hosts edit their follow-ups" ON public.followup_drafts FOR UPDATE TO authenticated
  USING (host_id = auth.uid()) WITH CHECK (host_id = auth.uid());

CREATE OR REPLACE FUNCTION public.followup_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.event_id <> OLD.event_id OR NEW.rsvp_id <> OLD.rsvp_id OR NEW.host_id <> OLD.host_id OR NEW.team_id <> OLD.team_id OR NEW.kind <> OLD.kind THEN RAISE EXCEPTION 'not_allowed'; END IF;
  IF NEW.message IS DISTINCT FROM OLD.message AND public.has_blocked_claim(NEW.message) THEN RAISE EXCEPTION 'claim_blocked'; END IF;
  IF length(NEW.message) > 1000 THEN RAISE EXCEPTION 'invalid_message'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER followup_guard BEFORE UPDATE ON public.followup_drafts FOR EACH ROW EXECUTE FUNCTION public.followup_guard();

-- Gatherings whose follow-ups are due (8:00 the morning after, host time zone), backend only
CREATE OR REPLACE FUNCTION public.due_followup_events() RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT e.id FROM public.events e
  WHERE e.status <> 'cancelled' AND e.visibility <> 'draft'
    AND coalesce(e.ends_at, e.starts_at + interval '2 hours') < now()
    AND coalesce(e.ends_at, e.starts_at) > now() - interval '4 days'
    AND (now() AT TIME ZONE coalesce(nullif(e.timezone,''), 'America/Los_Angeles')) >=
        ((coalesce(e.ends_at, e.starts_at) AT TIME ZONE coalesce(nullif(e.timezone,''), 'America/Los_Angeles'))::date + 1 + time '08:00')
    AND EXISTS (SELECT 1 FROM public.rsvps r WHERE r.event_id = e.id AND r.status IN ('going','checked_in') )
    AND NOT EXISTS (SELECT 1 FROM public.followup_drafts d WHERE d.event_id = e.id)
  LIMIT 25;
$$;
REVOKE ALL ON FUNCTION public.due_followup_events() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.due_followup_events() TO service_role;

-- Leaders: follow-ups sent in a period for a team and everything below it
CREATE OR REPLACE FUNCTION public.followups_sent(_root uuid, _scope uuid, _from timestamptz, _to timestamptz) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH RECURSIVE tree AS (SELECT id FROM public.teams WHERE id = _scope UNION ALL SELECT t.id FROM public.teams t JOIN tree ON t.parent_team_id = tree.id)
  SELECT CASE WHEN public.is_team_member(_root, ARRAY['leader']) AND public.is_team_member(_scope, ARRAY['leader'])
    THEN (SELECT count(*)::int FROM public.followup_drafts d WHERE d.status = 'sent' AND d.sent_at >= _from AND d.sent_at < _to AND d.team_id IN (SELECT id FROM tree))
    ELSE 0 END;
$$;
REVOKE ALL ON FUNCTION public.followups_sent(uuid, uuid, timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.followups_sent(uuid, uuid, timestamptz, timestamptz) TO authenticated;

-- 2. Daily brief (one per person per day; dismissible)
CREATE TABLE public.daily_briefs (
  user_id uuid NOT NULL,
  day date NOT NULL,
  language text NOT NULL DEFAULT 'en',
  lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  preview boolean NOT NULL DEFAULT true,
  dismissed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_briefs TO authenticated;
GRANT ALL ON public.daily_briefs TO service_role;
ALTER TABLE public.daily_briefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own daily brief" ON public.daily_briefs FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 3. Lesson summaries
CREATE TABLE public.lesson_summaries (
  lesson_id uuid PRIMARY KEY REFERENCES public.lessons(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  summary_en text NOT NULL DEFAULT '', summary_es text NOT NULL DEFAULT '',
  points_en jsonb NOT NULL DEFAULT '[]'::jsonb, points_es jsonb NOT NULL DEFAULT '[]'::jsonb,
  actions_en jsonb NOT NULL DEFAULT '[]'::jsonb, actions_es jsonb NOT NULL DEFAULT '[]'::jsonb,
  published boolean NOT NULL DEFAULT false,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_summaries TO authenticated;
GRANT ALL ON public.lesson_summaries TO service_role;
ALTER TABLE public.lesson_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read published summaries" ON public.lesson_summaries FOR SELECT TO authenticated
  USING ((published AND public.is_team_member(team_id, ARRAY['leader','host','member'])) OR public.is_team_member(team_id, ARRAY['leader']));
CREATE POLICY "Leaders add summaries" ON public.lesson_summaries FOR INSERT TO authenticated WITH CHECK (public.is_team_member(team_id, ARRAY['leader']));
CREATE POLICY "Leaders edit summaries" ON public.lesson_summaries FOR UPDATE TO authenticated USING (public.is_team_member(team_id, ARRAY['leader'])) WITH CHECK (public.is_team_member(team_id, ARRAY['leader']));
CREATE POLICY "Leaders remove summaries" ON public.lesson_summaries FOR DELETE TO authenticated USING (public.is_team_member(team_id, ARRAY['leader']));

CREATE OR REPLACE FUNCTION public.lesson_summary_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now(); NEW.updated_by := auth.uid();
  IF NOT EXISTS (SELECT 1 FROM public.lessons l JOIN public.tracks t ON t.id = l.track_id WHERE l.id = NEW.lesson_id AND t.team_id = NEW.team_id) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  IF public.has_blocked_claim(NEW.summary_en || ' ' || NEW.summary_es || ' ' || NEW.points_en::text || ' ' || NEW.points_es::text || ' ' || NEW.actions_en::text || ' ' || NEW.actions_es::text) THEN RAISE EXCEPTION 'claim_blocked'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER lesson_summary_guard BEFORE INSERT OR UPDATE ON public.lesson_summaries FOR EACH ROW EXECUTE FUNCTION public.lesson_summary_guard();

-- 4. Team library (text chunks; keyword search now, embedding column ready)
CREATE TABLE public.library_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  source_type text NOT NULL CHECK (source_type IN ('lesson','template','announcement','recipe')),
  source_id uuid NOT NULL,
  title text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  tsv tsvector GENERATED ALWAYS AS (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(content,''))) STORED,
  embedding extensions.vector(768),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_type, source_id)
);
CREATE INDEX library_chunks_tsv_idx ON public.library_chunks USING gin (tsv);
CREATE INDEX library_chunks_team_idx ON public.library_chunks (team_id);
GRANT ALL ON public.library_chunks TO service_role;
ALTER TABLE public.library_chunks ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.library_sync() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _team uuid; _title text; _content text; _keep boolean := true; _type text := TG_ARGV[0];
BEGIN
  IF TG_OP = 'DELETE' THEN DELETE FROM public.library_chunks WHERE source_type = _type AND source_id = OLD.id; RETURN OLD; END IF;
  IF _type = 'lesson' THEN
    SELECT t.team_id INTO _team FROM public.tracks t WHERE t.id = NEW.track_id;
    _title := concat_ws(' / ', NEW.title_en, NEW.title_es); _content := concat_ws(E'\n', NEW.notes_en, NEW.notes_es);
  ELSIF _type = 'template' THEN
    _team := NEW.team_id; _keep := NEW.is_published;
    _title := NEW.title; _content := concat_ws(E'\n', NEW.description_en, NEW.description_es, NEW.invite_script_en, NEW.invite_script_es, NEW.followup_script_en, NEW.followup_script_es, NEW.checklist::text);
  ELSIF _type = 'announcement' THEN
    _team := NEW.team_id; _title := left(NEW.body, 80); _content := NEW.body;
  ELSIF _type = 'recipe' THEN
    _team := NEW.team_id; _keep := NEW.private_owner IS NULL AND NEW.team_id IS NOT NULL;
    _title := concat_ws(' / ', NEW.title_en, NEW.title_es); _content := concat_ws(E'\n', NEW.ingredients::text, NEW.steps::text);
  END IF;
  IF _team IS NULL OR NOT _keep THEN DELETE FROM public.library_chunks WHERE source_type = _type AND source_id = NEW.id; RETURN NEW; END IF;
  INSERT INTO public.library_chunks (team_id, source_type, source_id, title, content, embedding, updated_at)
  VALUES (_team, _type, NEW.id, coalesce(_title,''), left(coalesce(_content,''), 8000), NULL, now())
  ON CONFLICT (source_type, source_id) DO UPDATE SET team_id = EXCLUDED.team_id, title = EXCLUDED.title, content = EXCLUDED.content, embedding = NULL, updated_at = now();
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.library_sync() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER library_sync_lessons AFTER INSERT OR UPDATE OR DELETE ON public.lessons FOR EACH ROW EXECUTE FUNCTION public.library_sync('lesson');
CREATE TRIGGER library_sync_templates AFTER INSERT OR UPDATE OR DELETE ON public.templates FOR EACH ROW EXECUTE FUNCTION public.library_sync('template');
CREATE TRIGGER library_sync_announcements AFTER INSERT OR UPDATE OR DELETE ON public.announcements FOR EACH ROW EXECUTE FUNCTION public.library_sync('announcement');
CREATE TRIGGER library_sync_recipes AFTER INSERT OR UPDATE OR DELETE ON public.recipes FOR EACH ROW EXECUTE FUNCTION public.library_sync('recipe');

-- Backfill existing content
UPDATE public.lessons SET title_en = title_en;
UPDATE public.templates SET title = title;
UPDATE public.announcements SET body = body;
UPDATE public.recipes SET title_en = title_en;

-- Search the caller's team plus parent teams
CREATE OR REPLACE FUNCTION public.search_team_library(_team uuid, _q text)
RETURNS TABLE (source_type text, source_id uuid, title text, excerpt text, rank real)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _query tsquery;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_team_member(_team, ARRAY['leader','host','member']) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  SELECT to_tsquery('simple', string_agg(w || ':*', ' | ')) INTO _query
  FROM (SELECT DISTINCT w FROM regexp_split_to_table(lower(regexp_replace(coalesce(_q,''), '[^[:alnum:]áéíóúñü ]', ' ', 'g')), '\s+') w
        WHERE length(w) > 3 AND w NOT IN ('what','when','where','which','with','that','this','have','does','como','cómo','para','donde','dónde','cuando','cuándo','sobre','nuestro','nuestra','nosotros','hacemos','should','would','could','there','their','about','team','equipo')) x;
  IF _query IS NULL THEN RETURN; END IF;
  RETURN QUERY
  WITH RECURSIVE up AS (SELECT id, parent_team_id FROM public.teams WHERE id = _team UNION ALL SELECT t.id, t.parent_team_id FROM public.teams t JOIN up ON t.id = up.parent_team_id)
  SELECT c.source_type, c.source_id, c.title, left(c.content, 600), ts_rank(c.tsv, _query)
  FROM public.library_chunks c WHERE c.team_id IN (SELECT id FROM up) AND c.tsv @@ _query
  ORDER BY ts_rank(c.tsv, _query) DESC LIMIT 5;
END $$;
REVOKE ALL ON FUNCTION public.search_team_library(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_team_library(uuid, text) TO authenticated;

-- 6. New member 30-day plan
CREATE TABLE public.member_plans (
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, user_id)
);
GRANT ALL ON public.member_plans TO service_role;
ALTER TABLE public.member_plans ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.build_member_plan(_team uuid, _user uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _items jsonb := '[]'::jsonb; _role text; r record;
BEGIN
  SELECT role INTO _role FROM public.team_members WHERE team_id = _team AND user_id = _user;
  FOR r IN
    WITH RECURSIVE up AS (SELECT id, parent_team_id, 0 AS depth FROM public.teams WHERE id = _team UNION ALL SELECT t.id, t.parent_team_id, up.depth + 1 FROM public.teams t JOIN up ON t.id = up.parent_team_id)
    SELECT l.id, l.title_en, l.title_es FROM public.tracks tr JOIN up ON up.id = tr.team_id JOIN public.lessons l ON l.track_id = tr.id
    WHERE tr.is_start_here AND tr.is_published ORDER BY up.depth, tr.sort_order, l.sort_order LIMIT 2
  LOOP
    _items := _items || jsonb_build_object('kind','lesson','ref',r.id,'title_en',r.title_en,'title_es',coalesce(nullif(r.title_es,''),r.title_en));
  END LOOP;
  SELECT e.id, e.title INTO r FROM public.events e WHERE e.team_id = _team AND e.status <> 'cancelled' AND e.visibility <> 'draft' AND e.starts_at > now() AND e.starts_at < now() + interval '30 days' ORDER BY e.starts_at LIMIT 1;
  IF FOUND THEN _items := _items || jsonb_build_object('kind','rsvp','ref',r.id,'title_en',r.title,'title_es',r.title); END IF;
  IF _role IN ('host','leader') THEN
    SELECT tp.id, tp.title INTO r FROM public.templates tp WHERE tp.team_id = _team AND tp.is_published ORDER BY tp.launches_count DESC, tp.created_at LIMIT 1;
    IF FOUND THEN _items := _items || jsonb_build_object('kind','template','ref',r.id,'title_en',r.title,'title_es',r.title); END IF;
  END IF;
  _items := _items || jsonb_build_object('kind','introduce');
  INSERT INTO public.member_plans (team_id, user_id, items) VALUES (_team, _user, _items) ON CONFLICT DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.build_member_plan(uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.member_plan_on_join() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.role IN ('member','host') THEN PERFORM public.build_member_plan(NEW.team_id, NEW.user_id); END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.member_plan_on_join() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER member_plan_on_join AFTER INSERT ON public.team_members FOR EACH ROW EXECUTE FUNCTION public.member_plan_on_join();

-- Caller's own plan with automatic progress (null once 30 days have passed)
CREATE OR REPLACE FUNCTION public.get_member_plan(_team uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _plan public.member_plans; _out jsonb := '[]'::jsonb; i jsonb; _done boolean;
BEGIN
  IF _uid IS NULL OR NOT EXISTS (SELECT 1 FROM public.team_members WHERE team_id = _team AND user_id = _uid) THEN RETURN NULL; END IF;
  SELECT * INTO _plan FROM public.member_plans WHERE team_id = _team AND user_id = _uid;
  IF NOT FOUND OR _plan.created_at < now() - interval '30 days' THEN RETURN NULL; END IF;
  FOR i IN SELECT * FROM jsonb_array_elements(_plan.items) LOOP
    _done := CASE i->>'kind'
      WHEN 'lesson' THEN EXISTS (SELECT 1 FROM public.lesson_progress WHERE user_id = _uid AND lesson_id = (i->>'ref')::uuid)
      WHEN 'rsvp' THEN EXISTS (SELECT 1 FROM public.rsvps WHERE user_id = _uid AND event_id = (i->>'ref')::uuid AND status IN ('going','checked_in','waitlist'))
      WHEN 'template' THEN EXISTS (SELECT 1 FROM public.events WHERE host_id = _uid AND template_id = (i->>'ref')::uuid)
      WHEN 'introduce' THEN EXISTS (SELECT 1 FROM public.shoutouts WHERE team_id = _team AND from_user = _uid) OR EXISTS (SELECT 1 FROM public.announcements WHERE team_id = _team AND author_id = _uid)
      ELSE false END;
    _out := _out || (i || jsonb_build_object('done', _done));
  END LOOP;
  RETURN jsonb_build_object('created_at', _plan.created_at, 'items', _out);
END $$;
REVOKE ALL ON FUNCTION public.get_member_plan(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_member_plan(uuid) TO authenticated;

-- Follow-up email/text template is passed through the existing outbox
SELECT cron.schedule('gatherwell-followups', '0 * * * *', $cron$
  SELECT net.http_post(url := u, headers := jsonb_build_object('Content-Type','application/json','x-cron-token',(SELECT value FROM public.app_config WHERE key = 'cron_token')), body := '{}'::jsonb)
  FROM unnest(ARRAY['https://project--d56c15d9-a849-4fc3-a192-501da269084f.lovable.app/api/public/ai/followups',
                    'https://project--d56c15d9-a849-4fc3-a192-501da269084f-dev.lovable.app/api/public/ai/followups']) AS u;
$cron$);