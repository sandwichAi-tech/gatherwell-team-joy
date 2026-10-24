CREATE OR REPLACE FUNCTION public.admin_account_record(_actor uuid,_target uuid,_action text,_reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE was_suspended boolean;
BEGIN
 IF NOT has_role(_actor,'admin') OR EXISTS(SELECT 1 FROM user_suspensions WHERE user_id=_actor) OR _actor=_target THEN RAISE EXCEPTION 'forbidden'; END IF;
 IF _action NOT IN ('suspend','restore') OR length(trim(coalesce(_reason,'')))<3 OR length(_reason)>500 THEN RAISE EXCEPTION 'reason_required'; END IF;
 PERFORM 1 FROM profiles WHERE id=_target FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
 SELECT EXISTS(SELECT 1 FROM user_suspensions WHERE user_id=_target) INTO was_suspended;
 IF was_suspended=(_action='suspend') THEN RETURN; END IF;
 IF _action='suspend' THEN INSERT INTO user_suspensions(user_id,reason,suspended_by) VALUES(_target,trim(_reason),_actor);
 ELSE DELETE FROM user_suspensions WHERE user_id=_target; END IF;
 INSERT INTO admin_audit(actor_id,action,target_type,target_id,note,before,after) VALUES(_actor,'safety.user.'||_action,'user',_target::text,trim(_reason),jsonb_build_object('suspended',was_suspended),jsonb_build_object('suspended',_action='suspend'));
END $$;
REVOKE ALL ON FUNCTION public.admin_account_record(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_account_record(uuid,uuid,text,text) TO service_role;
CREATE OR REPLACE FUNCTION public.reply_support_ticket(_ticket uuid,_body text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t support_tickets; staff boolean:=has_role(auth.uid(),'admin'); k text:='support-reply:'||auth.uid();
BEGIN
 _body:=trim(coalesce(_body,'')); IF length(_body)<1 OR length(_body)>4000 THEN RAISE EXCEPTION 'invalid_body'; END IF;
 SELECT * INTO t FROM support_tickets WHERE id=_ticket FOR UPDATE;
 IF t.id IS NULL OR NOT(t.user_id=auth.uid() OR staff) OR EXISTS(SELECT 1 FROM user_suspensions WHERE user_id=auth.uid()) THEN RAISE EXCEPTION 'not_allowed'; END IF;
 IF t.status='closed' THEN RAISE EXCEPTION 'closed'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(k,0));
 IF (SELECT count(*) FROM rsvp_attempts WHERE key=k AND created_at>now()-interval '1 minute')>=10 THEN RAISE EXCEPTION 'rate_limited'; END IF;
 INSERT INTO rsvp_attempts(key) VALUES(k);
 INSERT INTO support_messages(ticket_id,sender_id,is_staff,body) VALUES(_ticket,auth.uid(),staff AND t.user_id<>auth.uid(),_body);
 UPDATE support_tickets SET status=CASE WHEN staff AND t.user_id<>auth.uid() THEN 'answered' ELSE 'open' END,updated_at=now() WHERE id=_ticket;
 IF staff AND t.user_id<>auth.uid() THEN
 PERFORM notify_users(ARRAY[t.user_id],'support','ZoheeWell support replied',NULL,'/support?t='||_ticket,'support:'||_ticket||':'||gen_random_uuid());
 INSERT INTO admin_audit(actor_id,action,target_type,target_id,after) VALUES(auth.uid(),'support.reply','support_ticket',_ticket::text,jsonb_build_object('staff',true)); END IF;
END $$;
CREATE OR REPLACE FUNCTION public.close_support_ticket(_ticket uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t support_tickets; staff boolean:=has_role(auth.uid(),'admin');
BEGIN
 SELECT * INTO t FROM support_tickets WHERE id=_ticket FOR UPDATE;
 IF t.id IS NULL OR NOT(t.user_id=auth.uid() OR staff) OR EXISTS(SELECT 1 FROM user_suspensions WHERE user_id=auth.uid()) THEN RAISE EXCEPTION 'not_allowed'; END IF;
 IF t.status='closed' THEN RETURN; END IF;
 UPDATE support_tickets SET status='closed',updated_at=now() WHERE id=_ticket;
 IF staff AND t.user_id<>auth.uid() THEN INSERT INTO admin_audit(actor_id,action,target_type,target_id) VALUES(auth.uid(),'support.close','support_ticket',_ticket::text); END IF;
END $$;