CREATE TABLE public.ai_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  feature text NOT NULL,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ai_usage TO authenticated;
GRANT ALL ON public.ai_usage TO service_role;
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own usage read" ON public.ai_usage FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE INDEX ai_usage_user_month ON public.ai_usage (user_id, created_at);

CREATE OR REPLACE FUNCTION public.ai_usage_status()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _plan text; _used int; _limit int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_signed_in'; END IF;
  SELECT t.plan INTO _plan FROM profiles p JOIN teams t ON t.id = p.active_team_id WHERE p.id = _uid;
  _plan := coalesce(_plan, 'free');
  _limit := CASE _plan WHEN 'pro' THEN 2000 WHEN 'growth' THEN 500 WHEN 'team' THEN 500 ELSE 50 END;
  SELECT count(*) INTO _used FROM ai_usage WHERE user_id = _uid AND created_at >= date_trunc('month', now());
  RETURN jsonb_build_object('plan', _plan, 'used', _used, 'limit', _limit);
END $$;
REVOKE ALL ON FUNCTION public.ai_usage_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ai_usage_status() TO authenticated;

CREATE OR REPLACE FUNCTION public.record_ai_usage(_feature text, _input integer, _output integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_signed_in'; END IF;
  IF _feature NOT IN ('assistant','translate') THEN RAISE EXCEPTION 'invalid_feature'; END IF;
  INSERT INTO ai_usage (user_id, feature, input_tokens, output_tokens)
  VALUES (auth.uid(), _feature, greatest(coalesce(_input,0),0), greatest(coalesce(_output,0),0));
END $$;
REVOKE ALL ON FUNCTION public.record_ai_usage(text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_ai_usage(text, integer, integer) TO authenticated;

-- Personal recipes saved from the assistant: visible only to their owner.
ALTER TABLE public.recipes ADD COLUMN private_owner uuid;
DROP POLICY "Read shared and team recipes" ON public.recipes;
CREATE POLICY "Read shared and team recipes" ON public.recipes FOR SELECT TO authenticated
  USING ((team_id IS NULL AND private_owner IS NULL) OR private_owner = auth.uid() OR can_use_team_templates(team_id) OR is_team_member(team_id, ARRAY['leader']));

CREATE OR REPLACE FUNCTION public.save_assistant_recipe(_title_en text, _title_es text, _prep integer, _ingredients jsonb, _steps jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_signed_in'; END IF;
  IF coalesce(trim(_title_en),'') = '' AND coalesce(trim(_title_es),'') = '' THEN RAISE EXCEPTION 'invalid_title'; END IF;
  IF has_blocked_claim(coalesce(_title_en,'') || ' ' || coalesce(_title_es,'') || ' ' || coalesce(_ingredients::text,'') || ' ' || coalesce(_steps::text,'')) THEN RAISE EXCEPTION 'blocked_claim'; END IF;
  INSERT INTO recipes (team_id, private_owner, title_en, title_es, prep_minutes, tags, ingredients, steps, created_by)
  VALUES (NULL, _uid, left(coalesce(_title_en,''),120), left(coalesce(_title_es,''),120),
          CASE WHEN _prep BETWEEN 1 AND 600 THEN _prep END, ARRAY[]::text[],
          coalesce(_ingredients,'{}'::jsonb), coalesce(_steps,'{}'::jsonb), _uid)
  RETURNING id INTO _id;
  INSERT INTO saved_recipes (user_id, recipe_id) VALUES (_uid, _id) ON CONFLICT DO NOTHING;
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.save_assistant_recipe(text, text, integer, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_assistant_recipe(text, text, integer, jsonb, jsonb) TO authenticated;