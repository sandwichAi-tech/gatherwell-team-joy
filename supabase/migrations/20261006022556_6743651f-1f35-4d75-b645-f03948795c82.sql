CREATE TABLE public.event_cohosts (
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  added_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);
CREATE INDEX event_cohosts_user_idx ON public.event_cohosts(user_id);
GRANT SELECT ON public.event_cohosts TO authenticated;
GRANT ALL ON public.event_cohosts TO service_role;
ALTER TABLE public.event_cohosts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team members see co-hosts" ON public.event_cohosts FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND public.is_team_member(e.team_id, ARRAY['leader','host','member'])));

CREATE OR REPLACE FUNCTION public.is_event_cohost(_event uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM event_cohosts WHERE event_id = _event AND user_id = auth.uid());
$$;
GRANT EXECUTE ON FUNCTION public.is_event_cohost(uuid) TO authenticated;

-- Co-hosts manage the gathering: edit, check-in, guest list (all flow through can_manage_event)
CREATE OR REPLACE FUNCTION public.can_manage_event(_event_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.events e WHERE e.id = _event_id
      AND (e.host_id = auth.uid() OR public.is_team_member(e.team_id, ARRAY['leader'])
           OR EXISTS (SELECT 1 FROM public.event_cohosts c WHERE c.event_id = e.id AND c.user_id = auth.uid()))
  );
$$;

DROP POLICY "Hosts and leaders edit events" ON public.events;
CREATE POLICY "Hosts, co-hosts and leaders edit events" ON public.events FOR UPDATE TO authenticated
  USING (is_team_member(team_id, ARRAY['leader']) OR (host_id = auth.uid() AND is_team_member(team_id, ARRAY['host'])) OR public.is_event_cohost(id))
  WITH CHECK (is_team_member(team_id, ARRAY['leader','host']) OR public.is_event_cohost(id));

-- Co-hosts cannot move ownership, team or price, or delete
CREATE OR REPLACE FUNCTION public.guard_cohost_edit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR OLD.host_id = auth.uid() OR is_team_member(OLD.team_id, ARRAY['leader']) THEN RETURN NEW; END IF;
  IF NEW.host_id IS DISTINCT FROM OLD.host_id OR NEW.team_id IS DISTINCT FROM OLD.team_id OR NEW.price_cents IS DISTINCT FROM OLD.price_cents
     OR NEW.offer_id IS DISTINCT FROM OLD.offer_id OR NEW.pass_fee IS DISTINCT FROM OLD.pass_fee THEN
    RAISE EXCEPTION 'host_only';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_cohost_edit() FROM public, anon, authenticated;
CREATE TRIGGER guard_cohost_edit BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.guard_cohost_edit();

-- Follow-up drafts reach co-hosts too
DROP POLICY "Hosts and leaders read follow-ups" ON public.followup_drafts;
CREATE POLICY "Hosts, co-hosts and leaders read follow-ups" ON public.followup_drafts FOR SELECT TO authenticated
  USING (host_id = auth.uid() OR is_team_member(team_id, ARRAY['leader']) OR public.is_event_cohost(event_id));
DROP POLICY "Hosts edit their follow-ups" ON public.followup_drafts;
CREATE POLICY "Hosts and co-hosts edit follow-ups" ON public.followup_drafts FOR UPDATE TO authenticated
  USING (host_id = auth.uid() OR public.is_event_cohost(event_id)) WITH CHECK (host_id = auth.uid() OR public.is_event_cohost(event_id));

-- Host or leader sets up to 3 co-hosts from the gathering's team
CREATE OR REPLACE FUNCTION public.set_event_cohosts(_event uuid, _users uuid[]) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e record; _u uuid; _list uuid[];
BEGIN
  SELECT id, team_id, host_id INTO e FROM events WHERE id = _event;
  IF NOT FOUND OR NOT (e.host_id = auth.uid() OR is_team_member(e.team_id, ARRAY['leader'])) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  SELECT coalesce(array_agg(DISTINCT x), '{}') INTO _list FROM unnest(coalesce(_users, '{}')) x WHERE x <> e.host_id;
  IF cardinality(_list) > 3 THEN RAISE EXCEPTION 'too_many_cohosts'; END IF;
  FOREACH _u IN ARRAY _list LOOP
    IF NOT EXISTS (SELECT 1 FROM team_members WHERE team_id = e.team_id AND user_id = _u) THEN RAISE EXCEPTION 'not_team_member'; END IF;
  END LOOP;
  DELETE FROM event_cohosts WHERE event_id = _event AND NOT (user_id = ANY(_list));
  INSERT INTO event_cohosts(event_id, user_id, added_by) SELECT _event, x, auth.uid() FROM unnest(_list) x ON CONFLICT DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.set_event_cohosts(uuid, uuid[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_event_cohosts(uuid, uuid[]) TO authenticated;

-- Public page lists co-hosts under the host (names and photos only)
CREATE OR REPLACE FUNCTION public.get_public_event(_id uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE e record; _host jsonb; _team text; _initials jsonb; _used int; _mine text; _co jsonb;
BEGIN
  SELECT * INTO e FROM public.events WHERE id = _id AND status IN ('published','cancelled')
    AND (visibility = 'public' OR public.is_team_member(team_id, ARRAY['leader','host','member']));
  IF e IS NULL THEN RETURN NULL; END IF;
  SELECT jsonb_build_object('name', p.full_name, 'avatar_url', p.avatar_url) INTO _host FROM public.profiles p WHERE p.id = e.host_id;
  SELECT coalesce(jsonb_agg(jsonb_build_object('name', p.full_name, 'avatar_url', p.avatar_url) ORDER BY c.created_at), '[]'::jsonb) INTO _co
    FROM public.event_cohosts c JOIN public.profiles p ON p.id = c.user_id WHERE c.event_id = _id;
  SELECT name INTO _team FROM public.teams WHERE id = e.team_id;
  _used := public.event_seats_used(_id);
  IF NOT e.hide_guest_list THEN
    SELECT coalesce(jsonb_agg(i), '[]'::jsonb) INTO _initials FROM (
      SELECT upper(left(coalesce(r.guest_name, p.full_name, '?'),1) ||
        coalesce(left(nullif(split_part(trim(coalesce(r.guest_name, p.full_name, '')), ' ', 2),''),1),'')) AS i
      FROM public.rsvps r LEFT JOIN public.profiles p ON p.id = r.user_id
      WHERE r.event_id = _id AND r.status = 'going' ORDER BY r.created_at LIMIT 8) s;
  END IF;
  IF auth.uid() IS NOT NULL THEN
    SELECT checkin_code INTO _mine FROM public.rsvps WHERE event_id = _id AND user_id = auth.uid() AND status <> 'cancelled' LIMIT 1;
  END IF;
  RETURN jsonb_build_object('id', e.id, 'title', e.title, 'description_en', e.description_en, 'description_es', e.description_es,
    'cover_url', e.cover_url, 'cover_style', e.cover_style, 'starts_at', e.starts_at, 'ends_at', e.ends_at, 'timezone', e.timezone,
    'location_name', e.location_name, 'address', e.address, 'meeting_note', e.meeting_note, 'lat', e.lat, 'lng', e.lng,
    'is_online', e.online_url IS NOT NULL AND e.location_name IS NULL AND e.address IS NULL, 'has_online', e.online_url IS NOT NULL,
    'capacity', e.capacity, 'status', e.status, 'hide_guest_list', e.hide_guest_list, 'going', _used, 'initials', _initials,
    'host', _host, 'cohosts', _co, 'team_name', _team, 'my_code', _mine);
END; $function$;