CREATE OR REPLACE FUNCTION public.retreat_checklist(_code text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('items', coalesce(e.retreat->'checklist','[]'::jsonb),
    'done', coalesce((SELECT jsonb_agg(item ORDER BY item) FROM retreat_checks WHERE rsvp_id = r.id), '[]'::jsonb),
    'payment', e.retreat->'payment', 'price_cents', e.price_cents, 'created_at', r.created_at)
  FROM rsvps r JOIN events e ON e.id = r.event_id
  WHERE r.checkin_code = _code AND length(_code) >= 16 AND e.retreat IS NOT NULL AND r.status <> 'cancelled'
$$;

CREATE OR REPLACE FUNCTION public.toggle_retreat_item(_code text, _item int, _on boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _r uuid; _n int;
BEGIN
  SELECT r.id, jsonb_array_length(coalesce(e.retreat->'checklist','[]')) INTO _r, _n FROM rsvps r JOIN events e ON e.id = r.event_id
    WHERE r.checkin_code = _code AND length(_code) >= 16 AND e.retreat IS NOT NULL AND r.status <> 'cancelled';
  IF _r IS NULL OR _item < 0 OR _item >= _n THEN RAISE EXCEPTION 'not_found'; END IF;
  IF _on THEN INSERT INTO retreat_checks(rsvp_id, item) VALUES (_r, _item) ON CONFLICT DO NOTHING;
  ELSE DELETE FROM retreat_checks WHERE rsvp_id = _r AND item = _item; END IF;
END $$;