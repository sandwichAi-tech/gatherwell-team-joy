CREATE OR REPLACE FUNCTION public.guard_paid_challenge_join()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF coalesce(auth.jwt()->>'role','') = 'service_role' THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM challenges WHERE id = NEW.challenge_id AND is_paid AND price_cents IS NOT NULL AND created_by <> NEW.user_id) THEN
    RAISE EXCEPTION 'payment_required';
  END IF;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.guard_paid_challenge_join() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER challenge_members_paid_guard BEFORE INSERT ON public.challenge_members FOR EACH ROW EXECUTE FUNCTION public.guard_paid_challenge_join();