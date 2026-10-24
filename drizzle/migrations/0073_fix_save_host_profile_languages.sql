
-- host_languages is NOT NULL: keep an empty array instead of nulling it
CREATE OR REPLACE FUNCTION public.save_host_profile(
  _org text, _categories text[], _languages text[], _accessibility text,
  _links jsonb, _host_public boolean, _city_public boolean
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _link jsonb; _url text; _host text;
  _allowed text[] := ARRAY['instagram.com','www.instagram.com','facebook.com','www.facebook.com','youtube.com','www.youtube.com','tiktok.com','www.tiktok.com','linkedin.com','www.linkedin.com','x.com','twitter.com','www.twitter.com','linktr.ee'];
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF _org IS NOT NULL AND length(_org) > 120 THEN RAISE EXCEPTION 'too_long'; END IF;
  IF _accessibility IS NOT NULL AND length(_accessibility) > 500 THEN RAISE EXCEPTION 'too_long'; END IF;
  IF _categories IS NOT NULL AND (array_length(_categories, 1) > 8 OR EXISTS (SELECT 1 FROM unnest(_categories) c WHERE length(c) > 40)) THEN RAISE EXCEPTION 'too_long'; END IF;
  IF _languages IS NOT NULL AND EXISTS (SELECT 1 FROM unnest(_languages) l WHERE l NOT IN ('en','es')) THEN RAISE EXCEPTION 'invalid_language'; END IF;
  IF _links IS NOT NULL AND jsonb_typeof(_links) = 'array' THEN
    IF jsonb_array_length(_links) > 6 THEN RAISE EXCEPTION 'too_many_links'; END IF;
    FOR _link IN SELECT * FROM jsonb_array_elements(_links) LOOP
      _url := _link->>'url';
      IF _url IS NULL OR _url !~ '^https://' OR length(_url) > 300 THEN RAISE EXCEPTION 'invalid_link'; END IF;
      _host := lower(split_part(substring(_url from 9), '/', 1));
      IF coalesce(_link->>'kind','website') = 'social' AND NOT (_host = ANY(_allowed)) THEN RAISE EXCEPTION 'link_not_allowed'; END IF;
      IF length(coalesce(_link->>'label','')) > 40 THEN RAISE EXCEPTION 'too_long'; END IF;
    END LOOP;
  END IF;
  UPDATE profiles SET
    host_org = nullif(trim(_org), ''),
    host_categories = nullif(_categories, '{}'),
    host_languages = coalesce(_languages, '{}'),
    host_accessibility = nullif(trim(_accessibility), ''),
    host_links = coalesce(_links, '[]'::jsonb),
    host_public = coalesce(_host_public, true),
    city_public = coalesce(_city_public, false)
  WHERE id = auth.uid();
END $$;
GRANT EXECUTE ON FUNCTION public.save_host_profile(text, text[], text[], text, jsonb, boolean, boolean) TO authenticated;
