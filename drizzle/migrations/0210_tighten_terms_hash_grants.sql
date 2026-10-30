REVOKE ALL ON FUNCTION public.approved_affiliate_terms(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approved_affiliate_terms(text) TO authenticated;
REVOKE ALL ON FUNCTION public.lesson_source_hash(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lesson_source_hash(uuid) TO authenticated;