-- Participant contact details: host or assigned co-host only. Leaders keep event management via can_manage_event.
DROP POLICY IF EXISTS "Own RSVPs, hosts and leaders read" ON public.rsvps;
CREATE POLICY "Own RSVPs or assigned host reads" ON public.rsvps FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.can_access_event_participants(event_id));
DROP POLICY IF EXISTS "Own RSVP or host/leader update" ON public.rsvps;
CREATE POLICY "Own RSVP or assigned host update" ON public.rsvps FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.can_access_event_participants(event_id))
  WITH CHECK (user_id = auth.uid() OR public.can_access_event_participants(event_id));
DROP POLICY IF EXISTS "Host or leader delete RSVP" ON public.rsvps;
CREATE POLICY "Assigned host deletes RSVP" ON public.rsvps FOR DELETE TO authenticated
  USING (public.can_access_event_participants(event_id));
DROP POLICY IF EXISTS "Hosts, co-hosts and leaders read answers" ON public.rsvp_answers;
CREATE POLICY "Assigned host reads answers" ON public.rsvp_answers FOR SELECT TO authenticated
  USING (public.can_access_event_participants(event_id));
DROP POLICY IF EXISTS "Hosts and leaders read waiver records" ON public.waiver_acceptances;
CREATE POLICY "Assigned host reads waiver records" ON public.waiver_acceptances FOR SELECT TO authenticated
  USING (public.can_access_event_participants(event_id));
DROP POLICY IF EXISTS "Hosts and leaders read outbox" ON public.notification_outbox;
CREATE POLICY "Assigned host reads event outbox" ON public.notification_outbox FOR SELECT TO authenticated
  USING (event_id IS NOT NULL AND public.can_access_event_participants(event_id));

-- Text invite candidates: only past guests of events the caller hosts/co-hosts (was: whole team, including leaders).
CREATE OR REPLACE FUNCTION public.text_invite_candidates(_event uuid)
 RETURNS TABLE(phone text, name text, language text, last_seen timestamp with time zone, invited boolean)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.can_access_event_participants(_event) THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  SELECT DISTINCT ON (ph) ph, r.guest_name, r.language, r.created_at,
    EXISTS (SELECT 1 FROM public.sms_invites i WHERE i.event_id = _event AND i.phone = ph)
  FROM (SELECT r0.*, public.normalize_phone(r0.guest_phone) AS ph FROM public.rsvps r0
        JOIN public.events e ON e.id = r0.event_id
        WHERE r0.sms_opt_in AND r0.guest_phone IS NOT NULL
          AND (e.host_id = auth.uid() OR EXISTS (SELECT 1 FROM public.event_cohosts c WHERE c.event_id = e.id AND c.user_id = auth.uid()))) r
  WHERE ph IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.sms_optouts o WHERE o.phone = ph)
    AND NOT EXISTS (SELECT 1 FROM public.rsvps x WHERE x.event_id = _event AND x.status <> 'cancelled' AND public.normalize_phone(x.guest_phone) = ph)
  ORDER BY ph, r.created_at DESC
  LIMIT 300;
END $function$;

-- Remove anonymous EXECUTE from security-definer functions that are trigger-only or signed-in-only.
REVOKE EXECUTE ON FUNCTION public.first_timer_welcome(), public.milestones_on_rsvp(), public.milestones_on_event(), public.guard_early_access_rsvp(), public.limited_badges_on_checkin(), public.founding_on_join(), public.guard_founding_seat(), public.retreat_payment_reminders(), public.mark_host_live(), public.block_unpaid_selling() FROM PUBLIC, anon, authenticated;
DO $$
DECLARE f record;
BEGIN
  FOR f IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
      AND p.proname IN ('decide_rsvp','evaluate_milestones','feature_badge','name_member_of_month','reset_invite_link','promo_usage','community_requests','founding_status','my_invite_code','text_invite_candidates')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f.sig);
  END LOOP;
END $$;
