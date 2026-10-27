CREATE OR REPLACE FUNCTION public.require_adult_actor() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF auth.uid() IS NOT NULL AND NOT public.is_adult(auth.uid()) THEN
 IF TG_TABLE_NAME='events' AND TG_OP='UPDATE' THEN IF NEW.status IS NOT DISTINCT FROM OLD.status OR NEW.status<>'published' THEN RETURN NEW; END IF; END IF;
 RAISE EXCEPTION 'adult_required' USING ERRCODE='P0001'; END IF; RETURN NEW; END $$;
DO $$ DECLARE d text; BEGIN
 SELECT pg_get_functiondef('public.create_challenge_order(uuid,uuid,jsonb,text)'::regprocedure) INTO d;
 d:=replace(d,'active_fee_rule_for_plan(''challenge''','active_fee_rule_for_plan(''resource'''); EXECUTE d;
 SELECT pg_get_functiondef('public.enroll_challenge(uuid,jsonb)'::regprocedure) INTO d;
 d:=replace(d,'IF c.is_paid THEN','UPDATE orders SET status=''cancelled'',updated_at=now() WHERE challenge_id=_c AND status=''pending'' AND reservation_expires_at<=now(); IF c.is_paid THEN');
 d:=replace(d,')>=c.capacity',')+(SELECT count(*) FROM orders WHERE challenge_id=_c AND status=''pending'')>=c.capacity');
 d:=replace(d,'IF a->>''inventory'' IS NOT NULL AND used+qty','used:=used+coalesce((SELECT sum(i.quantity) FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.challenge_id=_c AND o.status=''pending'' AND i.addon_key=s->>''id''),0); IF a->>''inventory'' IS NOT NULL AND used+qty'); EXECUTE d;
END $$;
CREATE OR REPLACE FUNCTION public.challenge_order_revoke_free_extras_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NEW.source='order' AND NEW.access_status='active' AND NOT EXISTS(SELECT 1 FROM orders WHERE id=NEW.order_id AND status IN('paid','partially_refunded') AND buyer_user_id=NEW.user_id AND challenge_id=NEW.challenge_id AND stripe_payment_intent_id IS NOT NULL) THEN RAISE EXCEPTION 'payment_required'; END IF; RETURN NEW; END $$;
CREATE TRIGGER challenge_order_membership_guard BEFORE INSERT OR UPDATE ON public.challenge_members FOR EACH ROW EXECUTE FUNCTION public.challenge_order_revoke_free_extras_guard();