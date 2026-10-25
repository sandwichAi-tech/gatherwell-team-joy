ALTER TABLE public.coach_subscriptions ADD COLUMN user_id uuid REFERENCES public.profiles(id);
ALTER TABLE public.coach_subscriptions ADD COLUMN pending_preferences jsonb;
ALTER TABLE public.coach_subscriptions ADD COLUMN confirmation_hash text;
ALTER TABLE public.coach_subscriptions ADD COLUMN confirmation_expires_at timestamptz;
COMMENT ON COLUMN public.coach_subscriptions.pending_preferences IS 'Unconfirmed preferences; never counted as consent until email ownership is verified.';
CREATE OR REPLACE FUNCTION public.request_coach_updates(_slug text,_email text,_language text,_announcements boolean,_events boolean,_resources boolean,_adult boolean,_base text,_send_confirmation boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE host uuid; token text; sub uuid; link text;
BEGIN
 IF NOT _adult OR NOT (_announcements OR _events OR _resources) THEN RAISE EXCEPTION 'consent_required'; END IF;
 IF length(_email)>254 OR _email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'invalid_email'; END IF;
 IF _base NOT IN ('https://zoheewell.com','https://www.zoheewell.com','https://gatherwell-team-joy.lovable.app','https://id-preview--d56c15d9-a849-4fc3-a192-501da269084f.lovable.app','http://localhost:8080') THEN RAISE EXCEPTION 'invalid_origin'; END IF;
 SELECT id INTO host FROM profiles WHERE slug=_slug AND host_public AND role_intent IN ('host','leader');
 IF host IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
 IF (SELECT count(*) FROM coach_subscriptions WHERE email=lower(trim(_email)) AND updated_at>now()-interval '1 hour')>=3 OR EXISTS(SELECT 1 FROM coach_subscriptions WHERE coach_id=host AND email=lower(trim(_email)) AND updated_at>now()-interval '5 minutes') THEN RAISE EXCEPTION 'rate_limited'; END IF;
 token:=encode(extensions.gen_random_bytes(32),'hex');
 INSERT INTO coach_subscriptions(coach_id,email,language,token_hash,pending_preferences,confirmation_hash,confirmation_expires_at)
 VALUES(host,lower(trim(_email)),CASE WHEN _language='es' THEN 'es' ELSE 'en' END,encode(extensions.digest(encode(extensions.gen_random_bytes(32),'hex'),'sha256'),'hex'),jsonb_build_object('announcements',_announcements,'new_events',_events,'new_resources',_resources),CASE WHEN _send_confirmation THEN encode(extensions.digest(token,'sha256'),'hex') END,CASE WHEN _send_confirmation THEN now()+interval '7 days' END)
 ON CONFLICT(coach_id,email) DO UPDATE SET pending_preferences=EXCLUDED.pending_preferences,confirmation_hash=EXCLUDED.confirmation_hash,confirmation_expires_at=EXCLUDED.confirmation_expires_at,updated_at=now()
 RETURNING id INTO sub;
 IF _send_confirmation THEN
 link:=_base||'/coach-updates/'||token;
 PERFORM public.enqueue_message('email',lower(trim(_email)),_language,'custom_message','transactional',jsonb_build_object('subject',CASE WHEN _language='es' THEN 'Confirma tus preferencias de ZoheeWell' ELSE 'Confirm your ZoheeWell preferences' END,'body',CASE WHEN _language='es' THEN 'Confirma y administra tus preferencias de este coach: ' ELSE 'Confirm and manage your preferences for this coach: ' END||link),now(),NULL,NULL,NULL,NULL,NULL);
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.request_coach_updates(text,text,text,boolean,boolean,boolean,boolean,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.request_coach_updates(text,text,text,boolean,boolean,boolean,boolean,text,boolean) TO service_role;
CREATE OR REPLACE FUNCTION public.request_coach_updates(_slug text,_email text,_language text,_announcements boolean,_events boolean,_resources boolean,_adult boolean,_base text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN PERFORM public.request_coach_updates(_slug,_email,_language,_announcements,_events,_resources,_adult,_base,true); END $$;
CREATE OR REPLACE FUNCTION public.coach_update_preferences(_token text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s coach_subscriptions; prefs jsonb; name text; pending boolean;
BEGIN
 IF _token !~ '^[a-f0-9]{64}$' THEN RETURN NULL; END IF;
 SELECT * INTO s FROM coach_subscriptions WHERE (token_hash=encode(extensions.digest(_token,'sha256'),'hex') AND token_expires_at>now()) OR (confirmation_hash=encode(extensions.digest(_token,'sha256'),'hex') AND confirmation_expires_at>now());
 IF s.id IS NULL THEN RETURN NULL; END IF;
 SELECT full_name INTO name FROM profiles WHERE id=s.coach_id AND host_public;
 IF name IS NULL THEN RETURN NULL; END IF;
 pending:=s.confirmation_hash=encode(extensions.digest(_token,'sha256'),'hex');
 prefs:=CASE WHEN pending THEN s.pending_preferences ELSE jsonb_build_object('announcements',s.announcements,'new_events',s.new_events,'new_resources',s.new_resources) END;
 RETURN prefs||jsonb_build_object('coach',name,'confirmed',s.confirmed_at IS NOT NULL AND NOT coalesce(pending,false));
END $$;
CREATE OR REPLACE FUNCTION public.save_coach_update_preferences(_token text,_announcements boolean,_events boolean,_resources boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s coach_subscriptions; hash text:=encode(extensions.digest(_token,'sha256'),'hex');
BEGIN
 IF public.coach_update_preferences(_token) IS NULL THEN RAISE EXCEPTION 'invalid_token'; END IF;
 SELECT * INTO s FROM coach_subscriptions WHERE token_hash=hash OR confirmation_hash=hash FOR UPDATE;
 UPDATE coach_subscriptions SET announcements=_announcements,new_events=_events,new_resources=_resources,confirmed_at=CASE WHEN _announcements OR _events OR _resources THEN coalesce(confirmed_at,now()) ELSE confirmed_at END,
 token_hash=hash,token_expires_at=now()+interval '365 days',confirmation_hash=NULL,confirmation_expires_at=NULL,pending_preferences=NULL,updated_at=now() WHERE id=s.id;
END $$;
CREATE OR REPLACE FUNCTION public.save_my_coach_updates(_slug text,_announcements boolean,_events boolean,_resources boolean,_adult boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE host uuid; address text;
BEGIN
 IF auth.uid() IS NULL OR NOT _adult THEN RAISE EXCEPTION 'auth_required'; END IF;
 SELECT lower(email) INTO address FROM auth.users WHERE id=auth.uid() AND email_confirmed_at IS NOT NULL;
 IF address IS NULL THEN RAISE EXCEPTION 'email_confirmation_required'; END IF;
 SELECT id INTO host FROM profiles WHERE slug=_slug AND host_public AND role_intent IN ('host','leader');
 IF host IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
 INSERT INTO coach_subscriptions(coach_id,email,user_id,announcements,new_events,new_resources,confirmed_at,token_hash)
 VALUES(host,address,auth.uid(),_announcements,_events,_resources,now(),encode(extensions.digest(encode(extensions.gen_random_bytes(32),'hex'),'sha256'),'hex'))
 ON CONFLICT(coach_id,email) DO UPDATE SET user_id=auth.uid(),announcements=_announcements,new_events=_events,new_resources=_resources,confirmed_at=coalesce(coach_subscriptions.confirmed_at,now()),updated_at=now(),pending_preferences=NULL,confirmation_hash=NULL,confirmation_expires_at=NULL;
END $$;
REVOKE ALL ON FUNCTION public.save_my_coach_updates(text,boolean,boolean,boolean,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_my_coach_updates(text,boolean,boolean,boolean,boolean) TO authenticated;
CREATE OR REPLACE FUNCTION public.my_coach_updates(_slug text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE address text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
 SELECT lower(email) INTO address FROM auth.users WHERE id=auth.uid() AND email_confirmed_at IS NOT NULL;
 RETURN (SELECT jsonb_build_object('coach',p.full_name,'confirmed',s.confirmed_at IS NOT NULL,'announcements',s.announcements,'new_events',s.new_events,'new_resources',s.new_resources) FROM coach_subscriptions s JOIN profiles p ON p.id=s.coach_id WHERE p.slug=_slug AND p.host_public AND s.email=address);
END $$;
REVOKE ALL ON FUNCTION public.my_coach_updates(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.my_coach_updates(text) TO authenticated;