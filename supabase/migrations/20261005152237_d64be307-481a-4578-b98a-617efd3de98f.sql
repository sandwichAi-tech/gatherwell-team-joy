
CREATE TABLE public.badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE DEFAULT ('custom_' || replace(gen_random_uuid()::text, '-', '')),
  name_en text NOT NULL CHECK (length(name_en) BETWEEN 1 AND 40),
  name_es text NOT NULL CHECK (length(name_es) BETWEEN 1 AND 40),
  description_en text CHECK (length(description_en) <= 160),
  description_es text CHECK (length(description_es) <= 160),
  icon text NOT NULL DEFAULT 'Award',
  tier text NOT NULL DEFAULT 'bronze' CHECK (tier IN ('bronze','silver','gold')),
  is_custom boolean NOT NULL DEFAULT true,
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  created_by uuid DEFAULT auth.uid(),
  sort_order int NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.badges TO authenticated;
GRANT ALL ON public.badges TO service_role;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read global and team badges" ON public.badges FOR SELECT TO authenticated
  USING (team_id IS NULL OR public.can_use_team_templates(team_id) OR public.is_team_member(team_id, ARRAY['leader']));
CREATE POLICY "Leaders add custom badges" ON public.badges FOR INSERT TO authenticated
  WITH CHECK (is_custom AND team_id IS NOT NULL AND created_by = auth.uid() AND public.is_team_member(team_id, ARRAY['leader']));
CREATE POLICY "Leaders edit custom badges" ON public.badges FOR UPDATE TO authenticated
  USING (is_custom AND team_id IS NOT NULL AND public.is_team_member(team_id, ARRAY['leader']))
  WITH CHECK (is_custom AND team_id IS NOT NULL AND public.is_team_member(team_id, ARRAY['leader']));
CREATE POLICY "Leaders delete custom badges" ON public.badges FOR DELETE TO authenticated
  USING (is_custom AND team_id IS NOT NULL AND public.is_team_member(team_id, ARRAY['leader']));

CREATE TABLE public.user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  badge_id uuid NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  awarded_by uuid,
  note text CHECK (length(note) <= 280),
  awarded_at timestamptz NOT NULL DEFAULT now(),
  seen_at timestamptz,
  UNIQUE (user_id, badge_id, team_id)
);
GRANT SELECT ON public.user_badges TO authenticated;
GRANT ALL ON public.user_badges TO service_role;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team reads badges earned" ON public.user_badges FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_team_member(team_id, ARRAY['leader','host','member']));

CREATE TABLE public.shoutouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  from_user uuid NOT NULL,
  to_user uuid NOT NULL,
  message text NOT NULL CHECK (length(message) BETWEEN 1 AND 280),
  photo_path text,
  pinned boolean NOT NULL DEFAULT false,
  hidden boolean NOT NULL DEFAULT false,
  activity_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.shoutouts TO authenticated;
GRANT ALL ON public.shoutouts TO service_role;
ALTER TABLE public.shoutouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team reads shout-outs" ON public.shoutouts FOR SELECT TO authenticated
  USING ((NOT hidden AND public.is_team_member(team_id, ARRAY['leader','host','member'])) OR public.is_team_member(team_id, ARRAY['leader']));
CREATE INDEX shoutouts_team_idx ON public.shoutouts (team_id, created_at DESC);

CREATE TABLE public.host_of_month (
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  month date NOT NULL,
  note text CHECK (length(note) <= 280),
  awarded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, month)
);
GRANT SELECT ON public.host_of_month TO authenticated;
GRANT ALL ON public.host_of_month TO service_role;
ALTER TABLE public.host_of_month ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team reads host of the month" ON public.host_of_month FOR SELECT TO authenticated
  USING (public.is_team_member(team_id, ARRAY['leader','host','member']));

ALTER TABLE public.team_members ADD COLUMN invited_by uuid;

INSERT INTO public.badges (code, name_en, name_es, description_en, description_es, icon, tier, is_custom, team_id, created_by, sort_order) VALUES
 ('first_gathering','First Gathering Hosted','Primera reunión organizada','Host your first gathering.','Organiza tu primera reunión.','CalendarCheck','bronze',false,NULL,NULL,1),
 ('guests_10','10 Guests Welcomed','10 invitados recibidos','Welcome 10 guests to gatherings you host.','Recibe a 10 invitados en reuniones que organizas.','UsersRound','silver',false,NULL,NULL,2),
 ('checkins_50','50 Check-ins Hosted','50 registros de llegada','Check in 50 guests at your gatherings.','Registra la llegada de 50 invitados en tus reuniones.','ClipboardCheck','gold',false,NULL,NULL,3),
 ('first_template','First Template Launched','Primera plantilla lanzada','Launch a gathering from a team template.','Lanza una reunión desde una plantilla del equipo.','Layers','bronze',false,NULL,NULL,4),
 ('track_complete','Track Complete','Ruta completada','Finish every lesson in a Learn track.','Termina todas las lecciones de una ruta de Aprender.','GraduationCap','silver',false,NULL,NULL,5),
 ('challenge_finisher','Challenge Finisher','Reto completado','Check in every day of a team challenge.','Registra todos los días de un reto del equipo.','Flag','silver',false,NULL,NULL,6),
 ('streak_4w','4-Week Streak','Racha de 4 semanas','Host or attend a gathering four weeks in a row.','Organiza o asiste a una reunión cuatro semanas seguidas.','Flame','gold',false,NULL,NULL,7),
 ('welcome_committee','Welcome Committee','Comité de bienvenida','Welcome 5 new members who join through your invite.','Da la bienvenida a 5 personas que se unan con tu invitación.','HandHeart','gold',false,NULL,NULL,8);

-- Core award (internal only)
CREATE OR REPLACE FUNCTION public.grant_badge(_user uuid, _team uuid, _badge uuid, _by uuid, _note text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _b public.badges; _id uuid; _by_name text;
BEGIN
  SELECT * INTO _b FROM public.badges WHERE id = _badge;
  IF _b.id IS NULL THEN RETURN false; END IF;
  INSERT INTO public.user_badges (user_id, badge_id, team_id, awarded_by, note)
  VALUES (_user, _badge, _team, _by, nullif(trim(coalesce(_note,'')), ''))
  ON CONFLICT (user_id, badge_id, team_id) DO NOTHING RETURNING id INTO _id;
  IF _id IS NULL THEN RETURN false; END IF;
  IF _by IS NOT NULL THEN SELECT full_name INTO _by_name FROM public.profiles WHERE id = _by; END IF;
  INSERT INTO public.activity (team_id, actor_id, type, payload) VALUES (_team, _user, 'badge_earned',
    jsonb_build_object('badge_id', _b.id, 'code', _b.code, 'name_en', _b.name_en, 'name_es', _b.name_es, 'icon', _b.icon, 'tier', _b.tier,
      'by_name', _by_name, 'note', nullif(trim(coalesce(_note,'')), '')));
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.grant_auto_badge(_user uuid, _team uuid, _code text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid;
BEGIN
  SELECT id INTO _id FROM public.badges WHERE code = _code AND team_id IS NULL;
  IF _id IS NOT NULL THEN PERFORM public.grant_badge(_user, _team, _id, NULL, NULL); END IF;
END $$;

CREATE OR REPLACE FUNCTION public.evaluate_badges(_user uuid, _team uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _n int; _streak int;
BEGIN
  IF _user IS NULL OR _team IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.team_members WHERE team_id = _team AND user_id = _user) THEN RETURN; END IF;

  IF EXISTS (SELECT 1 FROM public.events WHERE host_id = _user AND team_id = _team AND status NOT IN ('draft','cancelled')) THEN
    PERFORM public.grant_auto_badge(_user, _team, 'first_gathering');
  END IF;
  IF EXISTS (SELECT 1 FROM public.events WHERE host_id = _user AND team_id = _team AND template_id IS NOT NULL AND status NOT IN ('draft','cancelled')) THEN
    PERFORM public.grant_auto_badge(_user, _team, 'first_template');
  END IF;
  SELECT coalesce(sum(1 + r.plus_ones), 0) INTO _n FROM public.rsvps r JOIN public.events e ON e.id = r.event_id
    WHERE e.host_id = _user AND e.team_id = _team AND (r.status = 'going' OR r.checked_in_at IS NOT NULL) AND r.user_id IS DISTINCT FROM _user;
  IF _n >= 10 THEN PERFORM public.grant_auto_badge(_user, _team, 'guests_10'); END IF;
  SELECT count(*) INTO _n FROM public.rsvps r JOIN public.events e ON e.id = r.event_id
    WHERE e.host_id = _user AND e.team_id = _team AND r.checked_in_at IS NOT NULL;
  IF _n >= 50 THEN PERFORM public.grant_auto_badge(_user, _team, 'checkins_50'); END IF;
  IF EXISTS (SELECT 1 FROM public.activity WHERE actor_id = _user AND team_id = _team AND type = 'track_completed') THEN
    PERFORM public.grant_auto_badge(_user, _team, 'track_complete');
  END IF;
  IF EXISTS (SELECT 1 FROM public.activity WHERE actor_id = _user AND team_id = _team AND type = 'challenge_finished') THEN
    PERFORM public.grant_auto_badge(_user, _team, 'challenge_finisher');
  END IF;
  SELECT count(*) INTO _n FROM public.team_members WHERE team_id = _team AND invited_by = _user;
  IF _n >= 5 THEN PERFORM public.grant_auto_badge(_user, _team, 'welcome_committee'); END IF;

  WITH weeks AS (
    SELECT DISTINCT date_trunc('week', e.starts_at)::date AS w FROM public.events e
      WHERE e.team_id = _team AND e.host_id = _user AND e.status NOT IN ('draft','cancelled') AND e.starts_at <= now()
    UNION
    SELECT DISTINCT date_trunc('week', e.starts_at)::date FROM public.rsvps r JOIN public.events e ON e.id = r.event_id
      WHERE e.team_id = _team AND r.user_id = _user AND (r.checked_in_at IS NOT NULL OR r.status = 'going') AND e.status <> 'cancelled' AND e.starts_at <= now()
  ), grp AS (
    SELECT w, w - (row_number() OVER (ORDER BY w))::int * 7 AS g FROM weeks
  )
  SELECT coalesce(max(c), 0) INTO _streak FROM (SELECT count(*) c FROM grp GROUP BY g) s;
  IF _streak >= 4 THEN PERFORM public.grant_auto_badge(_user, _team, 'streak_4w'); END IF;
END $$;

CREATE OR REPLACE FUNCTION public.badges_on_event() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.evaluate_badges(NEW.host_id, NEW.team_id); RETURN NEW; END $$;
CREATE TRIGGER badges_on_event AFTER INSERT OR UPDATE OF status ON public.events FOR EACH ROW EXECUTE FUNCTION public.badges_on_event();

CREATE OR REPLACE FUNCTION public.badges_on_rsvp() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _host uuid; _team uuid;
BEGIN
  SELECT host_id, team_id INTO _host, _team FROM public.events WHERE id = NEW.event_id;
  PERFORM public.evaluate_badges(_host, _team);
  IF NEW.user_id IS NOT NULL AND NEW.user_id IS DISTINCT FROM _host THEN PERFORM public.evaluate_badges(NEW.user_id, _team); END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER badges_on_rsvp AFTER INSERT OR UPDATE OF status, checked_in_at, plus_ones ON public.rsvps FOR EACH ROW EXECUTE FUNCTION public.badges_on_rsvp();

CREATE OR REPLACE FUNCTION public.badges_on_activity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.evaluate_badges(NEW.actor_id, NEW.team_id); RETURN NEW; END $$;
CREATE TRIGGER badges_on_activity AFTER INSERT ON public.activity FOR EACH ROW
  WHEN (NEW.type IN ('track_completed','challenge_finished')) EXECUTE FUNCTION public.badges_on_activity();

CREATE OR REPLACE FUNCTION public.badges_on_member() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.evaluate_badges(NEW.invited_by, NEW.team_id); RETURN NEW; END $$;
CREATE TRIGGER badges_on_member AFTER INSERT ON public.team_members FOR EACH ROW
  WHEN (NEW.invited_by IS NOT NULL) EXECUTE FUNCTION public.badges_on_member();

-- Joining with an optional inviter
DROP FUNCTION IF EXISTS public.join_team_by_code(text, text);
CREATE FUNCTION public.join_team_by_code(_code text, _role text DEFAULT 'member', _by uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _team uuid; _r text := CASE WHEN _role = 'host' THEN 'host' ELSE 'member' END; _inviter uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT id INTO _team FROM public.teams WHERE join_code = upper(trim(coalesce(_code,'')));
  IF _team IS NULL THEN RAISE EXCEPTION 'invalid_code'; END IF;
  IF _by IS NOT NULL AND _by <> auth.uid() AND EXISTS (SELECT 1 FROM public.team_members WHERE team_id = _team AND user_id = _by) THEN _inviter := _by; END IF;
  INSERT INTO public.team_members (team_id, user_id, role, invited_by) VALUES (_team, auth.uid(), _r, _inviter) ON CONFLICT (team_id, user_id) DO NOTHING;
  RETURN _team;
END $$;
REVOKE ALL ON FUNCTION public.join_team_by_code(text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_team_by_code(text, text, uuid) TO authenticated;

-- Claim check
CREATE OR REPLACE FUNCTION public.has_blocked_claim(_text text) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT lower(coalesce(_text,'')) ~ '(weight|lbs?\M|pounds|kilos?\M|\mkg\M|slim|diet pill|fat burn|cure|cures|cured|heal(s|ed)?\M|disease|diabet|cancer|medic|prescription|detox|income|salary|paycheck|commission|earn(ed|ing|s)?\M|\$ ?[0-9]|[0-9]+ ?(usd|dollars|dólares|pesos)|make money|financial freedom|quit (your|my) job|six figures|passive|peso\M|bajar de peso|perder peso|adelgaz|libras|kilos|grasa|cura(r|do|ción)?\M|sana(r|do)?\M|enfermedad|medicina|medicament|ingreso|sueldo|salario|comisi[oó]n|ganar dinero|gan[eé] dinero|libertad financiera|dinero)';
$$;

-- Shout-outs
CREATE OR REPLACE FUNCTION public.give_shoutout(_team uuid, _to uuid, _message text, _photo text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _name text; _id uuid; _act uuid; _msg text := trim(coalesce(_message,''));
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_team_member(_team, ARRAY['leader','host','member']) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  IF _msg = '' OR length(_msg) > 280 THEN RAISE EXCEPTION 'invalid_message'; END IF;
  IF _to = auth.uid() OR NOT EXISTS (SELECT 1 FROM public.team_members WHERE team_id = _team AND user_id = _to) THEN RAISE EXCEPTION 'invalid_person'; END IF;
  IF public.has_blocked_claim(_msg) THEN RAISE EXCEPTION 'claim_blocked'; END IF;
  IF _photo IS NOT NULL AND split_part(_photo, '/', 1) <> auth.uid()::text THEN RAISE EXCEPTION 'invalid_photo'; END IF;
  SELECT full_name INTO _name FROM public.profiles WHERE id = _to;
  INSERT INTO public.shoutouts (team_id, from_user, to_user, message, photo_path) VALUES (_team, auth.uid(), _to, _msg, _photo) RETURNING id INTO _id;
  INSERT INTO public.activity (team_id, actor_id, type, payload)
  VALUES (_team, auth.uid(), 'shoutout', jsonb_build_object('to', _to, 'to_name', coalesce(_name, ''), 'body', _msg, 'shoutout_id', _id, 'photo_path', _photo))
  RETURNING id INTO _act;
  UPDATE public.shoutouts SET activity_id = _act WHERE id = _id;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.post_shoutout(_team uuid, _to uuid, _message text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_team_member(_team, ARRAY['leader']) THEN RAISE EXCEPTION 'not_leader'; END IF;
  PERFORM public.give_shoutout(_team, _to, _message, NULL);
END $$;

CREATE OR REPLACE FUNCTION public.moderate_shoutout(_id uuid, _action text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _s public.shoutouts;
BEGIN
  SELECT * INTO _s FROM public.shoutouts WHERE id = _id;
  IF _s.id IS NULL OR NOT public.is_team_member(_s.team_id, ARRAY['leader']) THEN RAISE EXCEPTION 'not_leader'; END IF;
  IF _action = 'pin' THEN
    UPDATE public.shoutouts SET pinned = false WHERE team_id = _s.team_id AND pinned;
    UPDATE public.shoutouts SET pinned = true, hidden = false WHERE id = _id;
  ELSIF _action = 'unpin' THEN
    UPDATE public.shoutouts SET pinned = false WHERE id = _id;
  ELSIF _action = 'hide' THEN
    UPDATE public.shoutouts SET hidden = true, pinned = false WHERE id = _id;
    IF _s.activity_id IS NOT NULL THEN
      DELETE FROM public.activity_reactions WHERE activity_id = _s.activity_id;
      DELETE FROM public.activity WHERE id = _s.activity_id;
    END IF;
  ELSE RAISE EXCEPTION 'invalid_action'; END IF;
END $$;

-- Leader awards and Host of the Month
CREATE OR REPLACE FUNCTION public.award_badge(_team uuid, _user uuid, _badge uuid, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _b public.badges;
BEGIN
  IF NOT public.is_team_member(_team, ARRAY['leader']) THEN RAISE EXCEPTION 'not_leader'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.team_members WHERE team_id = _team AND user_id = _user) THEN RAISE EXCEPTION 'invalid_person'; END IF;
  SELECT * INTO _b FROM public.badges WHERE id = _badge;
  IF _b.id IS NULL OR (_b.team_id IS NOT NULL AND NOT public.is_team_member(_b.team_id, ARRAY['leader'])) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  IF length(coalesce(_note,'')) > 280 THEN RAISE EXCEPTION 'invalid_message'; END IF;
  IF public.has_blocked_claim(_note) THEN RAISE EXCEPTION 'claim_blocked'; END IF;
  IF NOT public.grant_badge(_user, _team, _badge, auth.uid(), _note) THEN RAISE EXCEPTION 'already_awarded'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.name_host_of_month(_team uuid, _user uuid, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _m date := date_trunc('month', now())::date; _name text;
BEGIN
  IF NOT public.is_team_member(_team, ARRAY['leader']) THEN RAISE EXCEPTION 'not_leader'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.team_members WHERE team_id = _team AND user_id = _user) THEN RAISE EXCEPTION 'invalid_person'; END IF;
  IF length(coalesce(_note,'')) > 280 THEN RAISE EXCEPTION 'invalid_message'; END IF;
  IF public.has_blocked_claim(_note) THEN RAISE EXCEPTION 'claim_blocked'; END IF;
  INSERT INTO public.host_of_month (team_id, user_id, month, note, awarded_by) VALUES (_team, _user, _m, nullif(trim(coalesce(_note,'')),''), auth.uid())
  ON CONFLICT (team_id, month) DO UPDATE SET user_id = EXCLUDED.user_id, note = EXCLUDED.note, awarded_by = EXCLUDED.awarded_by, created_at = now();
  DELETE FROM public.activity WHERE team_id = _team AND type = 'host_of_month' AND payload->>'month' = _m::text;
  SELECT full_name INTO _name FROM public.profiles WHERE id = _user;
  INSERT INTO public.activity (team_id, actor_id, type, payload) VALUES (_team, _user, 'host_of_month',
    jsonb_build_object('month', _m, 'note', nullif(trim(coalesce(_note,'')),''), 'name', coalesce(_name,'')));
END $$;

CREATE OR REPLACE FUNCTION public.mark_badges_seen(_ids uuid[])
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.user_badges SET seen_at = now() WHERE user_id = auth.uid() AND id = ANY(_ids) AND seen_at IS NULL;
$$;

REVOKE ALL ON FUNCTION public.grant_badge(uuid, uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.grant_auto_badge(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.evaluate_badges(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.badges_on_event() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.badges_on_rsvp() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.badges_on_activity() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.badges_on_member() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.give_shoutout(uuid, uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.post_shoutout(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.moderate_shoutout(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.award_badge(uuid, uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.name_host_of_month(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mark_badges_seen(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.give_shoutout(uuid, uuid, text, text), public.post_shoutout(uuid, uuid, text), public.moderate_shoutout(uuid, text),
  public.award_badge(uuid, uuid, uuid, text), public.name_host_of_month(uuid, uuid, text), public.mark_badges_seen(uuid[]), public.has_blocked_claim(text) TO authenticated;

-- Backfill automatic badges already earned
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT team_id, user_id FROM public.team_members LOOP PERFORM public.evaluate_badges(r.user_id, r.team_id); END LOOP;
END $$;
