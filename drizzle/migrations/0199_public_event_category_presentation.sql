DO $migration$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef(oid) INTO definition FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='get_public_event' AND pronargs=1;
 IF position('''category'', e.category' in definition)=0 THEN
  definition := replace(definition, '''cover_url'', e.cover_url', '''category'', e.category, ''cover_url'', e.cover_url');
  EXECUTE definition;
 END IF;
END $migration$;