\set ON_ERROR_STOP on
-- Explicit opt-in only. Not imported by Vitest or the application.
BEGIN;
DO $$ BEGIN
 IF current_setting('app.disposable_database',true) IS DISTINCT FROM 'YES' THEN
   RAISE EXCEPTION 'Run only on a disposable database copy with app.disposable_database=YES';
 END IF;
END $$;

-- All IDs and rows are isolated; fixtures need a privileged disposable-copy session.
-- Do not disable triggers or RLS: exercise the real schema, including side effects.
CREATE TEMP TABLE actors(label text PRIMARY KEY,id uuid NOT NULL DEFAULT gen_random_uuid());
INSERT INTO actors(label) VALUES ('host'),('unrelated'),('manager'),('leader'),('attendee');
INSERT INTO auth.users(id,email) SELECT id,label||'-'||id||'@example.invalid' FROM actors;
INSERT INTO public.profiles(id,full_name) SELECT id,'RLS fixture '||label FROM actors ON CONFLICT(id) DO NOTHING;
CREATE TEMP TABLE fixtures(label text PRIMARY KEY,id uuid NOT NULL DEFAULT gen_random_uuid());
INSERT INTO fixtures(label) VALUES ('team'),('event'),('rsvp'),('other_rsvp'),('outbox'),('offer'),('track'),('order'),('entitlement');
INSERT INTO public.teams(id,name,slug,owner_id)
SELECT f.id,'Isolated RLS team','rls-'||f.id,a.id FROM fixtures f CROSS JOIN actors a WHERE f.label='team' AND a.label='leader';
INSERT INTO public.team_members(team_id,user_id,role)
SELECT f.id,a.id,CASE WHEN a.label='leader' THEN 'leader' WHEN a.label IN ('host','manager','unrelated') THEN 'host' ELSE 'member' END
FROM fixtures f CROSS JOIN actors a WHERE f.label='team' ON CONFLICT(team_id,user_id) DO UPDATE SET role=EXCLUDED.role;
INSERT INTO public.events(id,team_id,host_id,title,starts_at,status)
SELECT (SELECT id FROM fixtures WHERE label='event'),(SELECT id FROM fixtures WHERE label='team'),id,'Isolated RLS event',now()+interval '2 days','draft' FROM actors WHERE label='host';
INSERT INTO public.event_cohosts(event_id,user_id) SELECT (SELECT id FROM fixtures WHERE label='event'),id FROM actors WHERE label='manager';
INSERT INTO public.rsvps(id,event_id,user_id,first_name,language,status)
SELECT (SELECT id FROM fixtures WHERE label='rsvp'),(SELECT id FROM fixtures WHERE label='event'),id,'Fixture attendee','es','going' FROM actors WHERE label='attendee';
INSERT INTO public.rsvps(id,event_id,first_name,language,status)
SELECT (SELECT id FROM fixtures WHERE label='other_rsvp'),(SELECT id FROM fixtures WHERE label='event'),'Fixture guest','en','going';
-- default_waiver may already have been called by the team trigger.
SELECT public.default_waiver(id) FROM fixtures WHERE label='team';
-- Touch only this new fixture's waiver, causing the production versioning trigger to run.
UPDATE public.waivers SET body_en='Isolated English consent',body_es='Consentimiento aislado' WHERE team_id=(SELECT id FROM fixtures WHERE label='team');
SELECT public.record_waiver(id,'Fixture adult',NULL,'rsvp') FROM fixtures WHERE label IN ('rsvp','other_rsvp');
INSERT INTO public.notification_outbox(id,event_id,channel,recipient,template,status)
SELECT (SELECT id FROM fixtures WHERE label='outbox'),(SELECT id FROM fixtures WHERE label='event'),'email','fixture@example.invalid','rls_fixture','skipped';
INSERT INTO public.offers(id,team_id,host_id,kind,title_en,title_es)
SELECT (SELECT id FROM fixtures WHERE label='offer'),(SELECT id FROM fixtures WHERE label='team'),id,'course','Isolated course','Curso aislado' FROM actors WHERE label='host';
INSERT INTO public.tracks(id,team_id,offer_id)
SELECT (SELECT id FROM fixtures WHERE label='track'),(SELECT id FROM fixtures WHERE label='team'),(SELECT id FROM fixtures WHERE label='offer');
INSERT INTO public.track_managers(track_id,user_id,assigned_by)
SELECT (SELECT id FROM fixtures WHERE label='track'),id,(SELECT id FROM actors WHERE label='host') FROM actors WHERE label='manager';
INSERT INTO public.offer_managers(offer_id,user_id,assigned_by)
SELECT (SELECT id FROM fixtures WHERE label='offer'),id,(SELECT id FROM actors WHERE label='host') FROM actors WHERE label='manager';
INSERT INTO public.orders(id,idempotency_key,environment,offering_type,track_id,host_id,buyer_user_id,gross_cents,platform_fee_cents,fee_rule_id)
SELECT (SELECT id FROM fixtures WHERE label='order'),'rls-'||(SELECT id FROM fixtures WHERE label='order'),'sandbox','course',(SELECT id FROM fixtures WHERE label='track'),(SELECT id FROM actors WHERE label='host'),id,1000,50,'v4_flat_5' FROM actors WHERE label='attendee';
INSERT INTO public.entitlements(id,user_id,kind,track_id,source,order_id)
SELECT (SELECT id FROM fixtures WHERE label='entitlement'),id,'course',(SELECT id FROM fixtures WHERE label='track'),'order',(SELECT id FROM fixtures WHERE label='order') FROM actors WHERE label='attendee';
GRANT SELECT ON actors,fixtures TO authenticated,service_role;

-- Invoker-rights assertions run with the actual current role and JWT, not definer rights.
CREATE FUNCTION pg_temp.assert_access(expected_rsvps int,expected_private int,expected_commerce int) RETURNS void LANGUAGE plpgsql AS $$
DECLARE n int; expected_actor uuid;
BEGIN
 SELECT id INTO expected_actor FROM actors WHERE id=auth.uid();
 IF current_user<>'authenticated' OR expected_actor IS NULL THEN RAISE EXCEPTION 'role/JWT setup failed'; END IF;
 SELECT count(*) INTO n FROM public.rsvps WHERE event_id=(SELECT id FROM fixtures WHERE label='event');
 IF n<>expected_rsvps THEN RAISE EXCEPTION 'RSVP count %, expected %',n,expected_rsvps; END IF;
 SELECT count(*) INTO n FROM public.waiver_acceptances WHERE event_id=(SELECT id FROM fixtures WHERE label='event');
 IF n<>expected_private THEN RAISE EXCEPTION 'Waiver count %, expected %',n,expected_private; END IF;
 SELECT count(*) INTO n FROM public.notification_outbox WHERE id=(SELECT id FROM fixtures WHERE label='outbox');
 IF n<>least(expected_private,1) THEN RAISE EXCEPTION 'Outbox count %',n; END IF;
 SELECT count(*) INTO n FROM public.orders WHERE id=(SELECT id FROM fixtures WHERE label='order');
 IF n<>expected_commerce THEN RAISE EXCEPTION 'Order count %',n; END IF;
 SELECT count(*) INTO n FROM public.entitlements WHERE id=(SELECT id FROM fixtures WHERE label='entitlement');
 IF n<>expected_commerce THEN RAISE EXCEPTION 'Entitlement count %',n; END IF;
END $$;
CREATE FUNCTION pg_temp.assert_denied_writes() RETURNS void LANGUAGE plpgsql AS $$
DECLARE n int;
BEGIN
 UPDATE public.rsvps SET first_name='Unauthorized mutation' WHERE event_id=(SELECT id FROM fixtures WHERE label='event');
 GET DIAGNOSTICS n=ROW_COUNT; IF n<>0 THEN RAISE EXCEPTION 'Unauthorized RSVP UPDATE affected %',n; END IF;
 DELETE FROM public.rsvps WHERE event_id=(SELECT id FROM fixtures WHERE label='event');
 GET DIAGNOSTICS n=ROW_COUNT; IF n<>0 THEN RAISE EXCEPTION 'Unauthorized RSVP DELETE affected %',n; END IF;
END $$;
SELECT set_config('request.jwt.claims',json_build_object('sub',id,'role','authenticated')::text,true) FROM actors WHERE label='host';
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_access(2,2,1);
-- Linked offer host grants track participant access without a track-manager row for host.
DO $$ BEGIN IF NOT public.can_access_track_participants((SELECT id FROM fixtures WHERE label='track')) THEN RAISE EXCEPTION 'Linked offer host denied'; END IF; END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims',json_build_object('sub',id,'role','authenticated')::text,true) FROM actors WHERE label='unrelated';
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_access(0,0,0),pg_temp.assert_denied_writes();
RESET ROLE;
SELECT set_config('request.jwt.claims',json_build_object('sub',id,'role','authenticated')::text,true) FROM actors WHERE label='leader';
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_access(0,0,0),pg_temp.assert_denied_writes();
RESET ROLE;
SELECT set_config('request.jwt.claims',json_build_object('sub',id,'role','authenticated')::text,true) FROM actors WHERE label='manager';
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_access(2,2,1);
RESET ROLE;
SELECT set_config('request.jwt.claims',json_build_object('sub',id,'role','authenticated')::text,true) FROM actors WHERE label='attendee';
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_access(1,0,1);
RESET ROLE;
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
SET LOCAL ROLE service_role;
DO $$ DECLARE n int; BEGIN
 IF current_user<>'service_role' THEN RAISE EXCEPTION 'service role setup failed'; END IF;
 SELECT count(*) INTO n FROM public.rsvps WHERE event_id=(SELECT id FROM fixtures WHERE label='event'); IF n<>2 THEN RAISE EXCEPTION 'service RSVP read'; END IF;
 SELECT count(*) INTO n FROM public.waiver_acceptances WHERE event_id=(SELECT id FROM fixtures WHERE label='event'); IF n<>2 THEN RAISE EXCEPTION 'service waiver read'; END IF;
 SELECT count(*) INTO n FROM public.notification_outbox WHERE id=(SELECT id FROM fixtures WHERE label='outbox'); IF n<>1 THEN RAISE EXCEPTION 'service outbox read'; END IF;
 SELECT count(*) INTO n FROM public.orders WHERE id=(SELECT id FROM fixtures WHERE label='order'); IF n<>1 THEN RAISE EXCEPTION 'service order read'; END IF;
 SELECT count(*) INTO n FROM public.entitlements WHERE id=(SELECT id FROM fixtures WHERE label='entitlement'); IF n<>1 THEN RAISE EXCEPTION 'service entitlement read'; END IF;
END $$;
RESET ROLE;
-- Independent post-denial read-back and server-owned Spanish snapshot.
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM public.rsvps WHERE event_id=(SELECT id FROM fixtures WHERE label='event') AND first_name='Unauthorized mutation') THEN RAISE EXCEPTION 'Unauthorized data changed'; END IF;
 IF (SELECT count(*) FROM public.rsvps WHERE event_id=(SELECT id FROM fixtures WHERE label='event'))<>2 THEN RAISE EXCEPTION 'Rows lost'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.waiver_acceptances w JOIN public.consent_text_versions c ON c.id=w.consent_text_version_id WHERE w.rsvp_id=(SELECT id FROM fixtures WHERE label='rsvp') AND c.locale='es' AND w.accepted_body_sha256=encode(sha256(convert_to('Consentimiento aislado','UTF8')),'hex')) THEN RAISE EXCEPTION 'Spanish snapshot mismatch'; END IF;
END $$;
ROLLBACK;
\echo 'Disposable-copy role regression passed; all fixtures rolled back.'