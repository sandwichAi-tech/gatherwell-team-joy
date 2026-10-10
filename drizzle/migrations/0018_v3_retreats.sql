ALTER TABLE public.events ADD COLUMN IF NOT EXISTS retreat jsonb;

-- Hosts and co-hosts save retreat details; validates shape and runs the claims check over every text field.
CREATE OR REPLACE FUNCTION public.set_event_retreat(_event uuid, _retreat jsonb, _ends_at timestamptz) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e events; _txt text; _pay jsonb; _mode text; _due date; _n int; _dep int;
BEGIN
  IF NOT public.can_manage_event(_event) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO e FROM events WHERE id = _event;
  IF _retreat IS NULL THEN UPDATE events SET retreat = NULL WHERE id = _event; RETURN; END IF;
  IF jsonb_typeof(_retreat) <> 'object' OR length(_retreat::text) > 40000 THEN RAISE EXCEPTION 'invalid_retreat'; END IF;
  IF _ends_at IS NULL OR _ends_at <= e.starts_at OR _ends_at > e.starts_at + interval '31 days' THEN RAISE EXCEPTION 'invalid_retreat_dates'; END IF;
  IF jsonb_array_length(coalesce(_retreat->'itinerary','[]')) > 31 OR jsonb_array_length(coalesce(_retreat->'faq','[]')) > 12
     OR jsonb_array_length(coalesce(_retreat->'checklist','[]')) > 20 OR jsonb_array_length(coalesce(_retreat->'gallery','[]')) > 6 THEN RAISE EXCEPTION 'invalid_retreat'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements_text(coalesce(_retreat->'gallery','[]')) g WHERE g NOT LIKE e.host_id::text || '/%' AND g NOT LIKE auth.uid()::text || '/%') THEN RAISE EXCEPTION 'invalid_retreat'; END IF;
  SELECT string_agg(v, ' ') INTO _txt FROM jsonb_path_query(_retreat - 'gallery' - 'payment', 'strict $.**') j(x), LATERAL (SELECT x #>> '{}' AS v) s WHERE jsonb_typeof(x) = 'string';
  IF _txt IS NOT NULL AND public.has_blocked_claim(_txt) THEN RAISE EXCEPTION 'blocked_claim'; END IF;
  _pay := coalesce(_retreat->'payment', '{"mode":"full"}'::jsonb); _mode := coalesce(_pay->>'mode','full');
  IF _mode NOT IN ('full','deposit','plan') THEN RAISE EXCEPTION 'invalid_payment'; END IF;
  IF _mode <> 'full' THEN
    _due := (_pay->>'balance_due')::date;
    IF _due IS NULL OR _due < current_date OR _due > e.starts_at::date THEN RAISE EXCEPTION 'invalid_balance_due'; END IF;
    IF coalesce(e.price_cents, 0) <= 0 THEN RAISE EXCEPTION 'payment_needs_price'; END IF;
  END IF;
  IF _mode = 'deposit' THEN _dep := (_pay->>'deposit_cents')::int; IF _dep IS NULL OR _dep < 100 OR _dep >= e.price_cents THEN RAISE EXCEPTION 'invalid_deposit'; END IF; END IF;
  IF _mode = 'plan' THEN _n := (_pay->>'installments')::int; IF _n IS NULL OR _n NOT BETWEEN 2 AND 4 THEN RAISE EXCEPTION 'invalid_installments'; END IF; END IF;
  UPDATE events SET retreat = _retreat, ends_at = _ends_at, requires_waiver = true WHERE id = _event;
END $$;
REVOKE ALL ON FUNCTION public.set_event_retreat(uuid,jsonb,timestamptz) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_event_retreat(uuid,jsonb,timestamptz) TO authenticated;

-- Attendee pre-trip checklist, acted on through the private pass code
CREATE TABLE public.retreat_checks (
  rsvp_id uuid NOT NULL REFERENCES public.rsvps(id) ON DELETE CASCADE,
  item smallint NOT NULL CHECK (item BETWEEN 0 AND 19),
  checked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (rsvp_id, item)
);
GRANT ALL ON public.retreat_checks TO service_role;
ALTER TABLE public.retreat_checks ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.retreat_checklist(_code text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('items', coalesce(e.retreat->'checklist','[]'::jsonb),
    'done', coalesce((SELECT jsonb_agg(item ORDER BY item) FROM retreat_checks WHERE rsvp_id = r.id), '[]'::jsonb),
    'payment', e.retreat->'payment', 'price_cents', e.price_cents, 'created_at', r.created_at)
  FROM rsvps r JOIN events e ON e.id = r.event_id
  WHERE r.checkin_code = upper(trim(_code)) AND e.retreat IS NOT NULL AND r.status <> 'cancelled'
$$;
GRANT EXECUTE ON FUNCTION public.retreat_checklist(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.toggle_retreat_item(_code text, _item int, _on boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _r uuid; _n int;
BEGIN
  SELECT r.id, jsonb_array_length(coalesce(e.retreat->'checklist','[]')) INTO _r, _n FROM rsvps r JOIN events e ON e.id = r.event_id
    WHERE r.checkin_code = upper(trim(_code)) AND e.retreat IS NOT NULL AND r.status <> 'cancelled';
  IF _r IS NULL OR _item < 0 OR _item >= _n THEN RAISE EXCEPTION 'not_found'; END IF;
  IF _on THEN INSERT INTO retreat_checks(rsvp_id, item) VALUES (_r, _item) ON CONFLICT DO NOTHING;
  ELSE DELETE FROM retreat_checks WHERE rsvp_id = _r AND item = _item; END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.toggle_retreat_item(text,int,boolean) TO anon, authenticated;

-- Balance and installment reminders through the outbox, scheduled when someone signs up
CREATE OR REPLACE FUNCTION public.retreat_payment_reminders() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e events; _mode text; _due timestamptz; _n int; _i int; _at timestamptz; _email text; _amount int;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
    UPDATE notification_outbox SET status = 'skipped', skip_reason = 'rsvp_cancelled' WHERE rsvp_id = NEW.id AND template = 'retreat_balance' AND status = 'pending';
    RETURN NEW;
  END IF;
  IF TG_OP <> 'INSERT' OR NEW.status <> 'going' THEN RETURN NEW; END IF;
  SELECT * INTO e FROM events WHERE id = NEW.event_id;
  _mode := coalesce(e.retreat->'payment'->>'mode','full');
  IF e.retreat IS NULL OR _mode = 'full' OR coalesce(e.price_cents,0) <= 0 THEN RETURN NEW; END IF;
  _due := ((e.retreat->'payment'->>'balance_due')::date)::timestamptz + interval '9 hours';
  _email := NEW.guest_email;
  IF _email IS NULL AND NEW.user_id IS NOT NULL THEN SELECT email INTO _email FROM auth.users WHERE id = NEW.user_id; END IF;
  IF nullif(trim(coalesce(_email,'')),'') IS NULL THEN RETURN NEW; END IF;
  IF _mode = 'deposit' THEN
    _amount := e.price_cents - (e.retreat->'payment'->>'deposit_cents')::int;
    PERFORM public.enqueue_message('email', _email, NEW.language, 'retreat_balance', 'transactional',
      jsonb_build_object('name', split_part(coalesce(NEW.guest_name,''),' ',1), 'title', e.title, 'starts_at', e.starts_at, 'timezone', e.timezone, 'event_id', e.id, 'code', NEW.checkin_code, 'amount_cents', _amount, 'due', _due),
      greatest(now(), _due - interval '7 days'), e.id, NEW.id, NEW.user_id);
  ELSE
    _n := (e.retreat->'payment'->>'installments')::int;
    _amount := ceil(e.price_cents::numeric / _n)::int;
    FOR _i IN 2.._n LOOP
      _at := now() + (_due - now()) * (_i - 1) / (_n - 1);
      PERFORM public.enqueue_message('email', _email, NEW.language, 'retreat_balance', 'transactional',
        jsonb_build_object('name', split_part(coalesce(NEW.guest_name,''),' ',1), 'title', e.title, 'starts_at', e.starts_at, 'timezone', e.timezone, 'event_id', e.id, 'code', NEW.checkin_code, 'amount_cents', _amount, 'due', _at, 'installment', _i, 'installments', _n),
        greatest(now(), _at - interval '3 days'), e.id, NEW.id, NEW.user_id);
    END LOOP;
  END IF;
  RETURN NEW;
EXCEPTION WHEN others THEN RETURN NEW;
END $$;
CREATE TRIGGER rsvps_retreat_reminders AFTER INSERT OR UPDATE OF status ON public.rsvps FOR EACH ROW EXECUTE FUNCTION public.retreat_payment_reminders();