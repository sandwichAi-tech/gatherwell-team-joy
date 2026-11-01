CREATE OR REPLACE FUNCTION public.platform_agreement_text(_locale text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT jsonb_build_object('id', c.id, 'version', c.version, 'locale', c.locale, 'body', c.body, 'sha256', c.body_sha256,
    'effective_from', c.effective_from, 'approved_at', c.approved_at)
  FROM consent_text_versions c WHERE c.id = approved_event_agreement(CASE WHEN _locale='es' THEN 'es' ELSE 'en' END)
$$;
COMMENT ON FUNCTION public.platform_agreement_text(text) IS 'Public read of the current approved ZoheeWell platform agreement text only (no drafts, no team rows).';
REVOKE ALL ON FUNCTION public.platform_agreement_text(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.platform_agreement_text(text) TO anon, authenticated, service_role;