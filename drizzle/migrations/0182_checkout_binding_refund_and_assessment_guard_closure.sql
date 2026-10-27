ALTER TABLE public.orders ADD COLUMN checkout_create_started_at timestamptz, ADD COLUMN checkout_request jsonb;
CREATE OR REPLACE FUNCTION public.claim_challenge_checkout(_order uuid,_buyer uuid,_origin text,_lang text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE o orders; BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' OR _buyer IS NULL OR _lang IS NULL OR _lang NOT IN('en','es') THEN RAISE EXCEPTION 'not_allowed'; END IF;
 SELECT * INTO o FROM orders WHERE id=_order AND offering_type='challenge'; IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
 PERFORM 1 FROM challenges WHERE id=o.challenge_id FOR UPDATE; SELECT * INTO o FROM orders WHERE id=_order FOR UPDATE;
 IF o.buyer_user_id IS DISTINCT FROM _buyer OR o.status<>'pending' OR o.reservation_expires_at<=now() THEN RAISE EXCEPTION 'checkout_pending'; END IF;
 IF o.checkout_create_started_at < now()-interval '1 hour' THEN RAISE EXCEPTION 'checkout_recovery_required'; END IF;
 IF o.checkout_request IS NULL THEN UPDATE orders SET checkout_request=jsonb_build_object('origin',_origin,'lang',_lang),checkout_create_started_at=now() WHERE id=o.id RETURNING * INTO o; END IF; RETURN o.checkout_request; END $$;
REVOKE ALL ON FUNCTION public.claim_challenge_checkout(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.claim_challenge_checkout(uuid,uuid,text,text) TO service_role;
CREATE OR REPLACE FUNCTION public.bind_challenge_checkout(_order uuid,_buyer uuid,_session text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE o orders; BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' OR _session IS NULL OR _session NOT LIKE 'cs_%' THEN RAISE EXCEPTION 'not_allowed'; END IF;
 SELECT * INTO o FROM orders WHERE id=_order AND offering_type='challenge'; IF NOT FOUND THEN RETURN false; END IF;
 PERFORM 1 FROM challenges WHERE id=o.challenge_id FOR UPDATE;
 UPDATE orders SET stripe_checkout_session_id=_session WHERE id=_order AND buyer_user_id=_buyer AND status='pending' AND reservation_expires_at>now() AND checkout_create_started_at IS NOT NULL AND (stripe_checkout_session_id IS NULL OR stripe_checkout_session_id=_session); RETURN FOUND; END $$;
REVOKE ALL ON FUNCTION public.bind_challenge_checkout(uuid,uuid,text) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.bind_challenge_checkout(uuid,uuid,text) TO service_role;
CREATE OR REPLACE FUNCTION public.cancel_challenge_checkout_verified(_order uuid,_buyer uuid,_session text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE o orders; BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'not_allowed'; END IF;
 SELECT * INTO o FROM orders WHERE id=_order AND offering_type='challenge'; IF NOT FOUND OR o.buyer_user_id IS DISTINCT FROM _buyer OR o.stripe_checkout_session_id IS DISTINCT FROM _session THEN RAISE EXCEPTION 'not_allowed'; END IF;
 IF _session IS NULL AND o.checkout_create_started_at IS NOT NULL THEN RAISE EXCEPTION 'checkout_recovery_required'; END IF;
 PERFORM release_challenge_checkout(_order,'cancelled'); END $$;
REVOKE ALL ON FUNCTION public.cancel_challenge_checkout_verified(uuid,uuid,text) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.cancel_challenge_checkout_verified(uuid,uuid,text) TO service_role;
DO $$ DECLARE d text; BEGIN
 SELECT pg_get_functiondef('public.complete_wellness_assessment(uuid,uuid,integer,uuid,boolean,jsonb)'::regprocedure) INTO d;
 d:=replace(d,'OR NOT _accepted OR','OR _accepted IS DISTINCT FROM true OR');
 d:=replace(d,'IF FOUND THEN RETURN jsonb_build_object(''id'',receipt.id','IF FOUND THEN IF receipt.answers IS DISTINCT FROM _answers OR receipt.revision IS DISTINCT FROM _revision OR receipt.scope_id IS DISTINCT FROM _scope THEN RAISE EXCEPTION ''request_changed''; END IF; RETURN jsonb_build_object(''id'',receipt.id'); EXECUTE d;
 SELECT pg_get_functiondef('public.reconcile_challenge_refund(uuid,text,text,integer,jsonb)'::regprocedure) INTO d;
 d:=replace(d,'IF FOUND AND r.status=''succeeded'' THEN RETURN; END IF;','IF FOUND THEN IF r.order_id IS DISTINCT FROM _order OR r.amount_cents IS DISTINCT FROM _amount THEN RAISE EXCEPTION ''invalid_refund''; END IF; IF r.status=''succeeded'' AND (NOT r.allocation_required OR _status<>''succeeded'') THEN RETURN; END IF; END IF;');
 d:=replace(d,'SET status=EXCLUDED.status;','SET status=EXCLUDED.status,allocation_required=false;');
 d:=replace(d,'CASE WHEN total>=gross_cents','CASE WHEN status=''disputed'' THEN ''disputed'' WHEN total>=gross_cents'); EXECUTE d;
END $$;
CREATE OR REPLACE FUNCTION public.guard_assessment_manual_progress() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NEW.completed_at IS NOT NULL AND EXISTS(SELECT 1 FROM quizzes q WHERE (q.lesson_id=NEW.lesson_id OR q.id=(SELECT resource_quiz_id FROM lessons WHERE id=NEW.lesson_id)) AND q.assessment_config IS NOT NULL AND NOT EXISTS(SELECT 1 FROM assessment_receipts r WHERE r.quiz_id=q.id AND r.user_id=NEW.user_id)) THEN RAISE EXCEPTION 'assessment_completion_required'; END IF; RETURN NEW; END $$;