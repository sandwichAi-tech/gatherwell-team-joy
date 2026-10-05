DO $migration$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef(oid) INTO definition FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = 'report_content';
 IF definition IS NULL THEN RAISE EXCEPTION 'report_content_missing'; END IF;
 definition := replace(definition,
 'IF (SELECT count(*) FROM rsvp_attempts WHERE key = _ip AND created_at > now() - interval ''1 minute'') >= 10 THEN RAISE EXCEPTION ''rate_limited''; END IF;',
 'PERFORM pg_advisory_xact_lock(hashtextextended(_ip, 0));
  IF (SELECT count(*) FROM rsvp_attempts WHERE key = _ip AND created_at > clock_timestamp() - interval ''1 minute'') >= 5 THEN RAISE EXCEPTION ''rate_limited''; END IF;');
 IF position('>= 5' in definition) = 0 THEN RAISE EXCEPTION 'report_limit_patch_missing'; END IF;
 EXECUTE definition;
END;
$migration$;