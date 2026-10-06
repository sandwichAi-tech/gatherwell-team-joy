ALTER TABLE public.events ADD COLUMN IF NOT EXISTS rsvp_questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS require_approval boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS invite_token text NOT NULL DEFAULT substr(replace(gen_random_uuid()::text,'-',''),1,24);
ALTER TABLE public.events DROP CONSTRAINT events_visibility_check;
ALTER TABLE public.events ADD CONSTRAINT events_visibility_check CHECK (visibility = ANY (ARRAY['public','team','invite']));
ALTER TABLE public.rsvps DROP CONSTRAINT rsvps_status_check;
ALTER TABLE public.rsvps ADD CONSTRAINT rsvps_status_check CHECK (status = ANY (ARRAY['going','maybe','waitlist','cancelled','requested','declined']));

CREATE OR REPLACE FUNCTION public.validate_rsvp_questions() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE q jsonb; o jsonb;
BEGIN
  IF jsonb_typeof(NEW.rsvp_questions) <> 'array' OR jsonb_array_length(NEW.rsvp_questions) > 5 THEN RAISE EXCEPTION 'too_many_questions'; END IF;
  FOR q IN SELECT * FROM jsonb_array_elements(NEW.rsvp_questions) LOOP
    IF coalesce(q->>'kind','') NOT IN ('text','choice','yesno') OR length(trim(coalesce(q->>'label',''))) NOT BETWEEN 1 AND 140 OR length(coalesce(q->>'id','')) NOT BETWEEN 1 AND 40 THEN RAISE EXCEPTION 'invalid_question'; END IF;
    IF q->>'kind' = 'choice' THEN
      IF jsonb_typeof(q->'options') <> 'array' OR jsonb_array_length(q->'options') NOT BETWEEN 2 AND 6 THEN RAISE EXCEPTION 'invalid_question'; END IF;
      FOR o IN SELECT * FROM jsonb_array_elements(q->'options') LOOP
        IF jsonb_typeof(o) <> 'string' OR length(trim(o #>> '{}')) NOT BETWEEN 1 AND 60 THEN RAISE EXCEPTION 'invalid_question'; END IF;
      END LOOP;
    END IF;
  END LOOP;
  IF NEW.require_approval AND NEW.price_cents IS NOT NULL THEN RAISE EXCEPTION 'approval_paid'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER events_validate_questions BEFORE INSERT OR UPDATE OF rsvp_questions, require_approval, price_cents ON public.events FOR EACH ROW EXECUTE FUNCTION public.validate_rsvp_questions();

CREATE TABLE public.rsvp_answers (
  rsvp_id uuid PRIMARY KEY REFERENCES public.rsvps(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.rsvp_answers TO authenticated;
GRANT ALL ON public.rsvp_answers TO service_role;
ALTER TABLE public.rsvp_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Hosts, co-hosts and leaders read answers" ON public.rsvp_answers FOR SELECT TO authenticated USING (public.can_manage_event(event_id));
CREATE INDEX rsvp_answers_event_idx ON public.rsvp_answers(event_id);

-- Patch existing functions in place
DO $do$
DECLARE d text; n text;
BEGIN
  d := pg_get_functiondef('public.rsvp_event(uuid,text,text,text,text,text,integer,text,boolean,boolean)'::regprocedure);
  n := replace(d, 'OR e.visibility = ''public'' OR (_uid', 'OR e.visibility = ''public'' OR (e.visibility = ''invite'' AND current_setting(''gw.invite'', true) = _event_id::text) OR (_uid');
  n := replace(n, '  IF _ex_id IS NOT NULL THEN
    UPDATE', '  IF e.require_approval AND NOT _svc AND _st IN (''going'',''waitlist'') AND NOT (_uid IS NOT NULL AND public.can_manage_event(_event_id))
     AND coalesce(_ex_status,'''') NOT IN (''going'',''waitlist'') THEN _st := ''requested''; _plan_hit := false; END IF;
  IF _ex_id IS NOT NULL THEN
    UPDATE');
  n := replace(n, '  PERFORM public.queue_rsvp_notices(_id, CASE', '  IF _st = ''requested'' THEN PERFORM public.notify_rsvp_request(_id); ELSE PERFORM public.queue_rsvp_notices(_id, CASE');
  n := replace(n, 'ELSE ''rsvp_confirmed'' END);', 'ELSE ''rsvp_confirmed'' END); END IF;');
  IF n = d OR position('notify_rsvp_request' in n) = 0 OR position('gw.invite' in n) = 0 OR position('_st := ''requested''' in n) = 0 THEN RAISE EXCEPTION 'rsvp_event patch failed'; END IF;
  -- defer execution until notify_rsvp_request exists
  PERFORM set_config('gw.patch_rsvp', n, true);

  d := pg_get_functiondef('public.get_public_event(uuid)'::regprocedure);
  n := replace(d, 'AND (visibility = ''public'' OR public.is_team_member', 'AND (visibility = ''public'' OR (visibility = ''invite'' AND current_setting(''gw.invite'', true) = _id::text) OR public.is_team_member');
  n := replace(n, '''my_code'', _mine);', '''my_code'', _mine, ''questions'', e.rsvp_questions, ''require_approval'', e.require_approval, ''visibility'', e.visibility);');
  IF position('gw.invite' in n) = 0 OR position('require_approval' in n) = 0 THEN RAISE EXCEPTION 'get_public_event patch failed'; END IF;
  EXECUTE n;

  d := pg_get_functiondef('public.event_waiver(uuid)'::regprocedure);
  n := replace(d, '(e.visibility = ''public'' AND', '((e.visibility = ''public'' OR (e.visibility = ''invite'' AND current_setting(''gw.invite'', true) = _event::text)) AND');
  IF n = d THEN RAISE EXCEPTION 'event_waiver patch failed'; END IF;
  EXECUTE n;

  d := pg_get_functiondef('public.update_rsvp_by_code(text,text,integer)'::regprocedure);
  n := replace(d, '  SELECT * INTO e FROM public.events WHERE id = r.event_id FOR UPDATE;', '  IF r.status IN (''requested'',''declined'') THEN RETURN r.status; END IF;
  SELECT * INTO e FROM public.events WHERE id = r.event_id FOR UPDATE;');
  IF n = d THEN RAISE EXCEPTION 'update_rsvp patch failed'; END IF;
  EXECUTE n;
END $do$;

CREATE OR REPLACE FUNCTION public.notify_rsvp_request(_rsvp uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.rsvps; e public.events; _p jsonb;
BEGIN
  SELECT * INTO r FROM rsvps WHERE id = _rsvp; IF r.id IS NULL THEN RETURN; END IF;
  SELECT * INTO e FROM events WHERE id = r.event_id;
  _p := public.event_payload(r.event_id, r.id) || jsonb_build_object('guest', r.guest_name);
  PERFORM enqueue_message('push', e.host_id::text, coalesce((SELECT language FROM profiles WHERE id = e.host_id), 'en'), 'rsvp_request', 'transactional', _p, now(), e.id, r.id, e.host_id);
  IF r.email_opt_in THEN PERFORM enqueue_message('email', r.guest_email, r.language, 'rsvp_requested', 'transactional', public.event_payload(r.event_id, r.id), now(), r.event_id, r.id, r.user_id); END IF;
END $$;
REVOKE ALL ON FUNCTION public.notify_rsvp_request(uuid) FROM public, anon, authenticated;

DO $do$ BEGIN EXECUTE current_setting('gw.patch_rsvp'); END $do$;

CREATE OR REPLACE FUNCTION public.unlock_invite(_event uuid, _token text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _token IS NOT NULL AND length(_token) >= 16 AND EXISTS (SELECT 1 FROM events WHERE id = _event AND visibility = 'invite' AND invite_token = _token) THEN
    PERFORM set_config('gw.invite', _event::text, true);
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.unlock_invite(uuid, text) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_public_event_k(_id uuid, _token text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM unlock_invite(_id, _token); RETURN get_public_event(_id); END $$;
CREATE OR REPLACE FUNCTION public.event_waiver_k(_event uuid, _token text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM unlock_invite(_event, _token); RETURN event_waiver(_event); END $$;

CREATE OR REPLACE FUNCTION public.rsvp_event_full(_event_id uuid, _first text, _last text, _phone text, _email text, _language text, _plus_ones integer, _status text, _sms boolean, _mail boolean, _waiver_name text, _answers jsonb, _token text)
RETURNS TABLE(code text, status text) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _qs jsonb; q jsonb; _clean jsonb := '{}'::jsonb; v text; _code text; _st text; _rid uuid;
BEGIN
  PERFORM unlock_invite(_event_id, _token);
  SELECT rsvp_questions INTO _qs FROM events WHERE id = _event_id;
  FOR q IN SELECT * FROM jsonb_array_elements(coalesce(_qs,'[]'::jsonb)) LOOP
    v := left(trim(coalesce(_answers->>(q->>'id'), '')), 500);
    IF v <> '' THEN
      IF q->>'kind' = 'yesno' AND v NOT IN ('yes','no') THEN RAISE EXCEPTION 'answers_required'; END IF;
      IF q->>'kind' = 'choice' AND NOT (q->'options' ? v) THEN RAISE EXCEPTION 'answers_required'; END IF;
      _clean := _clean || jsonb_build_object(q->>'id', v);
    ELSIF coalesce((q->>'required')::boolean, false) THEN RAISE EXCEPTION 'answers_required';
    END IF;
  END LOOP;
  SELECT r.code, r.status INTO _code, _st FROM rsvp_event_waiver(_event_id, _first, _last, _phone, _email, _language, _plus_ones, _status, _sms, _mail, _waiver_name) r;
  IF _clean <> '{}'::jsonb THEN
    SELECT id INTO _rid FROM rsvps WHERE checkin_code = _code;
    INSERT INTO rsvp_answers (rsvp_id, event_id, answers) VALUES (_rid, _event_id, _clean)
      ON CONFLICT (rsvp_id) DO UPDATE SET answers = EXCLUDED.answers, updated_at = now();
  END IF;
  RETURN QUERY SELECT _code, _st;
END $$;

CREATE OR REPLACE FUNCTION public.decide_rsvp(_rsvp uuid, _approve boolean) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.rsvps; e public.events; _st text; _cap int;
BEGIN
  SELECT * INTO r FROM rsvps WHERE id = _rsvp;
  IF r.id IS NULL OR NOT can_manage_event(r.event_id) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  IF r.status <> 'requested' THEN RAISE EXCEPTION 'not_requested'; END IF;
  SELECT * INTO e FROM events WHERE id = r.event_id FOR UPDATE;
  IF _approve THEN
    _cap := guest_cap(e.id);
    _st := CASE WHEN _cap IS NOT NULL AND event_seats_used(e.id) + 1 + r.plus_ones > _cap THEN 'waitlist' ELSE 'going' END;
  ELSE _st := 'declined'; END IF;
  UPDATE rsvps SET status = _st WHERE id = r.id;
  PERFORM queue_rsvp_notices(r.id, CASE _st WHEN 'going' THEN 'rsvp_confirmed' WHEN 'waitlist' THEN 'rsvp_waitlisted' ELSE 'rsvp_declined' END);
  RETURN _st;
END $$;

CREATE OR REPLACE FUNCTION public.reset_invite_link(_event uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _t text := substr(replace(gen_random_uuid()::text,'-',''),1,24);
BEGIN
  IF NOT can_manage_event(_event) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  UPDATE events SET invite_token = _t WHERE id = _event; RETURN _t;
END $$;

REVOKE ALL ON FUNCTION public.get_public_event_k(uuid,text), public.event_waiver_k(uuid,text), public.rsvp_event_full(uuid,text,text,text,text,text,integer,text,boolean,boolean,text,jsonb,text), public.decide_rsvp(uuid,boolean), public.reset_invite_link(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_public_event_k(uuid,text), public.event_waiver_k(uuid,text), public.rsvp_event_full(uuid,text,text,text,text,text,integer,text,boolean,boolean,text,jsonb,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.decide_rsvp(uuid,boolean), public.reset_invite_link(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.validate_rsvp_questions() FROM public, anon, authenticated;