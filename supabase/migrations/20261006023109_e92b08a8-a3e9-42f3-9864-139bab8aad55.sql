DO $do$ DECLARE d text; n text; BEGIN
  d := pg_get_functiondef('public.gathering_validate(jsonb)'::regprocedure);
  n := replace(d, 'NOT IN (''public'',''team'')', 'NOT IN (''public'',''team'',''invite'')');
  IF n = d THEN RAISE EXCEPTION 'patch failed'; END IF; EXECUTE n;
END $do$;