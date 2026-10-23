CREATE OR REPLACE FUNCTION public.guard_template() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF current_setting('gatherwell.launch', true) = 'on' OR coalesce(auth.jwt()->>'role','') = 'service_role' OR auth.uid() IS NULL THEN RETURN NEW; END IF;
 IF TG_OP = 'INSERT' THEN NEW.launches_count := 0;
 ELSIF NEW.launches_count IS DISTINCT FROM OLD.launches_count OR NEW.team_id IS DISTINCT FROM OLD.team_id OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN RAISE EXCEPTION 'locked'; END IF;
 IF length(trim(NEW.title)) = 0 OR length(NEW.title) > 120 THEN RAISE EXCEPTION 'invalid_title'; END IF;
 IF NEW.category NOT IN ('run','fitcamp','yoga','pilates','soundbath','hike','walk','pickleball','more') THEN RAISE EXCEPTION 'invalid_category'; END IF;
 IF NEW.default_mode NOT IN ('person','online') THEN RAISE EXCEPTION 'invalid_mode'; END IF;
 IF NEW.default_duration_minutes < 5 OR NEW.default_duration_minutes > 1440 THEN RAISE EXCEPTION 'invalid_duration'; END IF;
 IF NEW.default_capacity IS NOT NULL AND NEW.default_capacity < 1 THEN RAISE EXCEPTION 'invalid_capacity'; END IF;
 IF NEW.default_price_cents < 0 OR NEW.default_price_cents > 100000 THEN RAISE EXCEPTION 'invalid_price'; END IF;
 IF NEW.visibility_default = 'team' AND NEW.default_price_cents > 0 THEN RAISE EXCEPTION 'team_must_be_free'; END IF;
 IF public.has_blocked_claim(NEW.title || ' ' || coalesce(NEW.description_en,'') || ' ' || coalesce(NEW.description_es,'')) THEN RAISE EXCEPTION 'claim_blocked'; END IF;
 RETURN NEW;
END; $$;