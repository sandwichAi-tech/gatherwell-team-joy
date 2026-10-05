CREATE OR REPLACE FUNCTION public.guard_event_price()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF coalesce(auth.jwt()->>'role','') = 'service_role' THEN RETURN NEW; END IF;
  IF NEW.price_cents IS NOT NULL AND NEW.price_cents IS DISTINCT FROM OLD.price_cents
     AND NOT EXISTS (SELECT 1 FROM billing_accounts WHERE user_id = NEW.host_id AND connect_status = 'active') THEN
    RAISE EXCEPTION 'payouts_required';
  END IF;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.guard_event_price() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER events_price_guard BEFORE UPDATE OF price_cents ON public.events FOR EACH ROW EXECUTE FUNCTION public.guard_event_price();
GRANT EXECUTE ON FUNCTION public.effective_plan(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.rsvp_event(uuid, text, text, text, text, text, integer, text, boolean, boolean) TO service_role;