-- Run only after installing actual repository functions on a disposable test schema.
BEGIN;
DO $$ BEGIN
 IF current_setting('app.disposable_database',true) IS DISTINCT FROM 'YES' THEN RAISE EXCEPTION 'disposable_copy_required'; END IF;
END $$;
INSERT INTO events(id,host_id,status) VALUES('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000011','published');
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM events WHERE platform_agreement_en IS NOT NULL OR platform_agreement_es IS NOT NULL) THEN RAISE EXCEPTION 'invented_platform_pin'; END IF;
END $$;
-- Test references, not invented legal text; approved fixtures never leave this transaction.
INSERT INTO consent_text_versions(id,kind,locale,version,body_sha256,approved_at,approval_reference,document_url,effective_from) VALUES
 ('00000000-0000-0000-0000-000000000021','event_agreement','en',1,'ZZ-TEST-HASH-EN',now(),'ZZ-TEST isolated reference','https://example.invalid/ZZ-TEST-en',now()),
 ('00000000-0000-0000-0000-000000000022','event_agreement','es',1,'ZZ-TEST-HASH-ES',now(),'ZZ-TEST isolated reference','https://example.invalid/ZZ-TEST-es',now());
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM events WHERE platform_agreement_en='00000000-0000-0000-0000-000000000021' AND platform_agreement_es='00000000-0000-0000-0000-000000000022') THEN RAISE EXCEPTION 'auto_pin_missing'; END IF;
 BEGIN UPDATE events SET platform_agreement_en=NULL; RAISE EXCEPTION 'pin_rewrite_allowed'; EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'agreement_pinned' THEN RAISE; END IF; END;
END $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000011',true);
DO $$ DECLARE w uuid; a uuid; BEGIN
 w:=save_host_form('00000000-0000-0000-0000-000000000031',NULL,'ZZ-TEST host document','','waiver','ZZ-TEST original text','ZZ-TEST texto');
 INSERT INTO events(id,host_id,status) VALUES('00000000-0000-0000-0000-000000000002',auth.uid(),'draft');
 a:=attach_library_waiver('00000000-0000-0000-0000-000000000002',w,1);
 PERFORM save_host_form('00000000-0000-0000-0000-000000000031',w,'ZZ-TEST replacement','','waiver','ZZ-TEST replacement text','ZZ-TEST texto nuevo');
 IF (SELECT body_en FROM waiver_library_versions WHERE waiver_id=w AND version=1)<>'ZZ-TEST original text' OR (SELECT library_version FROM event_waivers WHERE id=a)<>1 THEN RAISE EXCEPTION 'replacement_rewrites_attachment'; END IF;
 IF attach_library_waiver('00000000-0000-0000-0000-000000000002',w,1)<>a THEN RAISE EXCEPTION 'retry_not_idempotent'; END IF;
 UPDATE events SET status='published',agreements_locked=true WHERE id='00000000-0000-0000-0000-000000000002';
 BEGIN PERFORM attach_library_waiver('00000000-0000-0000-0000-000000000002',w,2); RAISE EXCEPTION 'published_reselection_allowed'; EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'waiver_pinned' THEN RAISE; END IF; END;
 PERFORM save_host_form('00000000-0000-0000-0000-000000000031',w,'ZZ-TEST replacement','','waiver','ZZ-TEST replacement text','ZZ-TEST texto nuevo',NULL,NULL,true);
 IF (SELECT library_version FROM event_waivers WHERE id=a)<>1 THEN RAISE EXCEPTION 'archive_rewrites_attachment'; END IF;
 PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000012',true);
 BEGIN PERFORM save_host_form('00000000-0000-0000-0000-000000000031',w,'ZZ-TEST outsider','','waiver','ZZ-TEST bad',''); RAISE EXCEPTION 'outsider_edit_allowed'; EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'forbidden' THEN RAISE; END IF; END;
 BEGIN PERFORM attach_library_waiver('00000000-0000-0000-0000-000000000002',w,1); RAISE EXCEPTION 'outsider_attach_allowed'; EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'forbidden' THEN RAISE; END IF; END;
END $$;
DO $$ DECLARE w uuid; payload jsonb; BEGIN
 SELECT id INTO w FROM event_waivers LIMIT 1;
 payload:=jsonb_build_array(jsonb_build_object('id',w,'version',1));
 BEGIN PERFORM check_event_waivers('00000000-0000-0000-0000-000000000002','[]'); RAISE EXCEPTION 'unchecked_allowed'; EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'waiver_required' THEN RAISE; END IF; END;
 BEGIN PERFORM check_event_waivers('00000000-0000-0000-0000-000000000001',payload); RAISE EXCEPTION 'cross_event_allowed'; EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'waiver_stale' THEN RAISE; END IF; END;
 PERFORM check_event_waivers('00000000-0000-0000-0000-000000000002',payload);
 INSERT INTO rsvps(id,event_id,user_id) VALUES('00000000-0000-0000-0000-000000000041','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000051');
 PERFORM store_event_waivers('00000000-0000-0000-0000-000000000041',payload,'rsvp','');
 PERFORM store_event_waivers('00000000-0000-0000-0000-000000000041',payload,'rsvp','');
 IF (SELECT count(*) FROM event_waiver_acceptances)<>1 OR NOT EXISTS(SELECT 1 FROM event_waiver_acceptances a JOIN event_waiver_versions v ON v.waiver_id=a.waiver_id AND v.version=a.version AND v.content_sha256=a.content_sha256 WHERE a.user_id='00000000-0000-0000-0000-000000000051' AND a.accepted_at IS NOT NULL) THEN RAISE EXCEPTION 'receipt_not_bound'; END IF;
END $$;
ROLLBACK;
SELECT 'zero fixtures' AS cleanup WHERE NOT EXISTS(SELECT 1 FROM events) AND NOT EXISTS(SELECT 1 FROM waiver_library) AND NOT EXISTS(SELECT 1 FROM event_waiver_acceptances) AND NOT EXISTS(SELECT 1 FROM consent_text_versions);