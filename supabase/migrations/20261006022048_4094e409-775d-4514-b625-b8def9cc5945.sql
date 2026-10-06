CREATE TABLE public.waivers (
  team_id uuid PRIMARY KEY REFERENCES public.teams(id) ON DELETE CASCADE,
  title_en text NOT NULL, title_es text NOT NULL,
  body_en text NOT NULL, body_es text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  is_draft boolean NOT NULL DEFAULT true,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (length(title_en) BETWEEN 1 AND 120 AND length(title_es) BETWEEN 1 AND 120 AND length(body_en) BETWEEN 1 AND 8000 AND length(body_es) BETWEEN 1 AND 8000)
);
GRANT SELECT, UPDATE ON public.waivers TO authenticated;
GRANT ALL ON public.waivers TO service_role;
ALTER TABLE public.waivers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team members read the team waiver" ON public.waivers FOR SELECT TO authenticated USING (public.is_team_member(team_id, NULL));
CREATE POLICY "Hosts and leaders edit the team waiver" ON public.waivers FOR UPDATE TO authenticated
  USING (public.is_team_member(team_id, ARRAY['leader','host'])) WITH CHECK (public.is_team_member(team_id, ARRAY['leader','host']));

CREATE OR REPLACE FUNCTION public.waiver_bump() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.team_id := OLD.team_id; NEW.updated_at := now(); NEW.updated_by := auth.uid();
  IF auth.uid() IS NOT NULL THEN NEW.is_draft := OLD.is_draft; END IF; -- only staff clear the draft label
  IF (NEW.body_en, NEW.body_es, NEW.title_en, NEW.title_es) IS DISTINCT FROM (OLD.body_en, OLD.body_es, OLD.title_en, OLD.title_es) THEN NEW.version := OLD.version + 1; ELSE NEW.version := OLD.version; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER waiver_bump BEFORE UPDATE ON public.waivers FOR EACH ROW EXECUTE FUNCTION public.waiver_bump();

CREATE OR REPLACE FUNCTION public.default_waiver(_team uuid) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO waivers(team_id, title_en, title_es, body_en, body_es) VALUES (_team,
  'Participation waiver', 'Exención de responsabilidad',
  E'I am choosing to take part in this gathering on my own. I understand that physical activity carries some risk of injury, and I take responsibility for knowing my own limits.\n\nI will follow the host''s safety instructions, stop if I feel unwell, and let the host know about anything they should be aware of.\n\nI release the host, co-hosts and team from claims for injuries or losses that happen during the gathering, except those caused by gross negligence or intentional harm.\n\nI am 18 or older, or a parent or guardian has agreed for me.',
  E'Elijo participar en esta reunión por decisión propia. Entiendo que la actividad física tiene cierto riesgo de lesión y me hago responsable de conocer mis propios límites.\n\nSeguiré las indicaciones de seguridad de quien organiza, me detendré si me siento mal y le avisaré de cualquier cosa que deba saber.\n\nLibero a quien organiza, a quienes coorganizan y al equipo de reclamos por lesiones o pérdidas que ocurran durante la reunión, salvo las causadas por negligencia grave o daño intencional.\n\nTengo 18 años o más, o mi madre, padre o tutor lo autorizó.')
  ON CONFLICT (team_id) DO NOTHING;
$$;
REVOKE ALL ON FUNCTION public.default_waiver(uuid) FROM public, anon, authenticated;
SELECT public.default_waiver(id) FROM public.teams;
CREATE OR REPLACE FUNCTION public.waiver_on_team() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM default_waiver(NEW.id); RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public.waiver_on_team() FROM public, anon, authenticated;
CREATE TRIGGER waiver_on_team AFTER INSERT ON public.teams FOR EACH ROW EXECUTE FUNCTION public.waiver_on_team();

-- Which gatherings need it (on by default for in-person physical activities)
ALTER TABLE public.events ADD COLUMN requires_waiver boolean NOT NULL DEFAULT false;
CREATE OR REPLACE FUNCTION public.waiver_default_on_event() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF nullif(trim(coalesce(NEW.online_url,'')),'') IS NULL AND coalesce(NEW.category, infer_gathering_category(NEW.title, NEW.category)) IN ('run','fitcamp','yoga','hike','walk','pickleball') THEN NEW.requires_waiver := true; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER waiver_default_on_event BEFORE INSERT ON public.events FOR EACH ROW EXECUTE FUNCTION public.waiver_default_on_event();
UPDATE public.events SET requires_waiver = true WHERE starts_at > now() AND nullif(trim(coalesce(online_url,'')),'') IS NULL AND category IN ('run','fitcamp','yoga','hike','walk','pickleball');

CREATE TABLE public.waiver_acceptances (
  rsvp_id uuid PRIMARY KEY REFERENCES public.rsvps(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  team_id uuid NOT NULL,
  version integer NOT NULL,
  full_name text NOT NULL,
  ip text,
  source text NOT NULL DEFAULT 'rsvp' CHECK (source IN ('rsvp','walk_in')),
  accepted_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.waiver_acceptances TO authenticated;
GRANT ALL ON public.waiver_acceptances TO service_role;
ALTER TABLE public.waiver_acceptances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Hosts and leaders read waiver records" ON public.waiver_acceptances FOR SELECT TO authenticated USING (public.can_manage_event(event_id));

CREATE OR REPLACE FUNCTION public.request_ip() RETURNS text LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT nullif(trim(split_part(coalesce(current_setting('request.headers', true)::json->>'x-forwarded-for', ''), ',', 1)), '');
$$;

CREATE OR REPLACE FUNCTION public.record_waiver(_rsvp uuid, _name text, _ip text, _source text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; _v int;
BEGIN
  IF length(trim(coalesce(_name,''))) NOT BETWEEN 2 AND 120 THEN RAISE EXCEPTION 'waiver_required'; END IF;
  SELECT rs.id, e.id event_id, e.team_id INTO r FROM rsvps rs JOIN events e ON e.id = rs.event_id WHERE rs.id = _rsvp;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  PERFORM default_waiver(r.team_id);
  SELECT version INTO _v FROM waivers WHERE team_id = r.team_id;
  INSERT INTO waiver_acceptances(rsvp_id, event_id, team_id, version, full_name, ip, source)
  VALUES (_rsvp, r.event_id, r.team_id, _v, trim(_name), left(_ip, 64), _source)
  ON CONFLICT (rsvp_id) DO UPDATE SET version = EXCLUDED.version, full_name = EXCLUDED.full_name, ip = EXCLUDED.ip, accepted_at = now()
    WHERE waiver_acceptances.version < EXCLUDED.version;
END $$;
REVOKE ALL ON FUNCTION public.record_waiver(uuid, text, text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_waiver(uuid, text, text, text) TO service_role;

-- Guest-facing: waiver text for a gathering they can see
CREATE OR REPLACE FUNCTION public.event_waiver(_event uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE e record; w record;
BEGIN
  SELECT id, team_id, requires_waiver, visibility, status INTO e FROM events WHERE id = _event;
  IF NOT FOUND OR NOT ((e.visibility = 'public' AND e.status IN ('published','cancelled')) OR (auth.uid() IS NOT NULL AND can_view_event(_event))) THEN RETURN NULL; END IF;
  IF NOT e.requires_waiver THEN RETURN jsonb_build_object('required', false); END IF;
  SELECT * INTO w FROM waivers WHERE team_id = e.team_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('required', false); END IF;
  RETURN jsonb_build_object('required', true, 'version', w.version, 'draft', w.is_draft, 'title_en', w.title_en, 'title_es', w.title_es, 'body_en', w.body_en, 'body_es', w.body_es);
END $$;
GRANT EXECUTE ON FUNCTION public.event_waiver(uuid) TO anon, authenticated;

-- RSVP plus waiver acceptance in one step
CREATE OR REPLACE FUNCTION public.rsvp_event_waiver(_event_id uuid, _first text, _last text, _phone text, _email text,
  _language text, _plus_ones int, _status text, _sms boolean, _mail boolean, _waiver_name text)
RETURNS TABLE (code text, status text) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _req boolean; _code text; _st text; _rid uuid;
BEGIN
  SELECT requires_waiver INTO _req FROM events WHERE id = _event_id;
  IF coalesce(_req, false) AND length(trim(coalesce(_waiver_name,''))) < 2 THEN RAISE EXCEPTION 'waiver_required'; END IF;
  SELECT r.code, r.status INTO _code, _st FROM rsvp_event(_event_id, _first, _last, _phone, _email, _language, _plus_ones, _status, _sms, _mail) r;
  IF coalesce(_req, false) THEN
    SELECT id INTO _rid FROM rsvps WHERE checkin_code = _code;
    PERFORM record_waiver(_rid, _waiver_name, request_ip(), 'rsvp');
  END IF;
  RETURN QUERY SELECT _code, _st;
END $$;
GRANT EXECUTE ON FUNCTION public.rsvp_event_waiver(uuid, text, text, text, text, text, int, text, boolean, boolean, text) TO anon, authenticated;

-- Walk-ins accept at check-in (host enters the name the guest typed)
CREATE OR REPLACE FUNCTION public.walk_in_waiver(_rsvp uuid, _name text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _ev uuid;
BEGIN
  SELECT event_id INTO _ev FROM rsvps WHERE id = _rsvp;
  IF _ev IS NULL OR NOT can_manage_event(_ev) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  PERFORM record_waiver(_rsvp, _name, request_ip(), 'walk_in');
END $$;
REVOKE ALL ON FUNCTION public.walk_in_waiver(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.walk_in_waiver(uuid, text) TO authenticated;