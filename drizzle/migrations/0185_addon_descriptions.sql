DO $m$ DECLARE d text; BEGIN
 SELECT pg_get_functiondef('public.update_event_details(uuid,jsonb)'::regprocedure) INTO d;
 d:=replace(d,'''image_path'', nullif(t->>''image_path'','''')));','''image_path'', nullif(t->>''image_path'',''''), ''description_en'', nullif(trim(coalesce(t->>''description_en'','''')),''''), ''description_es'', nullif(trim(coalesce(t->>''description_es'','''')),'''')));');
 IF d NOT LIKE '%''description_en''%' THEN RAISE EXCEPTION 'event_addon_pattern_missing'; END IF; EXECUTE d;
 SELECT pg_get_functiondef('public.get_public_challenge(uuid)'::regprocedure) INTO d;
 d:=replace(d,'''description'',a->>''description'',''price_cents''','''description'',a->>''description'',''description_en'',a->>''description_en'',''description_es'',a->>''description_es'',''price_cents''');
 IF d NOT LIKE '%''description_en'',a->>%' THEN RAISE EXCEPTION 'public_challenge_pattern_missing'; END IF; EXECUTE d;
 SELECT pg_get_functiondef('public.challenge_order_receipts(uuid)'::regprocedure) INTO d;
 d:=replace(d,'''name'',i.description,','''name'',i.description,''description_en'',(SELECT a->>''description_en'' FROM challenges c2 CROSS JOIN LATERAL jsonb_array_elements(c2.addons) a WHERE c2.id=o.challenge_id AND a->>''id''=i.addon_key LIMIT 1),''description_es'',(SELECT coalesce(nullif(a->>''description_es'',''''),nullif(a->>''description'','''')) FROM challenges c2 CROSS JOIN LATERAL jsonb_array_elements(c2.addons) a WHERE c2.id=o.challenge_id AND a->>''id''=i.addon_key LIMIT 1),');
 IF d NOT LIKE '%description_en%' THEN RAISE EXCEPTION 'receipt_pattern_missing'; END IF; EXECUTE d;
 SELECT pg_get_functiondef('public.export_library_source(text,uuid)'::regprocedure) INTO d;
 d:=replace(d,'''name'',a->>''name'',''price_cents'',a->''price_cents''','''name'',a->>''name'',''description_en'',a->>''description_en'',''description_es'',a->>''description_es'',''price_cents'',a->''price_cents''');
 IF d NOT LIKE '%''description_en'',a->>''description_en''%' THEN RAISE EXCEPTION 'library_pattern_missing'; END IF; EXECUTE d;
END $m$;

CREATE OR REPLACE FUNCTION public.guard_addon_descriptions() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE a jsonb; BEGIN
 IF jsonb_typeof(NEW.addons)='array' THEN FOR a IN SELECT * FROM jsonb_array_elements(NEW.addons) LOOP
  IF length(coalesce(a->>'description_en',''))>300 OR length(coalesce(a->>'description_es',''))>300 THEN RAISE EXCEPTION 'invalid_addons'; END IF;
 END LOOP; END IF; RETURN NEW; END $$;
DROP TRIGGER IF EXISTS events_addon_descriptions ON public.events;
CREATE TRIGGER events_addon_descriptions BEFORE INSERT OR UPDATE OF addons ON public.events FOR EACH ROW EXECUTE FUNCTION public.guard_addon_descriptions();
DROP TRIGGER IF EXISTS challenges_addon_descriptions ON public.challenges;
CREATE TRIGGER challenges_addon_descriptions BEFORE INSERT OR UPDATE OF addons ON public.challenges FOR EACH ROW EXECUTE FUNCTION public.guard_addon_descriptions();
COMMENT ON COLUMN public.events.addons IS 'Add-ons: id, name, price_cents, optional image_path and optional description_en/description_es (max 300 each).';