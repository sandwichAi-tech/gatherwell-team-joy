DO $$ DECLARE d text; BEGIN
 SELECT pg_get_functiondef('public.challenge_member_active(uuid,uuid)'::regprocedure) INTO d;
 d:=replace(d,'NOT c.is_paid OR','(NOT c.is_paid AND m.source<>''order'') OR'); EXECUTE d;
 SELECT pg_get_functiondef('public.reconcile_challenge_refund(uuid,text,text,integer,jsonb)'::regprocedure) INTO d;
 d:=replace(d,'IF base_refunded THEN UPDATE challenge_members','IF NOT cOALESCE((SELECT is_paid FROM challenges WHERE id=o.challenge_id),true) AND total>=o.gross_cents AND o.status<>''disputed'' THEN UPDATE challenge_members SET source=''free'',order_id=NULL,extras=''[]''::jsonb WHERE order_id=_order AND access_status=''active''; END IF; IF base_refunded THEN UPDATE challenge_members'); EXECUTE d;
END $$;
CREATE OR REPLACE FUNCTION public.record_unallocated_challenge_refund(_order uuid,_refund text,_amount integer,_status text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE r refunds; BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' OR _status IS NULL OR _status NOT IN('pending','failed','succeeded') OR _amount IS NULL OR _amount<=0 OR NOT EXISTS(SELECT 1 FROM orders WHERE id=_order AND offering_type='challenge' AND gross_cents>=_amount) THEN RAISE EXCEPTION 'not_allowed'; END IF;
 PERFORM 1 FROM orders WHERE id=_order FOR UPDATE;
 SELECT * INTO r FROM refunds WHERE stripe_refund_id=_refund FOR UPDATE;
 IF FOUND AND (r.order_id IS DISTINCT FROM _order OR r.amount_cents IS DISTINCT FROM _amount) THEN RAISE EXCEPTION 'invalid_refund'; END IF;
 INSERT INTO refunds(order_id,idempotency_key,reason,amount_cents,status,stripe_refund_id,allocation_required) VALUES(_order,'challenge-refund:'||_refund,'other',_amount,_status,_refund,true) ON CONFLICT(stripe_refund_id) DO UPDATE SET status=CASE WHEN refunds.status='succeeded' THEN refunds.status ELSE EXCLUDED.status END;
 END $$;