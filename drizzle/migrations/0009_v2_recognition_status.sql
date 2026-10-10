
-- 1. Featured badge slots (up to 3 per person per team)
ALTER TABLE public.user_badges ADD COLUMN featured smallint;
CREATE UNIQUE INDEX user_badges_featured_slot ON public.user_badges (user_id, team_id, featured) WHERE featured IS NOT NULL;

CREATE OR REPLACE FUNCTION public.feature_badge(_id uuid, _slot smallint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _row public.user_badges%ROWTYPE;
BEGIN
  SELECT * INTO _row FROM public.user_badges WHERE id = _id;
  IF _row.id IS NULL OR _row.user_id <> auth.uid() THEN RAISE EXCEPTION 'not_allowed'; END IF;
  IF _slot IS NULL THEN
    UPDATE public.user_badges SET featured = NULL WHERE id = _id;
    RETURN;
  END IF;
  IF _slot < 1 OR _slot > 3 THEN RAISE EXCEPTION 'invalid_slot'; END IF;
  UPDATE public.user_badges SET featured = NULL WHERE user_id = _row.user_id AND team_id = _row.team_id AND featured = _slot;
  UPDATE public.user_badges SET featured = _slot WHERE id = _id;
END $$;

-- Anyone may read up to 3 featured badges for a person (names/icons only, for profiles and the public host page)
CREATE OR REPLACE FUNCTION public.featured_badges(_user uuid)
RETURNS TABLE(id uuid, code text, name_en text, name_es text, icon text, tier text, featured smallint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT b.id, b.code, b.name_en, b.name_es, b.icon, b.tier, ub.featured
  FROM public.user_badges ub JOIN public.badges b ON b.id = ub.badge_id
  WHERE ub.user_id = _user AND ub.featured IS NOT NULL
  ORDER BY ub.featured LIMIT 3
$$;
GRANT EXECUTE ON FUNCTION public.featured_badges(uuid) TO anon, authenticated;

-- 2. Member of the month (mirrors host_of_month)
CREATE TABLE public.member_of_month (
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  month date NOT NULL,
  note text,
  awarded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, month)
);
GRANT SELECT ON public.member_of_month TO authenticated;
GRANT ALL ON public.member_of_month TO service_role;
ALTER TABLE public.member_of_month ENABLE ROW LEVEL SECURITY;
CREATE POLICY member_of_month_read ON public.member_of_month FOR SELECT TO authenticated
  USING (public.is_team_member(team_id, ARRAY['leader','host','member']));

CREATE OR REPLACE FUNCTION public.name_member_of_month(_team uuid, _user uuid, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _m date := date_trunc('month', now())::date; _name text;
BEGIN
  IF NOT public.is_team_member(_team, ARRAY['leader']) THEN RAISE EXCEPTION 'not_leader'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.team_members WHERE team_id = _team AND user_id = _user) THEN RAISE EXCEPTION 'invalid_person'; END IF;
  IF length(coalesce(_note,'')) > 280 THEN RAISE EXCEPTION 'invalid_message'; END IF;
  IF public.has_blocked_claim(_note) THEN RAISE EXCEPTION 'claim_blocked'; END IF;
  INSERT INTO public.member_of_month (team_id, user_id, month, note, awarded_by) VALUES (_team, _user, _m, nullif(trim(coalesce(_note,'')),''), auth.uid())
  ON CONFLICT (team_id, month) DO UPDATE SET user_id = EXCLUDED.user_id, note = EXCLUDED.note, awarded_by = EXCLUDED.awarded_by, created_at = now();
  DELETE FROM public.activity WHERE team_id = _team AND type = 'member_of_month' AND payload->>'month' = _m::text;
  SELECT full_name INTO _name FROM public.profiles WHERE id = _user;
  INSERT INTO public.activity (team_id, actor_id, type, payload) VALUES (_team, _user, 'member_of_month',
    jsonb_build_object('month', _m, 'note', nullif(trim(coalesce(_note,'')),''), 'name', coalesce(_name,'')));
END $$;

-- 3. Milestone medallions (auto-granted)
CREATE OR REPLACE FUNCTION public.evaluate_milestones(_user uuid, _team uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _n int;
BEGIN
  IF _user IS NULL OR _team IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.team_members WHERE team_id = _team AND user_id = _user) THEN RETURN; END IF;

  -- gatherings attended (checked in)
  SELECT count(*) INTO _n FROM public.rsvps r JOIN public.events e ON e.id = r.event_id
    WHERE r.user_id = _user AND e.team_id = _team AND r.checked_in_at IS NOT NULL;
  IF _n >= 10 THEN PERFORM public.grant_auto_badge(_user, _team, 'milestone_attended_10'); END IF;
  IF _n >= 25 THEN PERFORM public.grant_auto_badge(_user, _team, 'milestone_attended_25'); END IF;
  IF _n >= 50 THEN PERFORM public.grant_auto_badge(_user, _team, 'milestone_attended_50'); END IF;
  IF _n >= 100 THEN PERFORM public.grant_auto_badge(_user, _team, 'milestone_attended_100'); END IF;

  -- one-year member
  IF EXISTS (SELECT 1 FROM public.team_members WHERE team_id = _team AND user_id = _user AND created_at <= now() - interval '1 year') THEN
    PERFORM public.grant_auto_badge(_user, _team, 'milestone_member_1yr');
  END IF;

  -- first gathering hosted
  IF EXISTS (SELECT 1 FROM public.events WHERE host_id = _user AND team_id = _team AND status NOT IN ('draft','cancelled')) THEN
    PERFORM public.grant_auto_badge(_user, _team, 'milestone_first_host');
  END IF;

  -- ten regulars made (10 distinct guests with 3+ check-ins at this host's gatherings)
  SELECT count(*) INTO _n FROM (
    SELECT 1 FROM public.rsvps r JOIN public.events e ON e.id = r.event_id
    WHERE e.host_id = _user AND e.team_id = _team AND r.checked_in_at IS NOT NULL AND r.user_id IS DISTINCT FROM _user
    GROUP BY coalesce(r.user_id::text, lower(coalesce(r.email,'')), coalesce(r.phone,''))
    HAVING count(*) >= 3
  ) s;
  IF _n >= 10 THEN PERFORM public.grant_auto_badge(_user, _team, 'milestone_regulars_10'); END IF;
END $$;

CREATE OR REPLACE FUNCTION public.milestones_on_rsvp() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _team uuid; _host uuid;
BEGIN
  IF NEW.checked_in_at IS NULL THEN RETURN NEW; END IF;
  SELECT team_id, host_id INTO _team, _host FROM public.events WHERE id = NEW.event_id;
  IF _team IS NULL THEN RETURN NEW; END IF;
  PERFORM public.evaluate_milestones(NEW.user_id, _team);
  PERFORM public.evaluate_milestones(_host, _team);
  RETURN NEW;
END $$;
CREATE TRIGGER rsvp_milestones AFTER INSERT OR UPDATE OF checked_in_at ON public.rsvps
  FOR EACH ROW EXECUTE FUNCTION public.milestones_on_rsvp();

CREATE OR REPLACE FUNCTION public.milestones_on_event() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM public.evaluate_milestones(NEW.host_id, NEW.team_id);
  RETURN NEW;
END $$;
CREATE TRIGGER event_milestones AFTER INSERT ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.milestones_on_event();
