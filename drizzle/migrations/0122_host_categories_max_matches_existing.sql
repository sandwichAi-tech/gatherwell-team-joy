CREATE OR REPLACE FUNCTION public.host_categories_normalize_trg() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.host_categories IS DISTINCT FROM OLD.host_categories THEN
    NEW.host_categories := nullif(public.normalize_host_categories(NEW.host_categories), '{}');
    IF coalesce(array_length(NEW.host_categories, 1), 0) > 8 THEN RAISE EXCEPTION 'too_many_categories'; END IF;
  END IF;
  RETURN NEW;
END $$;