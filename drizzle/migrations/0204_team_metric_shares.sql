CREATE TABLE public.team_metric_shares (
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  metrics text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, user_id),
  CONSTRAINT team_metric_shares_allowed CHECK (metrics <@ ARRAY['upcoming_events','registrations','attendance']::text[])
);
GRANT SELECT ON public.team_metric_shares TO authenticated;
GRANT ALL ON public.team_metric_shares TO service_role;
ALTER TABLE public.team_metric_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Coaches read their own sharing choices" ON public.team_metric_shares FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.team_member_active(_team uuid, _user uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.team_members m WHERE m.team_id = _team AND m.user_id = _user AND m.suspended_at IS NULL) $$;
REVOKE ALL ON FUNCTION public.team_member_active(uuid, uuid) FROM PUBLIC, anon;

-- A coach chooses, per team, which high-level metrics that team's sole leader may see. Empty = share nothing.
CREATE OR REPLACE FUNCTION public.set_team_metric_share(_team uuid, _metrics text[]) RETURNS text[] LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _clean text[];
BEGIN
  IF auth.uid() IS NULL OR NOT public.team_member_active(_team, auth.uid()) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  IF EXISTS (SELECT 1 FROM public.teams WHERE id = _team AND owner_id = auth.uid()) THEN RAISE EXCEPTION 'leader_self'; END IF;
  SELECT coalesce(array_agg(DISTINCT m ORDER BY m), '{}') INTO _clean FROM unnest(coalesce(_metrics, '{}')) m;
  IF NOT _clean <@ ARRAY['upcoming_events','registrations','attendance']::text[] THEN RAISE EXCEPTION 'invalid_metric'; END IF;
  INSERT INTO public.team_metric_shares(team_id, user_id, metrics, updated_at) VALUES (_team, auth.uid(), _clean, now())
    ON CONFLICT (team_id, user_id) DO UPDATE SET metrics = excluded.metrics, updated_at = now();
  RETURN _clean;
END $$;
REVOKE ALL ON FUNCTION public.set_team_metric_share(uuid, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_team_metric_share(uuid, text[]) TO authenticated;

-- Sole leader only; returns only opted-in metrics for an active member; never attendee identities, contacts or money.
CREATE OR REPLACE FUNCTION public.team_member_insights(_team uuid, _user uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _m text[]; _from timestamptz := now() - interval '90 days'; _events jsonb; _name text;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.teams WHERE id = _team AND owner_id = auth.uid()) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  IF _user = auth.uid() OR NOT public.team_member_active(_team, _user) THEN RAISE EXCEPTION 'not_member'; END IF;
  SELECT full_name INTO _name FROM public.profiles WHERE id = _user;
  SELECT metrics INTO _m FROM public.team_metric_shares WHERE team_id = _team AND user_id = _user;
  _m := coalesce(_m, '{}');
  IF cardinality(_m) = 0 THEN RETURN jsonb_build_object('name', _name, 'shared', '[]'::jsonb, 'from', _from); END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'title', e.title, 'starts_at', e.starts_at, 'timezone', e.timezone,
      'public', e.visibility = 'public',
      'registered', CASE WHEN 'registrations' = ANY(_m) THEN (SELECT coalesce(sum(1 + r.plus_ones), 0) FROM public.rsvps r WHERE r.event_id = e.id AND r.status IN ('going','maybe') AND r.merged_into_rsvp_id IS NULL) END,
      'checked_in', CASE WHEN 'attendance' = ANY(_m) AND e.starts_at <= now() THEN (SELECT coalesce(sum(1 + r.plus_ones), 0) FROM public.rsvps r WHERE r.event_id = e.id AND r.checked_in_at IS NOT NULL AND r.merged_into_rsvp_id IS NULL) END)
    ORDER BY e.starts_at DESC), '[]'::jsonb) INTO _events
  FROM public.events e WHERE e.host_id = _user AND e.status = 'published' AND e.starts_at >= _from
    AND (e.starts_at <= now() OR 'upcoming_events' = ANY(_m) OR 'registrations' = ANY(_m))
    AND (e.starts_at > now() OR 'registrations' = ANY(_m) OR 'attendance' = ANY(_m));
  RETURN jsonb_build_object('name', _name, 'shared', to_jsonb(_m), 'from', _from,
    'upcoming_count', CASE WHEN 'upcoming_events' = ANY(_m) THEN (SELECT count(*) FROM public.events WHERE host_id = _user AND status = 'published' AND starts_at > now()) END,
    'events', _events);
END $$;
REVOKE ALL ON FUNCTION public.team_member_insights(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.team_member_insights(uuid, uuid) TO authenticated;