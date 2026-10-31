-- Explicitly invoke only on an independently disposable database; never shared preview.
BEGIN;
DO $$ BEGIN IF current_setting('app.disposable_database',true) IS DISTINCT FROM 'YES' THEN RAISE EXCEPTION 'disposable_database_required'; END IF; END $$;
-- Minimal fixture columns work with the isolated stand-in dependencies; full-schema fixture provisioning remains separate.
INSERT INTO events(id,host_id,team_id,status,capacity,platform_agreement_en,platform_agreement_es) VALUES
('10700000-0000-0000-0000-000000000001','10700000-0000-0000-0000-000000000011','10700000-0000-0000-0000-000000000021','published',4,'10700000-0000-0000-0000-000000000031','10700000-0000-0000-0000-000000000032');
INSERT INTO consent_text_versions(id,body_sha256) VALUES ('10700000-0000-0000-0000-000000000031','ZZ-TEST-HASH'),('10700000-0000-0000-0000-000000000032','ZZ-TEST-HASH-ES');
INSERT INTO rsvps(id,event_id,guest_name,guest_email,status,plus_ones,is_walk_in,walkin_request_id) VALUES
('10700000-0000-0000-0000-000000000041','10700000-0000-0000-0000-000000000001','ZZ-TEST Existing','zz-test@example.invalid','going',1,true,'10700000-0000-0000-0000-000000000051'),
('10700000-0000-0000-0000-000000000042','10700000-0000-0000-0000-000000000001','ZZ-TEST Cancelled','zz-cancel@example.invalid','cancelled',2,false,NULL),
('10700000-0000-0000-0000-000000000043','10700000-0000-0000-0000-000000000001','ZZ-TEST Merged','zz-merged@example.invalid','going',0,false,NULL);
UPDATE rsvps SET merged_into_rsvp_id='10700000-0000-0000-0000-000000000041' WHERE id='10700000-0000-0000-0000-000000000043';
INSERT INTO platform_event_acceptances(rsvp_id,event_id,document_id,content_sha256) VALUES ('10700000-0000-0000-0000-000000000041','10700000-0000-0000-0000-000000000001','10700000-0000-0000-0000-000000000031','ZZ-TEST-HASH');
SELECT set_config('request.jwt.claim.sub','10700000-0000-0000-0000-000000000011',true);
DO $$ DECLARE e uuid:='10700000-0000-0000-0000-000000000001'; r uuid:='10700000-0000-0000-0000-000000000041'; req uuid:='10700000-0000-0000-0000-000000000051'; value jsonb; BEGIN
 value:=check_in_admission(r,false); IF value->>'result'<>'ok' THEN RAISE EXCEPTION 'initial_admission_failed'; END IF;
 IF check_in_admission(r,false)->>'result'<>'already' THEN RAISE EXCEPTION 'repeated_admission_not_idempotent'; END IF;
 IF walk_in_admit(e,req,'ZZ-TEST','','','zz-test@example.invalid','en')->>'result'<>'confirmed' THEN RAISE EXCEPTION 'retry_failed'; END IF;
 PERFORM check_in_admission(r,true);
 IF walk_in_admit(e,req,'ZZ-TEST','','','zz-test@example.invalid','en')->>'result'<>'existing' THEN RAISE EXCEPTION 'undo_replay_claimed_confirmed'; END IF;
 PERFORM check_in_admission(r,false);
 UPDATE rsvps SET checked_in_at=now() WHERE id='10700000-0000-0000-0000-000000000042';
 value:=attendance_totals(e); IF (value->>'registered')::int<>2 OR (value->>'checked_in')::int<>2 OR (value->>'walk_ins')::int<>2 THEN RAISE EXCEPTION 'inactive_or_merged_count_drift %',value; END IF;
 IF jsonb_array_length(checkin_guest_list(e))<>1 THEN RAISE EXCEPTION 'merged_list_leak'; END IF;
 UPDATE events SET price_cents=100 WHERE id=e;
 BEGIN PERFORM check_in_admission(r,false); RAISE EXCEPTION 'unpaid_admitted'; EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'payment_required' THEN RAISE; END IF; END;
 INSERT INTO payments(rsvp_id,event_id,status,stripe_payment_intent) VALUES(r,e,'failed','ZZ-TEST-INTENT');
 BEGIN PERFORM check_in_admission(r,false); RAISE EXCEPTION 'failed_payment_admitted'; EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'payment_required' THEN RAISE; END IF; END;
 UPDATE payments SET status='refunded';
 BEGIN PERFORM check_in_admission(r,false); RAISE EXCEPTION 'refund_admitted'; EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'payment_required' THEN RAISE; END IF; END;
 UPDATE events SET price_cents=0,requires_waiver=true WHERE id=e;
 BEGIN PERFORM check_in_admission(r,false); RAISE EXCEPTION 'waiver_bypassed'; EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'waiver_required' THEN RAISE; END IF; END;
 UPDATE events SET requires_waiver=false WHERE id=e;
 BEGIN PERFORM walk_in_admit(e,gen_random_uuid(),'ZZ-TEST New','','','zz-new@example.invalid','en'); RAISE EXCEPTION 'platform_acceptance_bypassed'; EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'platform_agreement_required' THEN RAISE; END IF; END;
 IF (SELECT count(*) FROM rsvps WHERE guest_email='zz-new@example.invalid')<>0 THEN RAISE EXCEPTION 'failed_walkin_left_row'; END IF;
 UPDATE events SET capacity=2 WHERE id=e;
 BEGIN PERFORM walk_in_admit(e,gen_random_uuid(),'ZZ-TEST Full','','','zz-full@example.invalid','en'); RAISE EXCEPTION 'capacity_bypassed'; EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'event_full' THEN RAISE; END IF; END;
 UPDATE events SET capacity=NULL WHERE id=e;
 IF attendance_totals(e)->>'remaining' IS NOT NULL THEN RAISE EXCEPTION 'unlimited_not_null'; END IF;
 UPDATE events SET ticket_tiers='[{"id":"ZZ-TEST-TIER","price_cents":0}]' WHERE id=e;
 BEGIN PERFORM walk_in_admit(e,gen_random_uuid(),'ZZ-TEST Tier','','','zz-tier@example.invalid','en'); RAISE EXCEPTION 'tier_bypassed'; EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'tier_required' THEN RAISE; END IF; END;
 UPDATE events SET ticket_tiers='[]',status='draft' WHERE id=e;
 BEGIN PERFORM walk_in_admit(e,req,'ZZ-TEST','','','zz-test@example.invalid','en'); RAISE EXCEPTION 'draft_admitted'; EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'not_open' THEN RAISE; END IF; END;
END $$;
INSERT INTO event_cohosts(event_id,user_id) VALUES ('10700000-0000-0000-0000-000000000001','10700000-0000-0000-0000-000000000012');
INSERT INTO team_members(team_id,user_id,workspace_role) VALUES ('10700000-0000-0000-0000-000000000021','10700000-0000-0000-0000-000000000013','checkin');
INSERT INTO workspace_assignments(team_id,user_id,scope_type,scope_id) VALUES ('10700000-0000-0000-0000-000000000021','10700000-0000-0000-0000-000000000013','event','10700000-0000-0000-0000-000000000001');
DO $$ DECLARE u uuid; BEGIN
 FOREACH u IN ARRAY ARRAY['10700000-0000-0000-0000-000000000012'::uuid,'10700000-0000-0000-0000-000000000013'::uuid] LOOP
 PERFORM set_config('request.jwt.claim.sub',u::text,true); IF NOT can_checkin_event('10700000-0000-0000-0000-000000000001') THEN RAISE EXCEPTION 'assigned_staff_denied'; END IF; END LOOP;
 FOREACH u IN ARRAY ARRAY['10700000-0000-0000-0000-000000000014'::uuid,'10700000-0000-0000-0000-000000000015'::uuid,NULL::uuid] LOOP
 PERFORM set_config('request.jwt.claim.sub',coalesce(u::text,''),true);
 BEGIN PERFORM attendance_totals('10700000-0000-0000-0000-000000000001'); RAISE EXCEPTION 'outsider_counts'; EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'not_allowed' THEN RAISE; END IF; END;
 BEGIN PERFORM check_in_admission('10700000-0000-0000-0000-000000000041',false); RAISE EXCEPTION 'outsider_admit'; EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'not_allowed' THEN RAISE; END IF; END;
 END LOOP;
END $$;
ROLLBACK;