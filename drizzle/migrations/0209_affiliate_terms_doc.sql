-- Link to the approved affiliate terms document for the referrer's language; null when none is approved.
CREATE OR REPLACE FUNCTION public.affiliate_terms_doc(_locale text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('version', c.version, 'url', c.document_url) FROM consent_text_versions c
  WHERE c.id = public.approved_affiliate_terms(CASE WHEN _locale = 'es' THEN 'es' ELSE 'en' END)
$$;
REVOKE ALL ON FUNCTION public.affiliate_terms_doc(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.affiliate_terms_doc(text) TO authenticated;