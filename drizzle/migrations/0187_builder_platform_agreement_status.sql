CREATE OR REPLACE FUNCTION public.current_platform_agreement() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE en consent_text_versions; es consent_text_versions;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO en FROM consent_text_versions WHERE id=approved_event_agreement('en');
  SELECT * INTO es FROM consent_text_versions WHERE id=approved_event_agreement('es');
  RETURN jsonb_build_object('ready',en.id IS NOT NULL AND es.id IS NOT NULL,'en_id',en.id,'es_id',es.id,'en_url',en.document_url,'es_url',es.document_url,'en_version',en.version,'es_version',es.version,'en_effective',en.effective_from,'es_effective',es.effective_from);
END $$;
REVOKE ALL ON FUNCTION public.current_platform_agreement() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.current_platform_agreement() TO authenticated,service_role;
COMMENT ON FUNCTION public.current_platform_agreement() IS 'Read-only approved ZoheeWell agreement status for the event builder; never selects unapproved text.';