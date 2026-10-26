-- Deleting an offer previously detached its curriculum tracks (FK SET NULL), turning a draft
-- course's lessons into an ordinary team track readable by every team member. Remove them with the offer.
CREATE OR REPLACE FUNCTION public.offers_delete_curriculum()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  DELETE FROM public.tracks WHERE offer_id = OLD.id;
  RETURN OLD;
END $$;
REVOKE EXECUTE ON FUNCTION public.offers_delete_curriculum() FROM public, anon, authenticated;
CREATE TRIGGER offers_delete_curriculum BEFORE DELETE ON public.offers
  FOR EACH ROW EXECUTE FUNCTION public.offers_delete_curriculum();