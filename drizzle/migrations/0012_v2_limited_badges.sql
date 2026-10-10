ALTER TABLE public.badges ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS available_from timestamptz,
  ADD COLUMN IF NOT EXISTS available_until timestamptz,
  ADD COLUMN IF NOT EXISTS founding_limit integer;
ALTER TABLE public.badges ADD CONSTRAINT badges_kind_check CHECK (kind IN ('standard','seasonal','event','founding'));
ALTER TABLE public.badges ADD CONSTRAINT badges_window_check CHECK (kind <> 'seasonal' OR (available_from IS NOT NULL AND available_until IS NOT NULL AND available_until > available_from));
CREATE INDEX IF NOT EXISTS badges_event_idx ON public.badges(event_id) WHERE event_id IS NOT NULL;

-- Founding member (global definition, granted per team)
INSERT INTO public.badges (code, name_en, name_es, description_en, description_es, icon, tier, is_custom, team_id, created_by, sort_order, kind, founding_limit)
VALUES ('founding_member','Founding member','Miembro fundador','One of the first 25 people to join this team.','Una de las primeras 25 personas en unirse a este equipo.','Crown','gold',false,NULL,NULL,5,'founding',25)
ON CONFLICT (code) DO NOTHING;

-- Host creates a badge only attendees of their gathering earn
CREATE OR REPLACE FUNCTION public.create_event_badge(_event uuid, _name_en text, _name_es text, _icon text, _tier text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _e public.events; _id uuid;
BEGIN
  SELECT * INTO _e FROM public.events WHERE id = _event;
  IF _e.id IS NULL OR NOT public.can_manage_event(_event) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  IF length(trim(coalesce(_name_en,''))) = 0 OR length(trim(coalesce(_name_es,''))) = 0 OR length(_name_en) > 40 OR length(_name_es) > 40 THEN RAISE EXCEPTION 'invalid'; END IF;
  IF _tier NOT IN ('bronze','silver','gold') THEN RAISE EXCEPTION 'invalid'; END IF;
  IF public.has_blocked_claim(_name_en || ' ' || _name_es) THEN RAISE EXCEPTION 'claim_blocked'; END IF;
  IF EXISTS (SELECT 1 FROM public.badges WHERE event_id = _event AND kind = 'event') THEN RAISE EXCEPTION 'already_exists'; END IF;
  INSERT INTO public.badges (name_en, name_es, description_en, description_es, icon, tier, is_custom, team_id, created_by, kind, event_id)
  VALUES (trim(_name_en), trim(_name_es), 'Only for people who came to ' || _e.title || '.', 'Solo para quienes vinieron a ' || _e.title || '.',
    coalesce(nullif(_icon,''),'Award'), _tier, true, _e.team_id, auth.uid(), 'event', _event) RETURNING id INTO _id;
  -- anyone already checked in earns it now
  PERFORM public.grant_badge(r.user_id, _e.team_id, _id, NULL, NULL) FROM public.rsvps r WHERE r.event_id = _event AND r.checked_in_at IS NOT NULL AND r.user_id IS NOT NULL;
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.create_event_badge(uuid,text,text,text,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_event_badge(uuid,text,text,text,text) TO authenticated;

-- Real holder counts
CREATE OR REPLACE FUNCTION public.badge_holder_counts(_ids uuid[])
RETURNS TABLE(badge_id uuid, holders integer) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT ub.badge_id, count(DISTINCT ub.user_id)::int FROM public.user_badges ub
  JOIN public.badges b ON b.id = ub.badge_id
  WHERE ub.badge_id = ANY(_ids) AND (b.team_id IS NULL OR public.can_use_team_templates(b.team_id) OR public.is_team_member(b.team_id, ARRAY['leader']))
  GROUP BY ub.badge_id
$$;
REVOKE ALL ON FUNCTION public.badge_holder_counts(uuid[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.badge_holder_counts(uuid[]) TO authenticated;

-- Check-in grants seasonal + gathering badges
CREATE OR REPLACE FUNCTION public.limited_badges_on_checkin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _e public.events; _b record;
BEGIN
  IF NEW.checked_in_at IS NULL OR NEW.user_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.checked_in_at IS NOT NULL THEN RETURN NEW; END IF;
  SELECT * INTO _e FROM public.events WHERE id = NEW.event_id;
  IF _e.id IS NULL THEN RETURN NEW; END IF;
  FOR _b IN SELECT id FROM public.badges WHERE
    (kind = 'event' AND event_id = _e.id)
    OR (kind = 'seasonal' AND team_id = _e.team_id AND _e.starts_at >= available_from AND _e.starts_at < available_until)
  LOOP PERFORM public.grant_badge(NEW.user_id, _e.team_id, _b.id, NULL, NULL); END LOOP;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS rsvp_limited_badges ON public.rsvps;
CREATE TRIGGER rsvp_limited_badges AFTER INSERT OR UPDATE OF checked_in_at ON public.rsvps FOR EACH ROW EXECUTE FUNCTION public.limited_badges_on_checkin();

-- Founding member: first N to join each team
CREATE OR REPLACE FUNCTION public.founding_on_join()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _b public.badges; _rank int;
BEGIN
  SELECT * INTO _b FROM public.badges WHERE code = 'founding_member' AND team_id IS NULL;
  IF _b.id IS NULL THEN RETURN NEW; END IF;
  SELECT count(*) INTO _rank FROM public.team_members WHERE team_id = NEW.team_id AND (joined_at < NEW.joined_at OR (joined_at = NEW.joined_at AND user_id < NEW.user_id));
  IF _rank < coalesce(_b.founding_limit, 25) THEN PERFORM public.grant_badge(NEW.user_id, NEW.team_id, _b.id, NULL, NULL); END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS team_member_founding ON public.team_members;
CREATE TRIGGER team_member_founding AFTER INSERT ON public.team_members FOR EACH ROW EXECUTE FUNCTION public.founding_on_join();

-- Backfill founding members for existing teams
INSERT INTO public.user_badges (user_id, badge_id, team_id)
SELECT m.user_id, b.id, m.team_id FROM (
  SELECT team_id, user_id, row_number() OVER (PARTITION BY team_id ORDER BY joined_at, user_id) rn FROM public.team_members
) m CROSS JOIN public.badges b
WHERE b.code = 'founding_member' AND b.team_id IS NULL AND m.rn <= 25
ON CONFLICT (user_id, badge_id, team_id) DO NOTHING;