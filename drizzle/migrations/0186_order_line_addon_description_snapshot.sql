ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS description_en text, ADD COLUMN IF NOT EXISTS description_es text;
COMMENT ON COLUMN public.order_items.description_en IS 'Purchase-time snapshot of add-on description (English); null for historical lines.';
COMMENT ON COLUMN public.order_items.description_es IS 'Purchase-time snapshot of add-on description (Spanish); null for historical lines.';
DO $m$ DECLARE d text; BEGIN
 SELECT pg_get_functiondef('public.create_challenge_order(uuid,uuid,jsonb,text)'::regprocedure) INTO d;
 d:=replace(d,'''description'',a->>''description'',''quantity'',qty','''description'',a->>''description'',''description_en'',nullif(a->>''description_en'',''''),''description_es'',coalesce(nullif(a->>''description_es'',''''),CASE WHEN nullif(a->>''description_en'','''') IS NULL THEN nullif(a->>''description'','''') END),''quantity'',qty');
 d:=replace(d,'INSERT INTO order_items(order_id,item_type,addon_key,description,quantity,unit_cents) VALUES(oid,''addon'',a->>''id'',a->>''name'',','INSERT INTO order_items(order_id,item_type,addon_key,description,description_en,description_es,quantity,unit_cents) VALUES(oid,''addon'',a->>''id'',a->>''name'',a->>''description_en'',a->>''description_es'',');
 IF d NOT LIKE '%description_en,description_es,quantity%' OR d NOT LIKE '%''description_en'',nullif%' THEN RAISE EXCEPTION 'order_pattern_missing'; END IF; EXECUTE d;
 SELECT pg_get_functiondef('public.challenge_order_receipts(uuid)'::regprocedure) INTO d;
 d:=regexp_replace(d,'''description_en'',\(SELECT .*?LIMIT 1\),''description_es'',\(SELECT .*?LIMIT 1\),','''description_en'',i.description_en,''description_es'',i.description_es,');
 IF d LIKE '%c2.addons%' OR d NOT LIKE '%i.description_en%' THEN RAISE EXCEPTION 'receipt_pattern_missing'; END IF; EXECUTE d;
END $m$;