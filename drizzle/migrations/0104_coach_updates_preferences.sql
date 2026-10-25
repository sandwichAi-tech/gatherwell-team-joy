CREATE TABLE public.coach_subscriptions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),coach_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 email text NOT NULL,language text NOT NULL DEFAULT 'en',announcements boolean NOT NULL DEFAULT false,new_events boolean NOT NULL DEFAULT false,new_resources boolean NOT NULL DEFAULT false,
 confirmed_at timestamptz,token_hash text NOT NULL,token_expires_at timestamptz NOT NULL DEFAULT now()+interval '7 days',created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(coach_id,email)
);
GRANT ALL ON public.coach_subscriptions TO service_role;
ALTER TABLE public.coach_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.request_coach_updates(_slug text,_email text,_language text,_announcements boolean,_events boolean,_resources boolean,_adult boolean,_base text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE host uuid; token text; sub uuid; link text;
BEGIN
 IF NOT _adult OR NOT (_announcements OR _events OR _resources) THEN RAISE EXCEPTION 'consent_required'; END IF;
 IF length(_email)>254 OR _email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'invalid_email'; END IF;
 SELECT id INTO host FROM profiles WHERE slug=_slug AND host_public AND role_intent IN ('host','leader');
 IF host IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
 IF (SELECT count(*) FROM coach_subscriptions WHERE email=lower(trim(_email)) AND updated_at>now()-interval '1 hour')>=3 OR EXISTS(SELECT 1 FROM coach_subscriptions WHERE coach_id=host AND email=lower(trim(_email)) AND updated_at>now()-interval '5 minutes') THEN RAISE EXCEPTION 'rate_limited'; END IF;
 token:=encode(extensions.gen_random_bytes(32),'hex');
 INSERT INTO coach_subscriptions(coach_id,email,language,announcements,new_events,new_resources,token_hash)
 VALUES(host,lower(trim(_email)),CASE WHEN _language='es' THEN 'es' ELSE 'en' END,_announcements,_events,_resources,encode(extensions.digest(token,'sha256'),'hex'))
 ON CONFLICT(coach_id,email) DO UPDATE SET token_hash=EXCLUDED.token_hash,token_expires_at=now()+interval '7 days',updated_at=now()
 RETURNING id INTO sub;
 link:=_base||'/coach-updates/'||token;
 PERFORM public.enqueue_message('email',lower(trim(_email)),_language,'custom_message','transactional',jsonb_build_object('subject',CASE WHEN _language='es' THEN 'Confirma tus preferencias de ZoheeWell' ELSE 'Confirm your ZoheeWell preferences' END,'body',CASE WHEN _language='es' THEN 'Confirma y administra tus preferencias de este coach: ' ELSE 'Confirm and manage your preferences for this coach: ' END||link),now(),NULL,NULL,NULL,NULL,NULL);
END $$;
REVOKE ALL ON FUNCTION public.request_coach_updates(text,text,text,boolean,boolean,boolean,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.request_coach_updates(text,text,text,boolean,boolean,boolean,boolean,text) TO service_role;
CREATE OR REPLACE FUNCTION public.coach_update_preferences(_token text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s coach_subscriptions; name text;
BEGIN
 IF _token !~ '^[a-f0-9]{64}$' THEN RETURN NULL; END IF;
 SELECT * INTO s FROM coach_subscriptions WHERE token_hash=encode(extensions.digest(_token,'sha256'),'hex') AND token_expires_at>now();
 IF s.id IS NULL THEN RETURN NULL; END IF;
 SELECT full_name INTO name FROM profiles WHERE id=s.coach_id AND host_public;
 IF name IS NULL THEN RETURN NULL; END IF;
 RETURN jsonb_build_object('coach',name,'confirmed',s.confirmed_at IS NOT NULL,'announcements',s.announcements,'new_events',s.new_events,'new_resources',s.new_resources);
END $$;
REVOKE ALL ON FUNCTION public.coach_update_preferences(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.coach_update_preferences(text) TO anon,authenticated;
CREATE OR REPLACE FUNCTION public.save_coach_update_preferences(_token text,_announcements boolean,_events boolean,_resources boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF public.coach_update_preferences(_token) IS NULL THEN RAISE EXCEPTION 'invalid_token'; END IF;
 UPDATE coach_subscriptions SET announcements=_announcements,new_events=_events,new_resources=_resources,confirmed_at=coalesce(confirmed_at,now()),updated_at=now() WHERE token_hash=encode(extensions.digest(_token,'sha256'),'hex') AND token_expires_at>now();
END $$;
REVOKE ALL ON FUNCTION public.save_coach_update_preferences(text,boolean,boolean,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_coach_update_preferences(text,boolean,boolean,boolean) TO anon,authenticated;
CREATE OR REPLACE FUNCTION public.coach_subscriber_segments() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
 RETURN (SELECT jsonb_build_object('confirmed',count(*) FILTER(WHERE confirmed_at IS NOT NULL AND(announcements OR new_events OR new_resources)),'announcements',count(*) FILTER(WHERE confirmed_at IS NOT NULL AND announcements),'new_events',count(*) FILTER(WHERE confirmed_at IS NOT NULL AND new_events),'new_resources',count(*) FILTER(WHERE confirmed_at IS NOT NULL AND new_resources)) FROM coach_subscriptions WHERE coach_id=auth.uid());
END $$;
REVOKE ALL ON FUNCTION public.coach_subscriber_segments() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.coach_subscriber_segments() TO authenticated;
