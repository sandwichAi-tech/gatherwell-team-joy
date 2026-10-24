-- 0065: gen_random_bytes is unavailable; derive the certificate number from gen_random_uuid().

CREATE OR REPLACE FUNCTION public.issue_certificate(_offer uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE o public.offers; prog jsonb; c public.certificates; p public.profiles; num text;
BEGIN
  SELECT * INTO o FROM public.offers WHERE id = _offer AND certificate_enabled;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  SELECT * INTO c FROM public.certificates WHERE offer_id = _offer AND user_id = auth.uid();
  IF c.id IS NOT NULL THEN RETURN jsonb_build_object('certificate_id', c.id, 'cert_number', c.cert_number, 'idempotent', true, 'revoked', c.revoked_at IS NOT NULL); END IF;
  prog := public.course_progress(_offer);
  IF NOT coalesce((prog->>'complete')::boolean, false) THEN RAISE EXCEPTION 'not_complete'; END IF;
  SELECT * INTO p FROM public.profiles WHERE id = auth.uid();
  num := 'ZW-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
  INSERT INTO public.certificates (offer_id, user_id, cert_number, learner_name, course_title, issuer_name, signer_name, signer_title, statement, expires_at)
  VALUES (_offer, auth.uid(), num, coalesce(nullif(trim(p.full_name), ''), 'Learner'),
    coalesce(nullif(trim(o.title_en), ''), nullif(trim(o.title_es), ''), 'Course'),
    coalesce(nullif(trim(o.cert_issuer), ''), 'ZoheeWell'), o.cert_signer_name, o.cert_signer_title,
    coalesce(nullif(trim(o.cert_statement), ''), coalesce(nullif(trim(o.cert_title), ''), 'Certificate of completion')),
    CASE WHEN o.cert_expiry_months IS NOT NULL THEN now() + make_interval(months => o.cert_expiry_months) END)
  RETURNING * INTO c;
  RETURN jsonb_build_object('certificate_id', c.id, 'cert_number', c.cert_number, 'idempotent', false, 'revoked', false);
END;
$function$;