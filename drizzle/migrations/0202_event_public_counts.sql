ALTER TABLE public.events ADD COLUMN IF NOT EXISTS public_counts text;
UPDATE public.events SET public_counts = 'both' WHERE public_counts IS NULL;
ALTER TABLE public.events ALTER COLUMN public_counts SET DEFAULT 'none', ALTER COLUMN public_counts SET NOT NULL;
ALTER TABLE public.events ADD CONSTRAINT events_public_counts_check CHECK (public_counts IN ('none','registered','remaining','both'));

CREATE OR REPLACE FUNCTION public.mask_public_counts(_j jsonb, _mode text, _cap int, _manager boolean)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE _going int := coalesce((_j->>'going')::int, 0); _show_reg boolean; _show_left boolean; _tiers jsonb;
BEGIN
  IF _j IS NULL THEN RETURN NULL; END IF;
  _show_reg := _manager OR _mode IN ('registered','both');
  _show_left := _manager OR _mode IN ('remaining','both');
  _j := _j || jsonb_build_object('public_counts', _mode, 'is_full', _cap IS NOT NULL AND _going >= _cap,
    'spots_left', CASE WHEN _show_left AND _cap IS NOT NULL THEN greatest(_cap - _going, 0) END);
  IF NOT _show_reg THEN _j := _j || jsonb_build_object('going', NULL, 'initials', '[]'::jsonb); END IF;
  IF NOT _show_left AND jsonb_typeof(_j->'ticket_tiers') = 'array' THEN
    SELECT coalesce(jsonb_agg((t - 'sold') || jsonb_build_object('sold_out', (t->>'quantity') IS NOT NULL AND coalesce((t->>'sold')::int,0) >= (t->>'quantity')::int)), '[]'::jsonb)
      INTO _tiers FROM jsonb_array_elements(_j->'ticket_tiers') t;
    _j := _j || jsonb_build_object('ticket_tiers', _tiers);
  END IF;
  RETURN _j;
END $$;

ALTER FUNCTION public.get_public_event(uuid) RENAME TO get_public_event_unmasked;
REVOKE ALL ON FUNCTION public.get_public_event_unmasked(uuid) FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.get_public_event(_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _j jsonb; _mode text; _cap int;
BEGIN
  _j := public.get_public_event_unmasked(_id);
  IF _j IS NULL THEN RETURN NULL; END IF;
  SELECT public_counts, capacity INTO _mode, _cap FROM public.events WHERE id = _id;
  RETURN public.mask_public_counts(_j, _mode, _cap, auth.uid() IS NOT NULL AND public.can_checkin_event(_id));
END $$;
GRANT EXECUTE ON FUNCTION public.get_public_event(uuid) TO anon, authenticated;

ALTER FUNCTION public.list_public_gatherings(boolean, integer, integer) RENAME TO list_public_gatherings_unmasked;
REVOKE ALL ON FUNCTION public.list_public_gatherings_unmasked(boolean, integer, integer) FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.list_public_gatherings(_include_samples boolean DEFAULT false, _days integer DEFAULT 14, _limit integer DEFAULT 48)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _j jsonb; _real jsonb;
BEGIN
  _j := public.list_public_gatherings_unmasked(_include_samples, _days, _limit);
  SELECT coalesce(jsonb_agg(public.mask_public_counts(x, e.public_counts, e.capacity, false) ORDER BY o), '[]'::jsonb) INTO _real
    FROM jsonb_array_elements(_j->'real') WITH ORDINALITY a(x, o) JOIN public.events e ON e.id = (x->>'id')::uuid;
  RETURN _j || jsonb_build_object('real', _real);
END $$;
GRANT EXECUTE ON FUNCTION public.list_public_gatherings(boolean, integer, integer) TO anon, authenticated;

DROP POLICY IF EXISTS "Read counts of visible gatherings" ON public.event_live_counts;
CREATE POLICY "Read counts of visible gatherings" ON public.event_live_counts FOR SELECT TO anon, authenticated
  USING (public.can_view_event(event_id) AND (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.public_counts IN ('registered','both')) OR (auth.uid() IS NOT NULL AND public.can_checkin_event(event_id))));

CREATE OR REPLACE FUNCTION public.set_event_public_counts(_event uuid, _mode text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.can_manage_event(_event) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  IF _mode NOT IN ('none','registered','remaining','both') THEN RAISE EXCEPTION 'invalid_mode'; END IF;
  UPDATE public.events SET public_counts = _mode WHERE id = _event;
END $$;
REVOKE ALL ON FUNCTION public.set_event_public_counts(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_event_public_counts(uuid, text) TO authenticated;