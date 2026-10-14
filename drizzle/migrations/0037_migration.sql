-- Paid items can be published only once the host's payouts are connected.
CREATE OR REPLACE FUNCTION public.payouts_live(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT EXISTS (SELECT 1 FROM billing_accounts WHERE user_id = _uid AND connect_status = 'active') $$;
REVOKE ALL ON FUNCTION public.payouts_live(uuid) FROM public, anon;

CREATE OR REPLACE FUNCTION public.block_unpaid_selling()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _owner uuid; _sells boolean;
BEGIN
  IF coalesce(auth.jwt()->>'role','') = 'service_role' THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME = 'events' THEN
    _owner := NEW.host_id; _sells := coalesce(NEW.price_cents, 0) > 0 AND NEW.status = 'published';
  ELSIF TG_TABLE_NAME = 'offers' THEN
    _owner := NEW.host_id; _sells := coalesce(NEW.price_cents, 0) > 0 AND NEW.status = 'published';
  ELSE
    _owner := NEW.created_by; _sells := coalesce(NEW.is_paid, false) AND coalesce(NEW.price_cents, 0) > 0;
  END IF;
  IF _sells AND NOT payouts_live(_owner) THEN RAISE EXCEPTION 'payouts_required'; END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS block_unpaid_selling ON public.events;
CREATE TRIGGER block_unpaid_selling BEFORE INSERT OR UPDATE OF price_cents, status ON public.events FOR EACH ROW EXECUTE FUNCTION public.block_unpaid_selling();
DROP TRIGGER IF EXISTS block_unpaid_selling ON public.offers;
CREATE TRIGGER block_unpaid_selling BEFORE INSERT OR UPDATE OF price_cents, status ON public.offers FOR EACH ROW EXECUTE FUNCTION public.block_unpaid_selling();
DROP TRIGGER IF EXISTS block_unpaid_selling ON public.challenges;
CREATE TRIGGER block_unpaid_selling BEFORE INSERT OR UPDATE OF price_cents, is_paid ON public.challenges FOR EACH ROW EXECUTE FUNCTION public.block_unpaid_selling();