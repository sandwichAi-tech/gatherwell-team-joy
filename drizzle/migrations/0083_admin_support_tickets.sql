
-- Admin support triage list: admin-role only, display name + counts, no reporter emails.
CREATE OR REPLACE FUNCTION public.admin_support_tickets(_status text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _status NOT IN ('open','answered','closed') THEN RAISE EXCEPTION 'invalid_status'; END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', t.id, 'category', t.category, 'subject', t.subject, 'status', t.status,
      'created_at', t.created_at, 'updated_at', t.updated_at,
      'requester', p.full_name,
      'messages', (SELECT count(*) FROM support_messages m WHERE m.ticket_id = t.id),
      'last_message', (SELECT jsonb_build_object('is_staff', m.is_staff, 'body', left(m.body, 280), 'created_at', m.created_at)
                       FROM support_messages m WHERE m.ticket_id = t.id ORDER BY m.created_at DESC LIMIT 1)
    ) ORDER BY t.updated_at DESC)
    FROM support_tickets t LEFT JOIN profiles p ON p.id = t.user_id
    WHERE t.status = _status
  ), '[]'::jsonb);
END $$;
GRANT EXECUTE ON FUNCTION public.admin_support_tickets(text) TO authenticated;
