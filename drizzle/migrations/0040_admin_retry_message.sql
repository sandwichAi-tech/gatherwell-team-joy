CREATE OR REPLACE FUNCTION public.admin_retry_message(_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor uuid := auth.uid();
  _before public.notification_outbox;
  _after public.notification_outbox;
BEGIN
  IF _actor IS NULL OR NOT public.has_role(_actor, 'admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO _before FROM public.notification_outbox WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;
  IF _before.status <> 'failed' OR _before.provider_message_id IS NOT NULL OR _before.sent_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_retryable');
  END IF;
  UPDATE public.notification_outbox
    SET status = 'pending', attempts = 0, error = NULL, locked_at = NULL,
        send_after = now()
    WHERE id = _id RETURNING * INTO _after;
  INSERT INTO public.admin_audit(actor_id, action, target_type, target_id, before, after)
    VALUES (_actor, 'mail.retry', 'message', _id::text,
      jsonb_build_object('status', _before.status, 'attempts', _before.attempts, 'error', _before.error, 'send_after', _before.send_after),
      jsonb_build_object('status', _after.status, 'attempts', _after.attempts, 'error', _after.error, 'send_after', _after.send_after));
  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_retry_message(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_retry_message(uuid) TO authenticated;
COMMENT ON FUNCTION public.admin_retry_message(uuid) IS 'Admin-only atomic retry and audit of failed, unacknowledged messages. Normal claim_outbox recipient safeguards still apply.';