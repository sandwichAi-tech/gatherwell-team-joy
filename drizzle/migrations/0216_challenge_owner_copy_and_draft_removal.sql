CREATE OR REPLACE FUNCTION public.duplicate_challenge(_c uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE c challenges; a jsonb; m jsonb; BEGIN
 IF NOT public.can_manage_challenge(_c) THEN RAISE EXCEPTION 'not_allowed'; END IF;
 SELECT * INTO c FROM challenges WHERE id=_c FOR SHARE;
 SELECT coalesce(jsonb_agg(to_jsonb(x)-'id'-'challenge_id' ORDER BY sort_order),'[]') INTO a FROM challenge_activities x WHERE challenge_id=_c;
 SELECT coalesce(jsonb_agg((to_jsonb(x)-'id'-'challenge_id')||jsonb_build_object('enabled',false,'paused',false) ORDER BY sort_order),'[]') INTO m FROM challenge_messages x WHERE challenge_id=_c;
 RETURN public.save_challenge(NULL,c.team_id,to_jsonb(c)||jsonb_build_object('status','draft'),a,m);
END $$;
CREATE OR REPLACE FUNCTION public.delete_challenge_draft(_c uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE c challenges; BEGIN
 SELECT * INTO c FROM challenges WHERE id=_c FOR UPDATE;
 IF NOT FOUND OR NOT public.can_manage_challenge(_c) OR c.status<>'draft' THEN RAISE EXCEPTION 'not_allowed'; END IF;
 DELETE FROM challenges WHERE id=_c;
END $$;
REVOKE ALL ON FUNCTION public.duplicate_challenge(uuid),public.delete_challenge_draft(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.duplicate_challenge(uuid),public.delete_challenge_draft(uuid) TO authenticated;
COMMENT ON FUNCTION public.duplicate_challenge(uuid) IS 'Owner-only independent draft configuration copy, never memberships/orders/progress; copied messages disabled.';
DO $$ DECLARE d text; BEGIN d:=pg_get_functiondef('public.challenge_history_guard()'::regprocedure); d:=replace(d,'IF auth.uid() IS NOT NULL AND (','IF auth.uid() IS NOT NULL AND (OLD.status<>''draft'' OR '); EXECUTE d; END $$;