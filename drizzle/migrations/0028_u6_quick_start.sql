ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS host_languages text[] NOT NULL DEFAULT '{}'::text[];
ALTER TABLE public.profiles ADD CONSTRAINT profiles_host_languages_check CHECK (host_languages <@ ARRAY['en','es']::text[]);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS live_at timestamptz;
COMMENT ON COLUMN public.profiles.live_at IS 'When this person first published a gathering or Circle (Time to live metric). Set by trigger only.';

CREATE OR REPLACE FUNCTION public.mark_host_live() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status = 'published' THEN
    UPDATE profiles SET live_at = now() WHERE id = NEW.host_id AND live_at IS NULL;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER events_mark_live AFTER INSERT OR UPDATE OF status ON public.events FOR EACH ROW EXECUTE FUNCTION public.mark_host_live();
CREATE TRIGGER offers_mark_live AFTER INSERT OR UPDATE OF status ON public.offers FOR EACH ROW WHEN (NEW.kind = 'membership') EXECUTE FUNCTION public.mark_host_live();

-- Backfill from existing published gatherings and Circles.
UPDATE public.profiles p SET live_at = x.first FROM (
  SELECT host_id, min(created_at) first FROM (
    SELECT host_id, created_at FROM public.events WHERE status = 'published'
    UNION ALL SELECT host_id, created_at FROM public.offers WHERE status = 'published' AND kind = 'membership') u GROUP BY host_id) x
WHERE p.id = x.host_id AND p.live_at IS NULL;

-- Keep live_at server-owned: clients cannot write it.
CREATE OR REPLACE FUNCTION public.guard_profile_live_at() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF current_setting('request.jwt.claims', true) IS NOT NULL AND coalesce(current_setting('request.jwt.claims', true)::jsonb->>'role','') = 'authenticated'
     AND NEW.live_at IS DISTINCT FROM OLD.live_at AND pg_trigger_depth() = 1 THEN NEW.live_at := OLD.live_at; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER profiles_guard_live_at BEFORE UPDATE OF live_at ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.guard_profile_live_at();

CREATE OR REPLACE FUNCTION public.admin_time_to_live(_since timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r jsonb;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not_allowed'; END IF;
  SELECT jsonb_build_object(
    'median_minutes', round((percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM p.live_at - p.created_at) / 60))::numeric),
    'live', count(*),
    'within_hour', count(*) FILTER (WHERE p.live_at - p.created_at <= interval '1 hour'))
  INTO r FROM profiles p WHERE p.live_at IS NOT NULL AND p.created_at >= _since;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.admin_time_to_live(timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_time_to_live(timestamptz) TO authenticated;