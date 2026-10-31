-- Explicit local/disposable execution only. Uses actual assessment RPCs/triggers.
-- Requires the relevant schema. This sprint executed it with minimal stand-in
-- quizzes/lesson tables and quiz_access_error, not full hosted auth/entitlements.
BEGIN;
DO $$ BEGIN
 IF current_setting('app.disposable_database',true) IS DISTINCT FROM 'YES' THEN RAISE EXCEPTION 'disposable_copy_required'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000120',true);
INSERT INTO quizzes(id,host_id,assessment_config,assessment_revision,is_published) VALUES
('00000000-0000-0000-0000-000000000121','00000000-0000-0000-0000-000000000120',
'{"kind":"wellness_assessment","title_en":"ZZ-TEST assessment","title_es":"","language":"en","allow_retake":false,"questions":[{"id":"q1","type":"single","prompt":"ZZ-TEST first","scored":true,"weight":1,"options":[{"id":"a","label":"A","value":0},{"id":"b","label":"B","value":100}]},{"id":"q2","type":"single","prompt":"ZZ-TEST second","scored":false,"weight":3,"options":[{"id":"a","label":"A","value":0},{"id":"b","label":"B","value":100}]}],"results":[{"id":"r","min":0,"max":100,"title":"ZZ-TEST result","body":"Fixture only","url":""}]}',1,false);
DO $$ BEGIN
 BEGIN PERFORM publish_wellness_assessment_checked('00000000-0000-0000-0000-000000000121','00000000-0000-0000-0000-000000000122',1); RAISE EXCEPTION 'missing_scope_accepted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'approved_assessment_content_required' THEN RAISE; END IF; END;
END $$;
INSERT INTO assessment_scope_versions(id,locale,version,document_text,document_hash,approval_reference) VALUES
('00000000-0000-0000-0000-000000000122','en',1,'ZZ-TEST fixture only, not approved legal content','ZZ-TEST','ZZ-TEST isolated approval');
SELECT publish_wellness_assessment_checked('00000000-0000-0000-0000-000000000121','00000000-0000-0000-0000-000000000122',1);
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000123',true);
DO $$ DECLARE r jsonb; again jsonb; BEGIN
 BEGIN PERFORM complete_wellness_assessment('00000000-0000-0000-0000-000000000121','00000000-0000-0000-0000-000000000124',1,'00000000-0000-0000-0000-000000000122',false,'{"q1":["b"],"q2":["a"]}'); RAISE EXCEPTION 'consent_bypassed';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'approved_assessment_content_required' THEN RAISE; END IF; END;
 BEGIN PERFORM complete_wellness_assessment('00000000-0000-0000-0000-000000000121','00000000-0000-0000-0000-000000000124',1,'00000000-0000-0000-0000-000000000122',true,'{"q1":["a","b"],"q2":["a"]}'); RAISE EXCEPTION 'multiple_single_choices_accepted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'invalid_answers' THEN RAISE; END IF; END;
 r:=complete_wellness_assessment('00000000-0000-0000-0000-000000000121','00000000-0000-0000-0000-000000000124',1,'00000000-0000-0000-0000-000000000122',true,'{"q1":["b"],"q2":["a"]}');
 IF (r->>'score')::integer<>100 THEN RAISE EXCEPTION 'unscored_question_changed_result'; END IF;
 again:=complete_wellness_assessment('00000000-0000-0000-0000-000000000121','00000000-0000-0000-0000-000000000124',1,'00000000-0000-0000-0000-000000000122',true,'{"q1":["b"],"q2":["a"]}');
 IF r->>'id' IS DISTINCT FROM again->>'id' THEN RAISE EXCEPTION 'retry_duplicated'; END IF;
 BEGIN PERFORM complete_wellness_assessment('00000000-0000-0000-0000-000000000121','00000000-0000-0000-0000-000000000124',1,'00000000-0000-0000-0000-000000000122',true,'{"q1":["a"],"q2":["a"]}'); RAISE EXCEPTION 'changed_retry_accepted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'request_changed' THEN RAISE; END IF; END;
 BEGIN PERFORM complete_wellness_assessment('00000000-0000-0000-0000-000000000121','00000000-0000-0000-0000-000000000125',1,'00000000-0000-0000-0000-000000000122',true,'{"q1":["b"],"q2":["a"]}'); RAISE EXCEPTION 'retake_accepted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'retake_not_allowed' THEN RAISE; END IF; END;
END $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000120',true);
DO $$ BEGIN
 BEGIN PERFORM complete_wellness_assessment('00000000-0000-0000-0000-000000000121','00000000-0000-0000-0000-000000000125',1,'00000000-0000-0000-0000-000000000122',true,'{}'); RAISE EXCEPTION 'author_receipt_created';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'not_allowed' THEN RAISE; END IF; END;
END $$;
ROLLBACK;
SELECT 'ZZ-TEST fixtures rolled back' AS cleanup;