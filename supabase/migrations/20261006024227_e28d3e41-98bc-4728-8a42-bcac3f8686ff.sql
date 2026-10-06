DO $do$ DECLARE d text; n text; BEGIN
  d := pg_get_functiondef('public.post_comment(uuid,uuid,uuid,text,uuid[])'::regprocedure);
  n := replace(d, 'DECLARE _uid uuid := auth.uid(); _team uuid; _id uuid; p record;', 'DECLARE _uid uuid := auth.uid(); _team uuid; _id uuid; p public.comments;');
  IF n = d THEN RAISE EXCEPTION 'patch failed'; END IF; EXECUTE n;
END $do$;