ALTER TABLE public.events ADD COLUMN IF NOT EXISTS category_label text;
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_category_check;
ALTER TABLE public.events ADD CONSTRAINT events_category_check CHECK (category IS NULL OR category IN ('run','fitcamp','yoga','pilates','soundbath','hike','walk','pickleball','more'));
ALTER TABLE public.events ADD CONSTRAINT events_category_label_check CHECK (category_label IS NULL OR (length(trim(category_label)) BETWEEN 1 AND 60 AND category = 'more'));
CREATE OR REPLACE FUNCTION public.infer_gathering_category(_title text, _category text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT coalesce(_category, CASE WHEN _title ~* 'pilates' THEN 'pilates' WHEN _title ~* '(run|jog|corr)' THEN 'run' WHEN _title ~* 'yoga' THEN 'yoga' WHEN _title ~* '(sound|gong|sonido)' THEN 'soundbath' WHEN _title ~* '(hike|trail|sender|caminata de monta)' THEN 'hike' WHEN _title ~* '(walk|camin|paseo)' THEN 'walk' WHEN _title ~* 'pickleball' THEN 'pickleball' WHEN _title ~* '(camp|boot|fit|hiit|entren)' THEN 'fitcamp' ELSE 'more' END)
$$;
DO $$ DECLARE original text; revised text; BEGIN
 original := pg_get_functiondef('public.create_gathering(uuid,jsonb,boolean,boolean)'::regprocedure);
 revised := replace(original, 'cover_url, cover_style, theme, starts_at', 'cover_url, cover_style, category, category_label, theme, starts_at');
 revised := replace(revised, 'coalesce((_p->>''cover_style'')::int, 0), nullif(_p->>''theme'','''')', 'coalesce((_p->>''cover_style'')::int, 0), nullif(_p->>''category'',''''), CASE WHEN _p->>''category'' = ''more'' THEN nullif(trim(_p->>''category_label''),'''') END, nullif(_p->>''theme'','''')');
 IF revised = original OR position('category_label' in revised) = 0 THEN RAISE EXCEPTION 'create_definition_mismatch'; END IF;
 EXECUTE revised;
 original := pg_get_functiondef('public.update_gathering(uuid,jsonb,boolean)'::regprocedure);
 revised := replace(original, 'UPDATE public.events SET title = trim(_p->>''title'')', 'UPDATE public.events SET category = CASE WHEN _p ? ''category'' THEN nullif(_p->>''category'','''') ELSE category END, category_label = CASE WHEN _p ? ''category'' THEN CASE WHEN _p->>''category'' = ''more'' THEN nullif(trim(_p->>''category_label''),'''') END ELSE category_label END, title = trim(_p->>''title'')');
 IF revised = original THEN RAISE EXCEPTION 'update_definition_mismatch'; END IF;
 EXECUTE revised;
 original := pg_get_functiondef('public.list_public_gatherings(boolean,integer,integer)'::regprocedure);
 revised := replace(original, '''category'', public.infer_gathering_category(e.title, e.category),', '''category'', public.infer_gathering_category(e.title, e.category), ''category_label'', e.category_label,');
 IF revised = original THEN RAISE EXCEPTION 'feed_definition_mismatch'; END IF;
 EXECUTE revised;
END $$;
CREATE OR REPLACE FUNCTION public.waiver_default_on_event() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
 IF nullif(trim(coalesce(NEW.online_url,'')),'') IS NULL AND coalesce(NEW.category, infer_gathering_category(NEW.title,NEW.category)) IN ('run','fitcamp','yoga','pilates','hike','walk','pickleball') THEN NEW.requires_waiver := true; END IF;
 RETURN NEW;
END $$;