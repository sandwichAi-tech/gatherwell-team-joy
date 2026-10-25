-- Row 6: structured cancellation/refund policy + publish review guard
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS policy_config jsonb;
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_refund_policy_check;
ALTER TABLE public.events ADD CONSTRAINT events_refund_policy_check CHECK (refund_policy = ANY (ARRAY['24h','7d','none','custom']));

CREATE OR REPLACE FUNCTION public.policy_text_sha(_t text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public, extensions AS $$
  SELECT encode(extensions.digest(coalesce(_t,''), 'sha256'), 'hex') $$;

CREATE OR REPLACE FUNCTION public.guard_event_policy_review() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status = 'published' THEN
    IF coalesce(NEW.policy_config->>'mode','') = 'custom'
       AND coalesce(NEW.policy_config->>'reviewed_sha','') <> public.policy_text_sha(NEW.cancellation_policy) THEN
      RAISE EXCEPTION 'policy_review_required';
    END IF;
    IF coalesce(NEW.price_cents,0) > 0 AND NEW.refund_policy = 'custom' AND nullif(trim(coalesce(NEW.cancellation_policy,'')),'') IS NULL THEN
      RAISE EXCEPTION 'policy_text_required';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS events_policy_review ON public.events;
CREATE TRIGGER events_policy_review BEFORE INSERT OR UPDATE OF status, cancellation_policy, policy_config, refund_policy, price_cents ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.guard_event_policy_review();

CREATE OR REPLACE FUNCTION public.set_event_policy(_event uuid, _config jsonb, _text text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _e public.events; _mode text; _paid boolean; _txt text; _refund text; _pct int; _dl int; _rp text;
BEGIN
  SELECT * INTO _e FROM public.events WHERE id = _event;
  IF _e.id IS NULL OR NOT public.can_manage_event(_event) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  _mode := coalesce(_config->>'mode','');
  IF _mode NOT IN ('','free_anytime','free_notify','paid_24h','paid_7d','paid_none','custom') THEN RAISE EXCEPTION 'policy_invalid'; END IF;
  _paid := coalesce(_e.price_cents,0) > 0;
  IF (_paid AND _mode IN ('free_anytime','free_notify')) OR (NOT _paid AND _mode IN ('paid_24h','paid_7d','paid_none')) THEN RAISE EXCEPTION 'policy_mismatch'; END IF;
  _txt := nullif(left(btrim(coalesce(_text,''), E' \t\r\n'), 1000), '');
  IF _mode <> '' AND _txt IS NULL THEN RAISE EXCEPTION 'policy_text_required'; END IF;
  IF _mode = 'custom' AND _paid THEN
    _refund := coalesce(_config->>'refund','');
    IF _refund NOT IN ('full','percent','none','credit') THEN RAISE EXCEPTION 'policy_invalid'; END IF;
    _pct := nullif(_config->>'percent','')::int; _dl := nullif(_config->>'deadline','')::int;
    IF _refund = 'percent' AND (_pct IS NULL OR _pct < 1 OR _pct > 99) THEN RAISE EXCEPTION 'policy_percent'; END IF;
    IF _refund <> 'none' AND (_dl IS NULL OR _dl < 1 OR _dl > 365) THEN RAISE EXCEPTION 'policy_deadline'; END IF;
  END IF;
  _rp := CASE WHEN NOT _paid THEN _e.refund_policy
              WHEN _mode = 'paid_24h' THEN '24h' WHEN _mode = 'paid_7d' THEN '7d' WHEN _mode = 'paid_none' THEN 'none'
              WHEN _mode = 'custom' THEN 'custom' ELSE CASE WHEN _e.refund_policy = 'custom' THEN '24h' ELSE _e.refund_policy END END;
  UPDATE public.events SET cancellation_policy = _txt, policy_config = CASE WHEN _mode = '' THEN NULL ELSE _config END, refund_policy = _rp WHERE id = _event;
END $$;
REVOKE ALL ON FUNCTION public.set_event_policy(uuid, jsonb, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_event_policy(uuid, jsonb, text) TO authenticated;

-- Row 64: event-specific, versioned waivers (additive to Terms/Privacy and the team waiver)
CREATE TABLE public.event_waivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  team_id uuid,
  kind text NOT NULL DEFAULT 'waiver' CHECK (kind IN ('waiver','release','health','safety','media')),
  title_en text NOT NULL DEFAULT '', title_es text NOT NULL DEFAULT '',
  body_en text NOT NULL DEFAULT '', body_es text NOT NULL DEFAULT '',
  file_path text, file_name text,
  required boolean NOT NULL DEFAULT true,
  position int NOT NULL DEFAULT 0,
  version int NOT NULL DEFAULT 1,
  content_sha256 text NOT NULL DEFAULT '',
  archived_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX event_waivers_event_idx ON public.event_waivers(event_id) WHERE archived_at IS NULL;

CREATE TABLE public.event_waiver_versions (
  waiver_id uuid NOT NULL REFERENCES public.event_waivers(id) ON DELETE CASCADE,
  version int NOT NULL,
  kind text NOT NULL, title_en text NOT NULL, title_es text NOT NULL, body_en text NOT NULL, body_es text NOT NULL,
  file_path text, file_name text, required boolean NOT NULL,
  content_sha256 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (waiver_id, version)
);

CREATE TABLE public.event_waiver_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  waiver_id uuid NOT NULL REFERENCES public.event_waivers(id) ON DELETE CASCADE,
  version int NOT NULL,
  content_sha256 text NOT NULL,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  rsvp_id uuid NOT NULL REFERENCES public.rsvps(id) ON DELETE CASCADE,
  user_id uuid,
  order_ref text,
  source text NOT NULL DEFAULT 'rsvp',
  accepted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (waiver_id, version, rsvp_id)
);
CREATE INDEX event_waiver_acceptances_event_idx ON public.event_waiver_acceptances(event_id);
CREATE INDEX event_waiver_acceptances_rsvp_idx ON public.event_waiver_acceptances(rsvp_id);

GRANT SELECT, INSERT, UPDATE ON public.event_waivers TO authenticated;
GRANT SELECT ON public.event_waiver_versions TO authenticated;
GRANT SELECT ON public.event_waiver_acceptances TO authenticated;
GRANT ALL ON public.event_waivers, public.event_waiver_versions, public.event_waiver_acceptances TO service_role;

ALTER TABLE public.event_waivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_waiver_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_waiver_acceptances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Event managers read waivers" ON public.event_waivers FOR SELECT TO authenticated USING (public.can_manage_event(event_id));
CREATE POLICY "Event managers add waivers" ON public.event_waivers FOR INSERT TO authenticated WITH CHECK (public.can_manage_event(event_id));
CREATE POLICY "Event managers edit waivers" ON public.event_waivers FOR UPDATE TO authenticated USING (public.can_manage_event(event_id)) WITH CHECK (public.can_manage_event(event_id));
CREATE POLICY "Event managers read waiver versions" ON public.event_waiver_versions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.event_waivers w WHERE w.id = waiver_id AND public.can_manage_event(w.event_id)));
CREATE POLICY "Managers or the attendee read acceptances" ON public.event_waiver_acceptances FOR SELECT TO authenticated
  USING (public.can_manage_event(event_id) OR (user_id IS NOT NULL AND user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.event_waiver_sha(w public.event_waivers) RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public, extensions AS $$
  SELECT encode(extensions.digest(concat_ws(chr(31), w.kind, w.title_en, w.title_es, w.body_en, w.body_es, coalesce(w.file_path,''), w.required::text), 'sha256'), 'hex') $$;

CREATE OR REPLACE FUNCTION public.event_waivers_before() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _sha text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.event_id <> OLD.event_id THEN RAISE EXCEPTION 'waiver_event_locked'; END IF;
  NEW.title_en := left(btrim(NEW.title_en), 120); NEW.title_es := left(btrim(NEW.title_es), 120);
  NEW.body_en := left(btrim(NEW.body_en), 12000); NEW.body_es := left(btrim(NEW.body_es), 12000);
  IF NEW.archived_at IS NULL THEN
    IF NEW.title_en = '' AND NEW.title_es = '' THEN RAISE EXCEPTION 'waiver_title_required'; END IF;
    IF NEW.body_en = '' AND NEW.body_es = '' AND NEW.file_path IS NULL THEN RAISE EXCEPTION 'waiver_content_required'; END IF;
  END IF;
  SELECT team_id INTO NEW.team_id FROM public.events WHERE id = NEW.event_id;
  _sha := public.event_waiver_sha(NEW);
  IF TG_OP = 'INSERT' THEN NEW.version := 1; NEW.created_by := auth.uid();
  ELSIF _sha <> OLD.content_sha256 THEN NEW.version := OLD.version + 1;
  ELSE NEW.version := OLD.version; END IF;
  NEW.content_sha256 := _sha; NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER event_waivers_before BEFORE INSERT OR UPDATE ON public.event_waivers FOR EACH ROW EXECUTE FUNCTION public.event_waivers_before();

CREATE OR REPLACE FUNCTION public.event_waivers_after() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.event_waiver_versions(waiver_id, version, kind, title_en, title_es, body_en, body_es, file_path, file_name, required, content_sha256)
  VALUES (NEW.id, NEW.version, NEW.kind, NEW.title_en, NEW.title_es, NEW.body_en, NEW.body_es, NEW.file_path, NEW.file_name, NEW.required, NEW.content_sha256)
  ON CONFLICT (waiver_id, version) DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER event_waivers_after AFTER INSERT OR UPDATE ON public.event_waivers FOR EACH ROW EXECUTE FUNCTION public.event_waivers_after();

CREATE OR REPLACE FUNCTION public.block_history_rewrite() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'history_immutable'; END $$;
CREATE TRIGGER event_waiver_versions_immutable BEFORE UPDATE ON public.event_waiver_versions FOR EACH ROW EXECUTE FUNCTION public.block_history_rewrite();
CREATE TRIGGER event_waiver_acceptances_immutable BEFORE UPDATE ON public.event_waiver_acceptances FOR EACH ROW EXECUTE FUNCTION public.block_history_rewrite();

-- Attendee-facing list for an event the caller can see (public, invite token, or member). Never returns file paths.
CREATE OR REPLACE FUNCTION public.event_waiver_list(_event uuid, _token text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e record;
BEGIN
  PERFORM public.unlock_invite(_event, _token);
  SELECT id, visibility, status INTO e FROM public.events WHERE id = _event;
  IF NOT FOUND OR NOT (((e.visibility = 'public' OR (e.visibility = 'invite' AND current_setting('gw.invite', true) = _event::text)) AND e.status IN ('published','cancelled'))
                       OR (auth.uid() IS NOT NULL AND public.can_view_event(_event))) THEN RETURN '[]'::jsonb; END IF;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id', w.id, 'kind', w.kind, 'title_en', w.title_en, 'title_es', w.title_es, 'body_en', w.body_en, 'body_es', w.body_es,
      'has_file', w.file_path IS NOT NULL, 'file_name', w.file_name, 'required', w.required, 'version', w.version) ORDER BY w.position, w.created_at)
    FROM public.event_waivers w WHERE w.event_id = _event AND w.archived_at IS NULL), '[]'::jsonb);
END $$;
GRANT EXECUTE ON FUNCTION public.event_waiver_list(uuid, text) TO anon, authenticated;

-- Validates an attendee's accepted set against the active versions. Raises waiver_required / waiver_stale.
CREATE OR REPLACE FUNCTION public.check_event_waivers(_event uuid, _accepted jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w record; a jsonb; _list jsonb := coalesce(_accepted, '[]'::jsonb);
BEGIN
  IF jsonb_typeof(_list) <> 'array' OR jsonb_array_length(_list) > 20 THEN RAISE EXCEPTION 'waiver_stale'; END IF;
  FOR a IN SELECT * FROM jsonb_array_elements(_list) LOOP
    IF NOT EXISTS (SELECT 1 FROM public.event_waivers x WHERE x.id = (a->>'id')::uuid AND x.event_id = _event AND x.archived_at IS NULL AND x.version = (a->>'version')::int) THEN
      RAISE EXCEPTION 'waiver_stale';
    END IF;
  END LOOP;
  FOR w IN SELECT id FROM public.event_waivers WHERE event_id = _event AND archived_at IS NULL AND required LOOP
    IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(_list) a2 WHERE (a2->>'id')::uuid = w.id) THEN RAISE EXCEPTION 'waiver_required'; END IF;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.check_event_waivers(uuid, jsonb) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_event_waivers(uuid, jsonb) TO service_role;

-- Server-owned acceptance insert: version/hash/time come from the database, never the client. Idempotent.
CREATE OR REPLACE FUNCTION public.store_event_waivers(_rsvp uuid, _accepted jsonb, _source text, _ref text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  SELECT id, event_id, user_id INTO r FROM public.rsvps WHERE id = _rsvp;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  INSERT INTO public.event_waiver_acceptances(waiver_id, version, content_sha256, event_id, rsvp_id, user_id, order_ref, source)
  SELECT v.waiver_id, v.version, v.content_sha256, r.event_id, r.id, r.user_id, nullif(left(coalesce(_ref,''),120),''), left(coalesce(_source,'rsvp'),20)
  FROM jsonb_array_elements(coalesce(_accepted,'[]'::jsonb)) a
  JOIN public.event_waiver_versions v ON v.waiver_id = (a->>'id')::uuid AND v.version = (a->>'version')::int
  JOIN public.event_waivers w ON w.id = v.waiver_id AND w.event_id = r.event_id
  ON CONFLICT (waiver_id, version, rsvp_id) DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.store_event_waivers(uuid, jsonb, text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.store_event_waivers(uuid, jsonb, text, text) TO service_role;

-- Guest and signed-in RSVP with event waivers: validate, register, record — one transaction.
CREATE OR REPLACE FUNCTION public.register_attendance_waivers(_event_id uuid, _first text, _last text, _phone text, _email text, _language text, _plus_ones integer, _status text, _sms boolean, _mail boolean, _waiver_name text, _answers jsonb, _token text, _terms_ok boolean, _updates_opt_in boolean, _tier_id text, _waivers jsonb)
RETURNS TABLE(code text, status text) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _code text; _st text; _rid uuid;
BEGIN
  PERFORM public.check_event_waivers(_event_id, _waivers);
  PERFORM set_config('gw.waivers_ok', _event_id::text, true);
  SELECT r.code, r.status INTO _code, _st FROM public.register_attendance(_event_id, _first, _last, _phone, _email, _language, _plus_ones, _status, _sms, _mail, _waiver_name, _answers, _token, _terms_ok, _updates_opt_in, _tier_id) r;
  PERFORM set_config('gw.waivers_ok', '', true);
  SELECT id INTO _rid FROM public.rsvps WHERE checkin_code = _code;
  PERFORM public.store_event_waivers(_rid, _waivers, 'rsvp', NULL);
  RETURN QUERY SELECT _code, _st;
END $$;
GRANT EXECUTE ON FUNCTION public.register_attendance_waivers(uuid, text, text, text, text, text, integer, text, boolean, boolean, text, jsonb, text, boolean, boolean, text, jsonb) TO anon, authenticated;

-- Required waivers block every other attendee RSVP path until accepted; hosts (walk-ins) and the payment webhook are exempt.
CREATE OR REPLACE FUNCTION public.guard_rsvp_event_waivers() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM 'going' AND TG_OP = 'UPDATE' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'going' THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.event_waivers w WHERE w.event_id = NEW.event_id AND w.archived_at IS NULL AND w.required) THEN RETURN NEW; END IF;
  IF coalesce(current_setting('gw.waivers_ok', true), '') = NEW.event_id::text THEN RETURN NEW; END IF;
  IF coalesce(auth.role(), '') = 'service_role' OR current_user IN ('postgres','supabase_admin') AND auth.uid() IS NULL AND coalesce(auth.role(),'') NOT IN ('anon','authenticated') THEN RETURN NEW; END IF;
  IF auth.uid() IS NOT NULL AND public.can_manage_event(NEW.event_id) THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND EXISTS (SELECT 1 FROM public.event_waiver_acceptances a WHERE a.rsvp_id = NEW.id) THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'waiver_required';
END $$;
CREATE TRIGGER rsvps_event_waivers BEFORE INSERT OR UPDATE OF status ON public.rsvps FOR EACH ROW EXECUTE FUNCTION public.guard_rsvp_event_waivers();

-- What this attendee accepted (by their private RSVP code): exact versioned text, no other attendee data.
CREATE OR REPLACE FUNCTION public.my_event_waiver_acceptances(_code text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('waiver_id', v.waiver_id, 'version', v.version, 'kind', v.kind, 'title_en', v.title_en, 'title_es', v.title_es,
      'body_en', v.body_en, 'body_es', v.body_es, 'has_file', v.file_path IS NOT NULL, 'file_name', v.file_name, 'required', v.required, 'accepted_at', a.accepted_at) ORDER BY a.accepted_at), '[]'::jsonb)
  FROM public.rsvps r JOIN public.event_waiver_acceptances a ON a.rsvp_id = r.id
  JOIN public.event_waiver_versions v ON v.waiver_id = a.waiver_id AND v.version = a.version
  WHERE length(coalesce(_code,'')) >= 6 AND r.checkin_code = _code $$;
GRANT EXECUTE ON FUNCTION public.my_event_waiver_acceptances(text) TO anon, authenticated;

-- Host consent status: attendee name + per-waiver accepted version/time. No contact details.
CREATE OR REPLACE FUNCTION public.event_waiver_status(_event uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.can_manage_event(_event) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  RETURN jsonb_build_object(
    'waivers', coalesce((SELECT jsonb_agg(jsonb_build_object('id', w.id, 'title_en', w.title_en, 'title_es', w.title_es, 'required', w.required, 'version', w.version) ORDER BY w.position, w.created_at)
      FROM public.event_waivers w WHERE w.event_id = _event AND w.archived_at IS NULL), '[]'::jsonb),
    'attendees', coalesce((SELECT jsonb_agg(jsonb_build_object('rsvp_id', r.id, 'name', coalesce(nullif(trim(r.guest_name),''), p.full_name, ''), 'status', r.status,
        'accepted', coalesce((SELECT jsonb_object_agg(a.waiver_id::text, jsonb_build_object('version', a.version, 'at', a.accepted_at))
          FROM (SELECT DISTINCT ON (waiver_id) waiver_id, version, accepted_at FROM public.event_waiver_acceptances WHERE rsvp_id = r.id ORDER BY waiver_id, version DESC) a), '{}'::jsonb)) ORDER BY r.created_at)
      FROM public.rsvps r LEFT JOIN public.profiles p ON p.id = r.user_id
      WHERE r.event_id = _event AND r.merged_into_rsvp_id IS NULL AND r.status IN ('going','waitlist','maybe')), '[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.event_waiver_status(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.event_waiver_status(uuid) TO authenticated;