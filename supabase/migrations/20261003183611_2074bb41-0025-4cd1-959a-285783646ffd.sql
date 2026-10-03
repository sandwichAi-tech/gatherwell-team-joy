-- Can the caller use templates owned by _team? True when _team is their team or an ancestor of one of their teams.
CREATE OR REPLACE FUNCTION public.can_use_team_templates(_team uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH RECURSIVE up AS (
    SELECT m.team_id AS id, 0 AS depth FROM public.team_members m WHERE m.user_id = auth.uid()
    UNION ALL
    SELECT t.parent_team_id, up.depth + 1 FROM public.teams t JOIN up ON t.id = up.id WHERE t.parent_team_id IS NOT NULL AND up.depth < 20
  )
  SELECT auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM up WHERE up.id = _team);
$$;

CREATE TABLE public.templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  created_by uuid DEFAULT auth.uid(),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  description_en text, description_es text, cover_url text, theme text,
  default_duration_minutes integer NOT NULL DEFAULT 60 CHECK (default_duration_minutes BETWEEN 5 AND 1440),
  default_capacity integer CHECK (default_capacity IS NULL OR default_capacity BETWEEN 1 AND 10000),
  visibility_default text NOT NULL DEFAULT 'team' CHECK (visibility_default IN ('public','team')),
  checklist jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(checklist) = 'array'),
  invite_script_en text, invite_script_es text, followup_script_en text, followup_script_es text,
  is_published boolean NOT NULL DEFAULT false,
  launches_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.templates TO authenticated;
GRANT ALL ON public.templates TO service_role;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read starters, published team templates, and leader drafts" ON public.templates FOR SELECT TO authenticated
  USING ((team_id IS NULL AND is_published) OR (is_published AND public.can_use_team_templates(team_id)) OR (team_id IS NOT NULL AND public.is_team_member(team_id, ARRAY['leader'])));
CREATE POLICY "Leaders create templates" ON public.templates FOR INSERT TO authenticated
  WITH CHECK (team_id IS NOT NULL AND created_by = auth.uid() AND public.is_team_member(team_id, ARRAY['leader']));
CREATE POLICY "Leaders edit templates" ON public.templates FOR UPDATE TO authenticated
  USING (team_id IS NOT NULL AND public.is_team_member(team_id, ARRAY['leader'])) WITH CHECK (team_id IS NOT NULL AND public.is_team_member(team_id, ARRAY['leader']));
CREATE POLICY "Leaders delete templates" ON public.templates FOR DELETE TO authenticated
  USING (team_id IS NOT NULL AND public.is_team_member(team_id, ARRAY['leader']));
CREATE INDEX templates_team_idx ON public.templates(team_id);

CREATE OR REPLACE FUNCTION public.guard_template()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_setting('gatherwell.launch', true) = 'on' OR coalesce(auth.jwt()->>'role','') = 'service_role' OR auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN NEW.launches_count := 0;
  ELSIF NEW.launches_count IS DISTINCT FROM OLD.launches_count OR NEW.team_id IS DISTINCT FROM OLD.team_id THEN RAISE EXCEPTION 'locked'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER guard_template BEFORE INSERT OR UPDATE ON public.templates FOR EACH ROW EXECUTE FUNCTION public.guard_template();

CREATE OR REPLACE FUNCTION public.log_template_published()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.team_id IS NOT NULL AND NEW.is_published AND (TG_OP = 'INSERT' OR NOT OLD.is_published) THEN
    INSERT INTO public.activity (team_id, actor_id, type, payload)
    VALUES (NEW.team_id, auth.uid(), 'template_published', jsonb_build_object('template_id', NEW.id, 'title', NEW.title));
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_template_published AFTER INSERT OR UPDATE OF is_published ON public.templates FOR EACH ROW EXECUTE FUNCTION public.log_template_published();

-- Host-only event checklist
CREATE TABLE public.event_checklists (
  event_id uuid PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
  items jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(items) = 'array'),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_checklists TO authenticated;
GRANT ALL ON public.event_checklists TO service_role;
ALTER TABLE public.event_checklists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Hosts and leaders manage checklists" ON public.event_checklists FOR ALL TO authenticated
  USING (public.can_manage_event(event_id)) WITH CHECK (public.can_manage_event(event_id));

ALTER TABLE public.events ADD CONSTRAINT events_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.templates(id) ON DELETE SET NULL;

-- Event published log skips launches (the launch writes its own win)
CREATE OR REPLACE FUNCTION public.log_event_published()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF current_setting('gatherwell.launch', true) = 'on' THEN RETURN NEW; END IF;
  IF NEW.status = 'published' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'published') THEN
    INSERT INTO public.activity (team_id, actor_id, type, payload)
    VALUES (NEW.team_id, auth.uid(), 'event_published', jsonb_build_object('event_id', NEW.id, 'title', NEW.title));
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.launch_template(_template uuid, _team uuid, _starts_at timestamptz, _timezone text, _location_name text, _online_url text, _publish boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _t public.templates; _id uuid;
BEGIN
  IF NOT public.is_team_member(_team, ARRAY['leader','host']) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  SELECT * INTO _t FROM public.templates WHERE id = _template AND is_published
    AND (team_id IS NULL OR public.can_use_team_templates(team_id) OR public.is_team_member(team_id, ARRAY['leader']));
  IF _t.id IS NULL THEN RAISE EXCEPTION 'template_not_found'; END IF;
  IF _starts_at IS NULL THEN RAISE EXCEPTION 'date_required'; END IF;
  IF _online_url IS NOT NULL AND _online_url <> '' AND _online_url !~* '^https://' THEN RAISE EXCEPTION 'invalid_url'; END IF;
  PERFORM set_config('gatherwell.launch', 'on', true);
  INSERT INTO public.events (team_id, host_id, title, description_en, description_es, cover_url, theme, starts_at, ends_at, timezone,
    location_name, online_url, capacity, visibility, template_id, status)
  VALUES (_team, auth.uid(), _t.title, _t.description_en, _t.description_es, _t.cover_url, _t.theme, _starts_at,
    _starts_at + make_interval(mins => _t.default_duration_minutes), coalesce(nullif(_timezone,''), 'UTC'),
    nullif(trim(coalesce(_location_name,'')), ''), nullif(trim(coalesce(_online_url,'')), ''), _t.default_capacity, _t.visibility_default, _t.id,
    CASE WHEN _publish THEN 'published' ELSE 'draft' END)
  RETURNING id INTO _id;
  INSERT INTO public.event_checklists (event_id, items)
  SELECT _id, coalesce(jsonb_agg(jsonb_build_object('label', item, 'done', false)), '[]'::jsonb) FROM jsonb_array_elements_text(_t.checklist) item;
  UPDATE public.templates SET launches_count = launches_count + 1 WHERE id = _t.id;
  INSERT INTO public.activity (team_id, actor_id, type, payload)
  VALUES (_team, auth.uid(), 'template_launched', jsonb_build_object('template_id', _t.id, 'event_id', _id, 'title', _t.title));
  PERFORM set_config('gatherwell.launch', 'off', true);
  RETURN _id;
END; $$;

CREATE OR REPLACE FUNCTION public.copy_starter_template(_template uuid, _team uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid;
BEGIN
  IF NOT public.is_team_member(_team, ARRAY['leader']) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  INSERT INTO public.templates (team_id, created_by, title, description_en, description_es, cover_url, theme, default_duration_minutes, default_capacity,
    visibility_default, checklist, invite_script_en, invite_script_es, followup_script_en, followup_script_es, is_published)
  SELECT _team, auth.uid(), title, description_en, description_es, cover_url, theme, default_duration_minutes, default_capacity,
    visibility_default, checklist, invite_script_en, invite_script_es, followup_script_en, followup_script_es, false
  FROM public.templates WHERE id = _template AND team_id IS NULL
  RETURNING id INTO _id;
  IF _id IS NULL THEN RAISE EXCEPTION 'template_not_found'; END IF;
  RETURN _id;
END; $$;

REVOKE EXECUTE ON FUNCTION public.launch_template(uuid, uuid, timestamptz, text, text, text, boolean), public.copy_starter_template(uuid, uuid), public.can_use_team_templates(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.launch_template(uuid, uuid, timestamptz, text, text, text, boolean), public.copy_starter_template(uuid, uuid), public.can_use_team_templates(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_template(), public.log_template_published(), public.log_event_published() FROM PUBLIC, anon, authenticated;

-- Starter templates (global, read-only)
INSERT INTO public.templates (team_id, created_by, title, description_en, description_es, theme, default_duration_minutes, default_capacity, visibility_default, checklist,
  invite_script_en, invite_script_es, followup_script_en, followup_script_es, is_published) VALUES
(NULL, NULL, 'Saturday Fit Camp',
 'An easygoing outdoor session to start the weekend together. Move at your own pace, meet your people and stay for a short chat afterwards.',
 'Una sesión al aire libre, sin prisas, para empezar el fin de semana juntos. Muévete a tu ritmo, conoce a tu gente y quédate a conversar un rato al final.',
 'outdoor', 60, 30, 'public',
 '["Confirm the park spot","Share the meeting point with the team","Bring a speaker and water","Welcome first-timers by name","Take a group photo"]'::jsonb,
 'Hi! This Saturday we are meeting for an easygoing Fit Camp in the park. Come as you are and bring a friend. Want me to save you a spot?',
 '¡Hola! Este sábado nos reunimos para un Fit Camp tranquilo en el parque. Ven como eres y trae a alguien. ¿Te guardo un lugar?',
 'Thank you for coming on Saturday. It was great to have you there. Same time next week?',
 'Gracias por venir el sábado. Fue muy lindo tenerte ahí. ¿Nos vemos a la misma hora la próxima semana?', true),
(NULL, NULL, 'Wellness Night',
 'A calm evening to slow down, share simple routines that work for you and connect with your team over tea.',
 'Una noche tranquila para bajar el ritmo, compartir rutinas sencillas que te funcionan y conectar con tu equipo con un té.',
 'evening', 90, 20, 'team',
 '["Choose a cozy space","Prepare tea and light snacks","Plan two conversation prompts","Send a reminder the day before","Thank everyone at the end"]'::jsonb,
 'Hi! I am hosting a relaxed Wellness Night this week, just good company and good conversation. Would you like to join us?',
 '¡Hola! Esta semana organizo una Noche de Bienestar relajada, solo buena compañía y buena conversación. ¿Te gustaría acompañarnos?',
 'Thanks for joining Wellness Night. I loved hearing your ideas. I will let you know about the next one.',
 'Gracias por venir a la Noche de Bienestar. Me encantó escuchar tus ideas. Te aviso de la próxima.', true),
(NULL, NULL, 'New Member Welcome',
 'A friendly first gathering for people who just joined. Meet the team, learn how gatherings work and find your first event.',
 'Un primer encuentro amable para quienes acaban de unirse. Conoce al equipo, descubre cómo funcionan los encuentros y encuentra tu primer evento.',
 'welcome', 45, 15, 'team',
 '["Invite this month''s new members","Prepare a short team introduction","Share the upcoming calendar","Pair each newcomer with a buddy"]'::jsonb,
 'Welcome to the team! We are hosting a short welcome gathering so you can meet everyone. Can you make it?',
 '¡Bienvenida al equipo! Organizamos un encuentro corto de bienvenida para que conozcas a todos. ¿Puedes venir?',
 'So glad you came to the welcome gathering. Here is the calendar, pick one that works for you.',
 'Qué gusto que vinieras al encuentro de bienvenida. Aquí está el calendario, elige el que mejor te quede.', true);