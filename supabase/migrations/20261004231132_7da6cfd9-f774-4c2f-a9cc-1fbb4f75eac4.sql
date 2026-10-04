
CREATE TABLE public.tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  title_en text NOT NULL DEFAULT '', title_es text NOT NULL DEFAULT '',
  description_en text, description_es text, cover_url text,
  cover_style smallint NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  is_start_here boolean NOT NULL DEFAULT false,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id uuid NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  title_en text NOT NULL DEFAULT '', title_es text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'video' CHECK (type IN ('video','pdf','link','live')),
  url text, storage_path text, duration_minutes integer,
  live_starts_at timestamptz, replay_url text,
  notes_en text, notes_es text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.lessons(track_id, sort_order);
CREATE TABLE public.lesson_live_links (
  lesson_id uuid PRIMARY KEY REFERENCES public.lessons(id) ON DELETE CASCADE,
  url text NOT NULL
);
CREATE TABLE public.lesson_progress (
  user_id uuid NOT NULL DEFAULT auth.uid(),
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  completed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, lesson_id)
);
CREATE TABLE public.lesson_reminders (
  user_id uuid NOT NULL DEFAULT auth.uid(),
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, lesson_id)
);
CREATE TABLE public.recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  title_en text NOT NULL DEFAULT '', title_es text NOT NULL DEFAULT '',
  cover_url text, cover_style smallint NOT NULL DEFAULT 0,
  prep_minutes integer,
  tags text[] NOT NULL DEFAULT '{}',
  ingredients jsonb NOT NULL DEFAULT '{"en":[],"es":[]}'::jsonb,
  steps jsonb NOT NULL DEFAULT '{"en":[],"es":[]}'::jsonb,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.saved_recipes (
  user_id uuid NOT NULL DEFAULT auth.uid(),
  recipe_id uuid NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, recipe_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tracks, public.lessons, public.lesson_live_links, public.recipes TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.lesson_progress, public.lesson_reminders, public.saved_recipes TO authenticated;
GRANT ALL ON public.tracks, public.lessons, public.lesson_live_links, public.lesson_progress, public.lesson_reminders, public.recipes, public.saved_recipes TO service_role;

ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_live_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_recipes ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_read_track(_track uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.tracks t WHERE t.id = _track AND (
    (t.is_published AND public.can_use_team_templates(t.team_id)) OR public.is_team_member(t.team_id, ARRAY['leader'])));
$$;
CREATE OR REPLACE FUNCTION public.can_edit_track(_track uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.tracks t WHERE t.id = _track AND public.is_team_member(t.team_id, ARRAY['leader']));
$$;
REVOKE EXECUTE ON FUNCTION public.can_read_track(uuid), public.can_edit_track(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_track(uuid), public.can_edit_track(uuid) TO authenticated;

CREATE POLICY "Members read published tracks, leaders all" ON public.tracks FOR SELECT TO authenticated
  USING ((is_published AND can_use_team_templates(team_id)) OR is_team_member(team_id, ARRAY['leader']));
CREATE POLICY "Leaders create tracks" ON public.tracks FOR INSERT TO authenticated WITH CHECK (is_team_member(team_id, ARRAY['leader']));
CREATE POLICY "Leaders edit tracks" ON public.tracks FOR UPDATE TO authenticated USING (is_team_member(team_id, ARRAY['leader'])) WITH CHECK (is_team_member(team_id, ARRAY['leader']));
CREATE POLICY "Leaders delete tracks" ON public.tracks FOR DELETE TO authenticated USING (is_team_member(team_id, ARRAY['leader']));

CREATE POLICY "Read lessons of readable tracks" ON public.lessons FOR SELECT TO authenticated USING (can_read_track(track_id));
CREATE POLICY "Leaders create lessons" ON public.lessons FOR INSERT TO authenticated WITH CHECK (can_edit_track(track_id));
CREATE POLICY "Leaders edit lessons" ON public.lessons FOR UPDATE TO authenticated USING (can_edit_track(track_id)) WITH CHECK (can_edit_track(track_id));
CREATE POLICY "Leaders delete lessons" ON public.lessons FOR DELETE TO authenticated USING (can_edit_track(track_id));

CREATE POLICY "Leaders manage live links" ON public.lesson_live_links FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.lessons l WHERE l.id = lesson_id AND can_edit_track(l.track_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.lessons l WHERE l.id = lesson_id AND can_edit_track(l.track_id)));

CREATE POLICY "Own progress read" ON public.lesson_progress FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Own progress add" ON public.lesson_progress FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.lessons l WHERE l.id = lesson_id AND can_read_track(l.track_id)));
CREATE POLICY "Own progress remove" ON public.lesson_progress FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Own reminders read" ON public.lesson_reminders FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Own reminders add" ON public.lesson_reminders FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.lessons l WHERE l.id = lesson_id AND l.type = 'live' AND can_read_track(l.track_id)));
CREATE POLICY "Own reminders remove" ON public.lesson_reminders FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Read shared and team recipes" ON public.recipes FOR SELECT TO authenticated USING (team_id IS NULL OR can_use_team_templates(team_id) OR is_team_member(team_id, ARRAY['leader']));
CREATE POLICY "Leaders add recipes" ON public.recipes FOR INSERT TO authenticated WITH CHECK (team_id IS NOT NULL AND created_by = auth.uid() AND is_team_member(team_id, ARRAY['leader']));
CREATE POLICY "Leaders edit recipes" ON public.recipes FOR UPDATE TO authenticated USING (team_id IS NOT NULL AND is_team_member(team_id, ARRAY['leader'])) WITH CHECK (team_id IS NOT NULL AND is_team_member(team_id, ARRAY['leader']));
CREATE POLICY "Leaders delete recipes" ON public.recipes FOR DELETE TO authenticated USING (team_id IS NOT NULL AND is_team_member(team_id, ARRAY['leader']));

CREATE POLICY "Own saved read" ON public.saved_recipes FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Own saved add" ON public.saved_recipes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Own saved remove" ON public.saved_recipes FOR DELETE TO authenticated USING (user_id = auth.uid());

-- One "Start here" per team
CREATE OR REPLACE FUNCTION public.single_start_here() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.is_start_here THEN
    UPDATE public.tracks SET is_start_here = false WHERE team_id = NEW.team_id AND id <> NEW.id AND is_start_here;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tracks_single_start_here AFTER INSERT OR UPDATE OF is_start_here ON public.tracks FOR EACH ROW EXECUTE FUNCTION public.single_start_here();

-- Track completion win (once per person per track)
CREATE OR REPLACE FUNCTION public.log_track_completed() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _track public.tracks; _total int; _done int; _team uuid;
BEGIN
  SELECT t.* INTO _track FROM public.lessons l JOIN public.tracks t ON t.id = l.track_id WHERE l.id = NEW.lesson_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  SELECT count(*) INTO _total FROM public.lessons WHERE track_id = _track.id;
  SELECT count(*) INTO _done FROM public.lesson_progress p JOIN public.lessons l ON l.id = p.lesson_id WHERE l.track_id = _track.id AND p.user_id = NEW.user_id;
  IF _total = 0 OR _done < _total THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM public.activity WHERE type = 'track_completed' AND actor_id = NEW.user_id AND payload->>'track_id' = _track.id::text) THEN RETURN NEW; END IF;
  SELECT p.active_team_id INTO _team FROM public.profiles p
    WHERE p.id = NEW.user_id AND EXISTS (SELECT 1 FROM public.team_members m WHERE m.team_id = p.active_team_id AND m.user_id = NEW.user_id);
  INSERT INTO public.activity (team_id, actor_id, type, payload)
  VALUES (coalesce(_team, _track.team_id), NEW.user_id, 'track_completed',
    jsonb_build_object('track_id', _track.id, 'title', _track.title_en, 'title_es', _track.title_es));
  RETURN NEW;
END $$;
CREATE TRIGGER lesson_progress_track_completed AFTER INSERT ON public.lesson_progress FOR EACH ROW EXECUTE FUNCTION public.log_track_completed();

-- Live reminders are queued as simulated notices
ALTER TABLE public.notification_outbox ADD COLUMN IF NOT EXISTS lesson_id uuid REFERENCES public.lessons(id) ON DELETE CASCADE;
CREATE OR REPLACE FUNCTION public.queue_lesson_reminder() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _l public.lessons;
BEGIN
  SELECT * INTO _l FROM public.lessons WHERE id = NEW.lesson_id;
  INSERT INTO public.notification_outbox (lesson_id, channel, recipient, template, payload, send_after, status)
  VALUES (NEW.lesson_id, 'email', NEW.user_id::text, 'live_lesson_reminder',
    jsonb_build_object('title', _l.title_en, 'starts_at', _l.live_starts_at),
    greatest(now(), coalesce(_l.live_starts_at, now()) - interval '1 hour'), 'simulated');
  RETURN NEW;
END $$;
CREATE TRIGGER lesson_reminders_queue AFTER INSERT ON public.lesson_reminders FOR EACH ROW EXECUTE FUNCTION public.queue_lesson_reminder();
REVOKE EXECUTE ON FUNCTION public.single_start_here(), public.log_track_completed(), public.queue_lesson_reminder() FROM PUBLIC, anon, authenticated;

-- Meeting link: only from 10 minutes before start, to people who can read the track
CREATE OR REPLACE FUNCTION public.live_lesson_link(_lesson uuid) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _l public.lessons; _url text;
BEGIN
  SELECT * INTO _l FROM public.lessons WHERE id = _lesson;
  IF NOT FOUND OR _l.type <> 'live' OR NOT public.can_read_track(_l.track_id) THEN RETURN NULL; END IF;
  IF NOT public.can_edit_track(_l.track_id) AND (_l.live_starts_at IS NULL OR now() < _l.live_starts_at - interval '10 minutes') THEN RETURN NULL; END IF;
  SELECT url INTO _url FROM public.lesson_live_links WHERE lesson_id = _lesson;
  RETURN _url;
END $$;
REVOKE EXECUTE ON FUNCTION public.live_lesson_link(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.live_lesson_link(uuid) TO authenticated;

-- Leader view: started / completed counts per track (activity only)
CREATE OR REPLACE FUNCTION public.track_progress(_team uuid)
RETURNS TABLE(track_id uuid, lessons integer, started integer, completed integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_team_member(_team, ARRAY['leader']) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  RETURN QUERY
  WITH tl AS (SELECT t.id, (SELECT count(*) FROM public.lessons l WHERE l.track_id = t.id)::int AS n FROM public.tracks t WHERE t.team_id = _team),
  per AS (SELECT l.track_id, p.user_id, count(*)::int AS done FROM public.lesson_progress p JOIN public.lessons l ON l.id = p.lesson_id
          WHERE l.track_id IN (SELECT id FROM tl) GROUP BY l.track_id, p.user_id)
  SELECT tl.id, tl.n,
    (SELECT count(*)::int FROM per WHERE per.track_id = tl.id),
    (SELECT count(*)::int FROM per WHERE per.track_id = tl.id AND tl.n > 0 AND per.done >= tl.n)
  FROM tl;
END $$;
REVOKE EXECUTE ON FUNCTION public.track_progress(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.track_progress(uuid) TO authenticated;

-- Private storage for lesson files: <team_id>/...
CREATE POLICY "Leaders upload learn media" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'learn-media' AND public.is_team_member(((storage.foldername(name))[1])::uuid, ARRAY['leader']));
CREATE POLICY "Leaders remove learn media" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'learn-media' AND public.is_team_member(((storage.foldername(name))[1])::uuid, ARRAY['leader']));
CREATE POLICY "Team reads learn media" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'learn-media' AND (public.can_use_team_templates(((storage.foldername(name))[1])::uuid) OR public.is_team_member(((storage.foldername(name))[1])::uuid, ARRAY['leader'])));

-- Six shared starter recipes
INSERT INTO public.recipes (team_id, created_by, title_en, title_es, cover_style, prep_minutes, tags, ingredients, steps) VALUES
(NULL, NULL, 'Overnight oats', 'Avena remojada', 0, 5, ARRAY['breakfast','quick'],
 '{"en":["1/2 cup rolled oats","1/2 cup milk of your choice","1/4 cup yogurt","1 tsp honey","Fresh fruit to top"],"es":["1/2 taza de avena en hojuelas","1/2 taza de leche de tu preferencia","1/4 taza de yogur","1 cdta de miel","Fruta fresca para decorar"]}',
 '{"en":["Stir oats, milk, yogurt and honey in a jar.","Cover and chill overnight.","Top with fruit in the morning and enjoy."],"es":["Mezcla la avena, la leche, el yogur y la miel en un frasco.","Tapa y refrigera toda la noche.","Por la mañana, agrega la fruta y disfruta."]}'),
(NULL, NULL, 'Berry smoothie', 'Licuado de frutos rojos', 1, 5, ARRAY['shake','quick','breakfast'],
 '{"en":["1 cup mixed berries","1 banana","1 cup milk of your choice","A handful of ice"],"es":["1 taza de frutos rojos","1 plátano","1 taza de leche de tu preferencia","Un puño de hielo"]}',
 '{"en":["Add everything to a blender.","Blend until smooth.","Pour and serve right away."],"es":["Pon todo en la licuadora.","Licúa hasta que quede cremoso.","Sirve de inmediato."]}'),
(NULL, NULL, 'Veggie egg muffins', 'Muffins de huevo con verduras', 2, 25, ARRAY['breakfast','family','snack'],
 '{"en":["6 eggs","1 cup chopped spinach","1/2 bell pepper, diced","1/4 cup shredded cheese","Salt and pepper"],"es":["6 huevos","1 taza de espinaca picada","1/2 pimiento, en cubitos","1/4 taza de queso rallado","Sal y pimienta"]}',
 '{"en":["Heat the oven to 180°C / 350°F and grease a muffin tin.","Whisk the eggs with salt and pepper.","Divide the vegetables and cheese into the cups and pour the eggs over.","Bake for 18–20 minutes until set."],"es":["Precalienta el horno a 180 °C / 350 °F y engrasa un molde para muffins.","Bate los huevos con sal y pimienta.","Reparte las verduras y el queso en el molde y vierte el huevo encima.","Hornea de 18 a 20 minutos hasta que cuajen."]}'),
(NULL, NULL, 'Chicken lettuce wraps', 'Tacos de lechuga con pollo', 3, 20, ARRAY['family','quick'],
 '{"en":["2 cups cooked chicken, shredded","1 head butter lettuce","1 carrot, grated","1 cucumber, sliced thin","2 tbsp soy sauce","1 lime"],"es":["2 tazas de pollo cocido deshebrado","1 lechuga orejona","1 zanahoria rallada","1 pepino en rebanadas finas","2 cdas de salsa de soya","1 limón"]}',
 '{"en":["Warm the chicken with the soy sauce in a pan.","Separate and rinse the lettuce leaves.","Fill each leaf with chicken, carrot and cucumber.","Finish with a squeeze of lime."],"es":["Calienta el pollo con la salsa de soya en un sartén.","Separa y enjuaga las hojas de lechuga.","Rellena cada hoja con pollo, zanahoria y pepino.","Termina con unas gotas de limón."]}'),
(NULL, NULL, 'Fruit and yogurt parfait', 'Parfait de fruta y yogur', 4, 5, ARRAY['snack','breakfast','quick'],
 '{"en":["1 cup yogurt","1/2 cup granola","1/2 cup chopped fruit"],"es":["1 taza de yogur","1/2 taza de granola","1/2 taza de fruta picada"]}',
 '{"en":["Spoon a layer of yogurt into a glass.","Add a layer of fruit, then granola.","Repeat and serve."],"es":["Pon una capa de yogur en un vaso.","Agrega una capa de fruta y luego granola.","Repite y sirve."]}'),
(NULL, NULL, 'Sheet-pan vegetables', 'Verduras al horno en charola', 5, 35, ARRAY['family'],
 '{"en":["2 zucchini","1 red onion","2 bell peppers","1 cup cherry tomatoes","2 tbsp olive oil","Salt, pepper and dried herbs"],"es":["2 calabacitas","1 cebolla morada","2 pimientos","1 taza de jitomates cherry","2 cdas de aceite de oliva","Sal, pimienta y hierbas secas"]}',
 '{"en":["Heat the oven to 200°C / 400°F.","Cut the vegetables into similar-sized pieces.","Toss with oil and seasoning on a sheet pan.","Roast for 25 minutes, turning once."],"es":["Precalienta el horno a 200 °C / 400 °F.","Corta las verduras en trozos parecidos.","Mézclalas con el aceite y los condimentos en una charola.","Hornea 25 minutos, volteándolas una vez."]}');
