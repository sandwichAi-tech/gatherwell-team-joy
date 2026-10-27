ALTER TABLE public.refunds ADD COLUMN allocation_required boolean NOT NULL DEFAULT false;
CREATE OR REPLACE FUNCTION public.record_unallocated_challenge_refund(_order uuid,_refund text,_amount integer,_status text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' OR _status NOT IN('pending','failed','succeeded') OR NOT EXISTS(SELECT 1 FROM orders WHERE id=_order AND offering_type='challenge' AND gross_cents>=_amount) THEN RAISE EXCEPTION 'not_allowed'; END IF;
 INSERT INTO refunds(order_id,idempotency_key,reason,amount_cents,status,stripe_refund_id,allocation_required) VALUES(_order,'challenge-refund:'||_refund,'other',_amount,_status,_refund,true) ON CONFLICT(stripe_refund_id) DO UPDATE SET status=CASE WHEN refunds.status='succeeded' THEN refunds.status ELSE EXCLUDED.status END;
 IF _status='succeeded' THEN UPDATE orders SET status='disputed',updated_at=now() WHERE id=_order AND status IN('paid','partially_refunded'); END IF;
 END $$;
REVOKE ALL ON FUNCTION public.record_unallocated_challenge_refund(uuid,text,integer,text) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.record_unallocated_challenge_refund(uuid,text,integer,text) TO service_role;
CREATE OR REPLACE FUNCTION public.revoke_challenge_order(_intent text,_environment text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE oid uuid; BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'not_allowed'; END IF;
 UPDATE orders SET status='disputed',updated_at=now() WHERE offering_type='challenge' AND stripe_payment_intent_id=_intent AND environment=_environment RETURNING id INTO oid;
 IF oid IS NOT NULL THEN UPDATE challenge_members SET access_status='revoked' WHERE order_id=oid; END IF;
 END $$;
REVOKE ALL ON FUNCTION public.revoke_challenge_order(text,text) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.revoke_challenge_order(text,text) TO service_role;
CREATE OR REPLACE FUNCTION public.guard_course_reference() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE owner uuid; BEGIN
 SELECT o.host_id INTO owner FROM tracks t JOIN offers o ON o.id=t.offer_id WHERE t.id=NEW.track_id;
 IF num_nonnulls(NEW.resource_quiz_id,NEW.resource_offer_id,NEW.resource_recipe_id)>1 THEN RAISE EXCEPTION 'invalid_resource'; END IF;
 IF NEW.resource_quiz_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM quizzes WHERE id=NEW.resource_quiz_id AND host_id=owner) THEN RAISE EXCEPTION 'not_allowed'; END IF;
 IF NEW.resource_offer_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM offers WHERE id=NEW.resource_offer_id AND host_id=owner AND kind='download') THEN RAISE EXCEPTION 'not_allowed'; END IF;
 IF NEW.resource_recipe_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM recipes WHERE id=NEW.resource_recipe_id AND created_by=owner) THEN RAISE EXCEPTION 'not_allowed'; END IF;
 IF NEW.detached_at IS NOT NULL AND NEW.is_published THEN RAISE EXCEPTION 'detached_item'; END IF;
 RETURN NEW; END $$;
CREATE TRIGGER course_reference_guard BEFORE INSERT OR UPDATE ON public.lessons FOR EACH ROW EXECUTE FUNCTION public.guard_course_reference();
CREATE OR REPLACE FUNCTION public.publish_wellness_assessment(_quiz uuid,_scope uuid,_revision integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 PERFORM 1 FROM quizzes WHERE id=_quiz AND host_id=auth.uid() AND assessment_config IS NOT NULL AND assessment_revision=_revision FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'not_allowed'; END IF;
 UPDATE quizzes SET assessment_scope_id=_scope,is_published=true WHERE id=_quiz;
 END $$;
REVOKE ALL ON FUNCTION public.publish_wellness_assessment(uuid,uuid,integer) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.publish_wellness_assessment(uuid,uuid,integer) TO authenticated;