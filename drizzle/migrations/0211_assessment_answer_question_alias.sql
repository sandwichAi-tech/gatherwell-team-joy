DO $$ DECLARE definition text; BEGIN
 SELECT pg_get_functiondef('public.complete_wellness_assessment(uuid,uuid,integer,uuid,boolean,jsonb)'::regprocedure) INTO definition;
 IF position('jsonb_array_elements(z.assessment_config->''questions'') q WHERE q->>''id''=k' in definition) = 0 THEN RAISE EXCEPTION 'assessment_function_shape_changed'; END IF;
 definition := replace(definition, 'jsonb_array_elements(z.assessment_config->''questions'') q WHERE q->>''id''=k', 'jsonb_array_elements(z.assessment_config->''questions'') AS question_entry(value) WHERE question_entry.value->>''id''=k');
 EXECUTE definition;
END $$;