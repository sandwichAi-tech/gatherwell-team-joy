ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.teams ADD CONSTRAINT teams_description_length CHECK (description IS NULL OR char_length(description) <= 500) NOT VALID;

-- Allowed host categories (mirrors CATEGORIES in src/lib/landing.ts). Legacy free text maps by key/label; unknown values are dropped.
CREATE OR REPLACE FUNCTION public.normalize_host_categories(_in text[])
RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT coalesce(array_agg(k ORDER BY first_pos), '{}') FROM (
    SELECT k, min(pos) AS first_pos FROM (
      SELECT CASE lower(trim(v))
        WHEN 'run' THEN 'run' WHEN 'run club' THEN 'run' WHEN 'run clubs' THEN 'run' WHEN 'running' THEN 'run'
        WHEN 'fitcamp' THEN 'fitcamp' WHEN 'fit camp' THEN 'fitcamp' WHEN 'fit camps' THEN 'fitcamp'
        WHEN 'yoga' THEN 'yoga' WHEN 'pilates' THEN 'pilates'
        WHEN 'soundbath' THEN 'soundbath' WHEN 'sound bath' THEN 'soundbath' WHEN 'sound baths' THEN 'soundbath'
        WHEN 'hike' THEN 'hike' WHEN 'hikes' THEN 'hike' WHEN 'hiking' THEN 'hike'
        WHEN 'walk' THEN 'walk' WHEN 'walks' THEN 'walk' WHEN 'walking' THEN 'walk'
        WHEN 'pickleball' THEN 'pickleball' WHEN 'more' THEN 'more'
        ELSE NULL END AS k, pos
      FROM unnest(coalesce(_in, '{}')) WITH ORDINALITY u(v, pos)) m
    WHERE k IS NOT NULL GROUP BY k) d
$$;

CREATE OR REPLACE FUNCTION public.host_categories_normalize_trg() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.host_categories IS DISTINCT FROM OLD.host_categories THEN
    NEW.host_categories := nullif(public.normalize_host_categories(NEW.host_categories), '{}');
    IF coalesce(array_length(NEW.host_categories, 1), 0) > 5 THEN RAISE EXCEPTION 'too_many_categories'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER profiles_host_categories_normalize BEFORE UPDATE OF host_categories ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.host_categories_normalize_trg();