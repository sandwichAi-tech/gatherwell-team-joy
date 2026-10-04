CREATE OR REPLACE FUNCTION public.set_new_gathering_coords() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _p jsonb := nullif(current_setting('gatherwell.coords', true), '')::jsonb;
BEGIN
  IF _p IS NOT NULL AND NEW.lat IS NULL THEN
    NEW.lat := nullif(_p->>'lat','')::double precision; NEW.lng := nullif(_p->>'lng','')::double precision;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER set_new_gathering_coords BEFORE INSERT ON public.events FOR EACH ROW EXECUTE FUNCTION public.set_new_gathering_coords();

CREATE OR REPLACE FUNCTION public.create_gathering_at(_team uuid, _p jsonb, _publish boolean, _weekly boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid;
BEGIN
  IF nullif(_p->>'lat','') IS NOT NULL AND nullif(_p->>'lng','') IS NOT NULL
     AND (_p->>'lat')::double precision BETWEEN -90 AND 90 AND (_p->>'lng')::double precision BETWEEN -180 AND 180 THEN
    PERFORM set_config('gatherwell.coords', jsonb_build_object('lat', _p->>'lat', 'lng', _p->>'lng')::text, true);
  END IF;
  _id := public.create_gathering(_team, _p, _publish, _weekly);
  PERFORM set_config('gatherwell.coords', '', true);
  RETURN _id;
END; $$;
REVOKE EXECUTE ON FUNCTION public.create_gathering_at(uuid, jsonb, boolean, boolean), public.set_new_gathering_coords() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_gathering_at(uuid, jsonb, boolean, boolean) TO authenticated;