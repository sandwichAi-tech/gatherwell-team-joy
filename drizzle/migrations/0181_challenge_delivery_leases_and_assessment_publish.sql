ALTER TABLE public.provider_events ADD COLUMN processing_token uuid, ADD COLUMN lease_until timestamptz;
CREATE OR REPLACE FUNCTION public.claim_challenge_provider_event(_environment text,_event text,_type text,_hash text,_token uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE e provider_events; BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' OR _environment NOT IN('sandbox','live') OR _token IS NULL OR _event IS NULL OR _hash IS NULL THEN RAISE EXCEPTION 'not_allowed'; END IF;
 INSERT INTO provider_events(provider,environment,provider_event_id,event_type,payload_sha256,processing_token,lease_until) VALUES('stripe',_environment,_event,_type,_hash,_token,now()+interval '2 minutes') ON CONFLICT(provider,environment,provider_event_id) DO NOTHING;
 SELECT * INTO e FROM provider_events WHERE provider='stripe' AND environment=_environment AND provider_event_id=_event FOR UPDATE;
 IF e.payload_sha256 IS DISTINCT FROM _hash OR e.event_type IS DISTINCT FROM _type THEN RAISE EXCEPTION 'payment_unverified'; END IF;
 IF e.status IN('processed','ignored') THEN RETURN 'duplicate'; END IF;
 IF e.processing_token=_token THEN RETURN 'claimed'; END IF;
 IF e.status='received' AND e.lease_until>now() THEN RETURN 'busy'; END IF;
 UPDATE provider_events SET status='received',processing_token=_token,lease_until=now()+interval '2 minutes',attempts=attempts+1,error=NULL WHERE id=e.id; RETURN 'claimed'; END $$;
REVOKE ALL ON FUNCTION public.claim_challenge_provider_event(text,text,text,text,uuid) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.claim_challenge_provider_event(text,text,text,text,uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.finish_challenge_provider_event(_environment text,_event text,_token uuid,_succeeded boolean) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'not_allowed'; END IF;
 UPDATE provider_events SET status=CASE WHEN _succeeded THEN 'processed' ELSE 'failed' END,processed_at=CASE WHEN _succeeded THEN now() ELSE NULL END,lease_until=NULL,error=CASE WHEN _succeeded THEN NULL ELSE 'processing_failed' END WHERE provider='stripe' AND environment=_environment AND provider_event_id=_event AND processing_token=_token AND status='received'; RETURN FOUND; END $$;
REVOKE ALL ON FUNCTION public.finish_challenge_provider_event(text,text,uuid,boolean) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.finish_challenge_provider_event(text,text,uuid,boolean) TO service_role;
CREATE OR REPLACE FUNCTION public.release_challenge_checkout(_order uuid,_state text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE o orders; BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' OR _state NOT IN('cancelled','failed') THEN RAISE EXCEPTION 'not_allowed'; END IF;
 SELECT * INTO o FROM orders WHERE id=_order AND offering_type='challenge'; IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
 PERFORM 1 FROM challenges WHERE id=o.challenge_id FOR UPDATE;
 UPDATE orders SET status=_state,reservation_expires_at=now(),updated_at=now() WHERE id=_order AND status='pending'; END $$;
REVOKE ALL ON FUNCTION public.release_challenge_checkout(uuid,text) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.release_challenge_checkout(uuid,text) TO service_role;
CREATE OR REPLACE FUNCTION public.publish_wellness_assessment_checked(_quiz uuid,_scope uuid,_revision integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE q quizzes; BEGIN
 SELECT * INTO q FROM quizzes WHERE id=_quiz FOR UPDATE;
 IF auth.uid() IS NULL OR q.host_id IS DISTINCT FROM auth.uid() OR q.assessment_config IS NULL THEN RAISE EXCEPTION 'not_allowed'; END IF;
 IF q.assessment_revision<>_revision THEN RAISE EXCEPTION 'assessment_changed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM assessment_scope_versions WHERE id=_scope AND retired_at IS NULL AND locale=q.assessment_config->>'language') THEN RAISE EXCEPTION 'approved_assessment_content_required'; END IF;
 UPDATE quizzes SET assessment_scope_id=_scope,is_published=true WHERE id=_quiz;
 IF q.lesson_id IS NOT NULL THEN UPDATE lessons SET is_published=true WHERE id=q.lesson_id AND detached_at IS NULL; END IF;
 END $$;
REVOKE ALL ON FUNCTION public.publish_wellness_assessment_checked(uuid,uuid,integer) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.publish_wellness_assessment_checked(uuid,uuid,integer) TO authenticated;