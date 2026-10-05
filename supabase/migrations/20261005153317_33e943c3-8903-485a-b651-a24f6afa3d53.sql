
-- lovable-cron-fallback-reviewed: user-required 5-minute outbox processor; reminders are time-based (24h/2h before start), claim is idempotent with SKIP LOCKED
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Outbox extensions
ALTER TABLE public.notification_outbox DROP CONSTRAINT IF EXISTS notification_outbox_channel_check;
ALTER TABLE public.notification_outbox
  ADD COLUMN language text NOT NULL DEFAULT 'en',
  ADD COLUMN kind text NOT NULL DEFAULT 'transactional',
  ADD COLUMN user_id uuid,
  ADD COLUMN team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  ADD COLUMN provider_message_id text,
  ADD COLUMN error text,
  ADD COLUMN attempts int NOT NULL DEFAULT 0,
  ADD COLUMN locked_at timestamptz,
  ADD COLUMN sent_at timestamptz;
ALTER TABLE public.notification_outbox ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE public.notification_outbox ADD CONSTRAINT notification_outbox_channel_check CHECK (channel IN ('email','sms','push'));
ALTER TABLE public.notification_outbox ADD CONSTRAINT notification_outbox_status_check CHECK (status IN ('pending','sending','sent','simulated','failed','skipped'));
ALTER TABLE public.notification_outbox ADD CONSTRAINT notification_outbox_kind_check CHECK (kind IN ('transactional','reminders','announcements','badges','followups'));
CREATE INDEX IF NOT EXISTS outbox_due_idx ON public.notification_outbox (status, send_after);
CREATE INDEX IF NOT EXISTS outbox_rsvp_idx ON public.notification_outbox (rsvp_id);
CREATE INDEX IF NOT EXISTS outbox_event_idx ON public.notification_outbox (event_id);

ALTER TABLE public.profiles ADD COLUMN notify_prefs jsonb NOT NULL DEFAULT
  '{"email":true,"sms":true,"push":true,"reminders":true,"announcements":true,"badges":true,"followups":true}'::jsonb;

CREATE TABLE public.sms_optouts (
  phone text PRIMARY KEY,
  source text NOT NULL DEFAULT 'reply',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.sms_optouts TO service_role;
ALTER TABLE public.sms_optouts ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.email_prefs (
  email text PRIMARY KEY,
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  language text NOT NULL DEFAULT 'en',
  all_off boolean NOT NULL DEFAULT false,
  reminders boolean NOT NULL DEFAULT true,
  announcements boolean NOT NULL DEFAULT true,
  badges boolean NOT NULL DEFAULT true,
  followups boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.email_prefs TO service_role;
ALTER TABLE public.email_prefs ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.email_suppressions (
  email text PRIMARY KEY,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.email_suppressions TO service_role;
ALTER TABLE public.email_suppressions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own devices read" ON public.push_subscriptions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Own devices add" ON public.push_subscriptions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Own devices remove" ON public.push_subscriptions FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.delivery_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  provider_message_id text,
  event text NOT NULL,
  email text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.delivery_events TO service_role;
ALTER TABLE public.delivery_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.app_config (key text PRIMARY KEY, value text NOT NULL);
GRANT ALL ON public.app_config TO service_role;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
INSERT INTO public.app_config (key, value) VALUES ('cron_token', encode(gen_random_bytes(32), 'hex'));

-- Helpers
CREATE OR REPLACE FUNCTION public.user_email(_user uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT email FROM auth.users WHERE id = _user;
$$;

CREATE OR REPLACE FUNCTION public.enqueue_message(_channel text, _recipient text, _language text, _template text, _kind text, _payload jsonb,
  _send_after timestamptz DEFAULT now(), _event uuid DEFAULT NULL, _rsvp uuid DEFAULT NULL, _user uuid DEFAULT NULL, _team uuid DEFAULT NULL, _lesson uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF nullif(trim(coalesce(_recipient,'')), '') IS NULL THEN RETURN; END IF;
  INSERT INTO public.notification_outbox (channel, recipient, language, template, kind, payload, send_after, event_id, rsvp_id, user_id, team_id, lesson_id, status)
  VALUES (_channel, trim(_recipient), CASE WHEN _language = 'es' THEN 'es' ELSE 'en' END, _template, _kind, coalesce(_payload, '{}'::jsonb), coalesce(_send_after, now()), _event, _rsvp, _user, _team, _lesson, 'pending');
END $$;

CREATE OR REPLACE FUNCTION public.event_payload(_event uuid, _rsvp uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('event_id', e.id, 'title', e.title, 'starts_at', e.starts_at, 'timezone', e.timezone,
    'location', coalesce(e.location_name, e.address), 'online', e.online_url IS NOT NULL, 'team', t.name,
    'name', split_part(coalesce(r.guest_name, ''), ' ', 1), 'code', r.checkin_code)
  FROM public.events e JOIN public.teams t ON t.id = e.team_id LEFT JOIN public.rsvps r ON r.id = _rsvp WHERE e.id = _event;
$$;

CREATE OR REPLACE FUNCTION public.queue_rsvp_reminders(_rsvp uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.rsvps; e public.events; _p jsonb; _t record;
BEGIN
  SELECT * INTO r FROM public.rsvps WHERE id = _rsvp;
  DELETE FROM public.notification_outbox WHERE rsvp_id = _rsvp AND status = 'pending' AND template IN ('reminder_24h','reminder_2h');
  IF r.id IS NULL OR r.status <> 'going' THEN RETURN; END IF;
  SELECT * INTO e FROM public.events WHERE id = r.event_id;
  IF e.status <> 'published' THEN RETURN; END IF;
  _p := public.event_payload(e.id, r.id);
  FOR _t IN SELECT * FROM (VALUES ('reminder_24h', interval '24 hours'), ('reminder_2h', interval '2 hours')) v(tpl, lead) LOOP
    IF e.starts_at - _t.lead > now() THEN
      IF r.email_opt_in THEN PERFORM public.enqueue_message('email', r.guest_email, r.language, _t.tpl, 'reminders', _p, e.starts_at - _t.lead, e.id, r.id, r.user_id); END IF;
      IF r.sms_opt_in THEN PERFORM public.enqueue_message('sms', r.guest_phone, r.language, _t.tpl, 'reminders', _p, e.starts_at - _t.lead, e.id, r.id, r.user_id); END IF;
      IF r.user_id IS NOT NULL THEN PERFORM public.enqueue_message('push', r.user_id::text, r.language, _t.tpl, 'reminders', _p, e.starts_at - _t.lead, e.id, r.id, r.user_id); END IF;
    END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.queue_rsvp_notices(_rsvp uuid, _template text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.rsvps; _p jsonb;
BEGIN
  SELECT * INTO r FROM public.rsvps WHERE id = _rsvp;
  IF r.id IS NULL THEN RETURN; END IF;
  _p := public.event_payload(r.event_id, r.id);
  IF r.email_opt_in THEN PERFORM public.enqueue_message('email', r.guest_email, r.language, _template, 'transactional', _p, now(), r.event_id, r.id, r.user_id); END IF;
  IF _template = 'waitlist_promoted' THEN
    IF r.sms_opt_in THEN PERFORM public.enqueue_message('sms', r.guest_phone, r.language, _template, 'transactional', _p, now(), r.event_id, r.id, r.user_id); END IF;
    IF r.user_id IS NOT NULL THEN PERFORM public.enqueue_message('push', r.user_id::text, r.language, _template, 'transactional', _p, now(), r.event_id, r.id, r.user_id); END IF;
  END IF;
  IF _template IN ('rsvp_confirmed','waitlist_promoted') THEN PERFORM public.queue_rsvp_reminders(_rsvp); END IF;
END $$;

-- RSVP changes keep reminders in step
CREATE OR REPLACE FUNCTION public.rsvp_reminders_sync() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status <> 'going' THEN
    UPDATE public.notification_outbox SET status = 'skipped', error = 'rsvp_' || NEW.status
      WHERE rsvp_id = NEW.id AND status = 'pending' AND template IN ('reminder_24h','reminder_2h');
  ELSIF OLD.status IS DISTINCT FROM 'going' OR OLD.email_opt_in IS DISTINCT FROM NEW.email_opt_in OR OLD.sms_opt_in IS DISTINCT FROM NEW.sms_opt_in
     OR OLD.guest_email IS DISTINCT FROM NEW.guest_email OR OLD.guest_phone IS DISTINCT FROM NEW.guest_phone OR OLD.language IS DISTINCT FROM NEW.language THEN
    PERFORM public.queue_rsvp_reminders(NEW.id);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER rsvp_reminders_sync AFTER UPDATE OF status, email_opt_in, sms_opt_in, guest_email, guest_phone, language ON public.rsvps
  FOR EACH ROW EXECUTE FUNCTION public.rsvp_reminders_sync();

-- Gathering moved: reschedule and tell guests
CREATE OR REPLACE FUNCTION public.event_messages_sync() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.rsvps;
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    UPDATE public.notification_outbox SET status = 'skipped', error = 'gathering_cancelled'
      WHERE event_id = NEW.id AND status = 'pending' AND template IN ('reminder_24h','reminder_2h');
    RETURN NEW;
  END IF;
  IF NEW.status = 'published' AND OLD.status = 'published' AND (NEW.starts_at IS DISTINCT FROM OLD.starts_at OR NEW.location_name IS DISTINCT FROM OLD.location_name OR NEW.address IS DISTINCT FROM OLD.address OR NEW.online_url IS DISTINCT FROM OLD.online_url) THEN
    FOR r IN SELECT * FROM public.rsvps WHERE event_id = NEW.id AND status IN ('going','waitlist') LOOP
      IF r.email_opt_in THEN PERFORM public.enqueue_message('email', r.guest_email, r.language, 'gathering_updated', 'transactional', public.event_payload(NEW.id, r.id), now(), NEW.id, r.id, r.user_id); END IF;
      IF NEW.starts_at IS DISTINCT FROM OLD.starts_at THEN PERFORM public.queue_rsvp_reminders(r.id); END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER event_messages_sync AFTER UPDATE OF status, starts_at, location_name, address, online_url ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.event_messages_sync();

CREATE OR REPLACE FUNCTION public.notify_gathering_cancelled(_event uuid) RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.rsvps; _n int := 0;
BEGIN
  IF NOT public.can_manage_event(_event) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.events WHERE id = _event AND status = 'cancelled') THEN RAISE EXCEPTION 'not_cancelled'; END IF;
  FOR r IN SELECT * FROM public.rsvps WHERE event_id = _event AND status IN ('going','waitlist') LOOP
    IF r.email_opt_in AND r.guest_email IS NOT NULL THEN
      PERFORM public.enqueue_message('email', r.guest_email, r.language, 'gathering_cancelled', 'transactional', public.event_payload(_event, r.id), now(), _event, r.id, r.user_id); _n := _n + 1;
    END IF;
    IF r.sms_opt_in AND r.guest_phone IS NOT NULL THEN
      PERFORM public.enqueue_message('sms', r.guest_phone, r.language, 'gathering_cancelled', 'transactional', public.event_payload(_event, r.id), now(), _event, r.id, r.user_id);
    END IF;
  END LOOP;
  RETURN _n;
END $$;

-- Announcements
CREATE OR REPLACE FUNCTION public.notify_announcement(_announcement uuid, _email boolean, _subteams boolean) RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.announcements; _team_name text; _author text; m record; _n int := 0; _p jsonb;
BEGIN
  SELECT * INTO a FROM public.announcements WHERE id = _announcement;
  IF a.id IS NULL OR NOT public.is_team_member(a.team_id, ARRAY['leader']) THEN RAISE EXCEPTION 'not_leader'; END IF;
  SELECT name INTO _team_name FROM public.teams WHERE id = a.team_id;
  SELECT full_name INTO _author FROM public.profiles WHERE id = a.author_id;
  _p := jsonb_build_object('team', _team_name, 'author', coalesce(_author,''), 'body', a.body, 'announcement_id', a.id);
  FOR m IN SELECT DISTINCT ON (tm.user_id) tm.user_id, tm.team_id, coalesce(p.language,'en') AS language
    FROM public.team_members tm JOIN public.profiles p ON p.id = tm.user_id
    WHERE (tm.team_id = a.team_id OR (_subteams AND tm.team_id IN (SELECT id FROM public.team_tree(a.team_id))))
      AND tm.user_id <> auth.uid()
  LOOP
    PERFORM public.enqueue_message('push', m.user_id::text, m.language, 'team_announcement', 'announcements', _p, now(), NULL, NULL, m.user_id, a.team_id);
    IF _email THEN
      PERFORM public.enqueue_message('email', public.user_email(m.user_id), m.language, 'team_announcement', 'announcements', _p, now(), NULL, NULL, m.user_id, a.team_id);
      _n := _n + 1;
    END IF;
  END LOOP;
  RETURN _n;
END $$;

-- Badges, welcomes, live sessions
CREATE OR REPLACE FUNCTION public.queue_badge_message() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b public.badges; _lang text; _p jsonb;
BEGIN
  SELECT * INTO b FROM public.badges WHERE id = NEW.badge_id;
  SELECT language INTO _lang FROM public.profiles WHERE id = NEW.user_id;
  _p := jsonb_build_object('name_en', b.name_en, 'name_es', b.name_es, 'description_en', b.description_en, 'description_es', b.description_es, 'team', (SELECT name FROM public.teams WHERE id = NEW.team_id));
  PERFORM public.enqueue_message('email', public.user_email(NEW.user_id), _lang, 'badge_earned', 'badges', _p, now(), NULL, NULL, NEW.user_id, NEW.team_id);
  PERFORM public.enqueue_message('push', NEW.user_id::text, _lang, 'badge_earned', 'badges', _p, now(), NULL, NULL, NEW.user_id, NEW.team_id);
  RETURN NEW;
END $$;
CREATE TRIGGER queue_badge_message AFTER INSERT ON public.user_badges FOR EACH ROW EXECUTE FUNCTION public.queue_badge_message();

CREATE OR REPLACE FUNCTION public.queue_welcome_message() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _lang text;
BEGIN
  IF NEW.user_id = (SELECT owner_id FROM public.teams WHERE id = NEW.team_id) THEN RETURN NEW; END IF;
  SELECT language INTO _lang FROM public.profiles WHERE id = NEW.user_id;
  PERFORM public.enqueue_message('email', public.user_email(NEW.user_id), _lang, 'welcome_to_team', 'transactional',
    jsonb_build_object('team', (SELECT name FROM public.teams WHERE id = NEW.team_id)), now(), NULL, NULL, NEW.user_id, NEW.team_id);
  RETURN NEW;
END $$;
CREATE TRIGGER queue_welcome_message AFTER INSERT ON public.team_members FOR EACH ROW EXECUTE FUNCTION public.queue_welcome_message();

CREATE OR REPLACE FUNCTION public.queue_lesson_reminder() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _l public.lessons; _lang text; _p jsonb; _at timestamptz;
BEGIN
  SELECT * INTO _l FROM public.lessons WHERE id = NEW.lesson_id;
  SELECT language INTO _lang FROM public.profiles WHERE id = NEW.user_id;
  _p := jsonb_build_object('title_en', _l.title_en, 'title_es', _l.title_es, 'starts_at', _l.live_starts_at, 'lesson_id', _l.id);
  _at := greatest(now(), coalesce(_l.live_starts_at, now()) - interval '10 minutes');
  PERFORM public.enqueue_message('email', public.user_email(NEW.user_id), _lang, 'live_session_reminder', 'reminders', _p, _at, NULL, NULL, NEW.user_id, NULL, _l.id);
  PERFORM public.enqueue_message('push', NEW.user_id::text, _lang, 'live_session_reminder', 'reminders', _p, _at, NULL, NULL, NEW.user_id, NULL, _l.id);
  RETURN NEW;
END $$;

-- Texts: inbound replies
CREATE OR REPLACE FUNCTION public.normalize_phone(_p text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN regexp_replace(coalesce(_p,''), '\D', '', 'g') = '' THEN NULL
    WHEN length(regexp_replace(_p, '\D', '', 'g')) = 10 THEN '+1' || regexp_replace(_p, '\D', '', 'g')
    ELSE '+' || regexp_replace(_p, '\D', '', 'g') END;
$$;

CREATE OR REPLACE FUNCTION public.handle_sms_inbound(_from text, _body text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _w text := upper(trim(regexp_replace(coalesce(_body,''), '[^[:alpha:]]', '', 'g'))); _ph text := public.normalize_phone(_from);
BEGIN
  IF _ph IS NULL THEN RETURN 'ignored'; END IF;
  IF _w IN ('STOP','STOPALL','UNSUBSCRIBE','CANCEL','END','QUIT','CANCELAR','ALTO','BAJA') THEN
    INSERT INTO public.sms_optouts (phone, source) VALUES (_ph, 'reply') ON CONFLICT (phone) DO NOTHING;
    UPDATE public.notification_outbox SET status = 'skipped', error = 'sms_opted_out'
      WHERE channel = 'sms' AND status IN ('pending','failed') AND public.normalize_phone(recipient) = _ph;
    RETURN 'stopped';
  ELSIF _w IN ('START','UNSTOP','YES','SI','SÍ','INICIAR') THEN
    DELETE FROM public.sms_optouts WHERE phone = _ph; RETURN 'started';
  ELSIF _w IN ('HELP','INFO','AYUDA') THEN RETURN 'help';
  END IF;
  RETURN 'ignored';
END $$;

-- Delivery reports
CREATE OR REPLACE FUNCTION public.record_delivery_event(_provider text, _message_id text, _event text, _email text, _payload jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.delivery_events (provider, provider_message_id, event, email, payload) VALUES (_provider, _message_id, _event, lower(_email), coalesce(_payload,'{}'::jsonb));
  IF _event IN ('bounced','complained') AND _email IS NOT NULL THEN
    INSERT INTO public.email_suppressions (email, reason) VALUES (lower(trim(_email)), _event) ON CONFLICT (email) DO NOTHING;
    UPDATE public.notification_outbox SET status = 'skipped', error = 'suppressed_' || _event
      WHERE channel = 'email' AND status IN ('pending','failed') AND lower(recipient) = lower(trim(_email));
  END IF;
END $$;

-- Sender: claim due rows with everything needed to decide
CREATE OR REPLACE FUNCTION public.claim_outbox(_limit int DEFAULT 50)
RETURNS TABLE(id uuid, channel text, recipient text, language text, template text, kind text, payload jsonb, user_id uuid, attempts int, skip_reason text, unsub_token uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.notification_outbox o SET status = 'failed', error = coalesce(o.error, 'timeout') WHERE o.status = 'sending' AND o.locked_at < now() - interval '15 minutes';
  RETURN QUERY
  WITH due AS (
    SELECT o.id FROM public.notification_outbox o
    WHERE o.send_after <= now() AND (o.status = 'pending' OR (o.status = 'failed' AND o.attempts < 3))
    ORDER BY o.send_after LIMIT greatest(1, least(_limit, 200)) FOR UPDATE SKIP LOCKED
  ), claimed AS (
    UPDATE public.notification_outbox o SET status = 'sending', attempts = o.attempts + 1, locked_at = now()
    FROM due WHERE o.id = due.id RETURNING o.*
  )
  SELECT c.id, c.channel, c.recipient, c.language, c.template, c.kind, c.payload, c.user_id, c.attempts,
    CASE
      WHEN c.channel = 'sms' AND EXISTS (SELECT 1 FROM public.sms_optouts s WHERE s.phone = public.normalize_phone(c.recipient)) THEN 'sms_opted_out'
      WHEN c.channel = 'email' AND EXISTS (SELECT 1 FROM public.email_suppressions s WHERE s.email = lower(c.recipient)) THEN 'suppressed'
      WHEN c.channel = 'email' AND c.kind <> 'transactional' AND EXISTS (SELECT 1 FROM public.email_prefs ep WHERE ep.email = lower(c.recipient)
        AND (ep.all_off OR (c.kind = 'reminders' AND NOT ep.reminders) OR (c.kind = 'announcements' AND NOT ep.announcements) OR (c.kind = 'badges' AND NOT ep.badges) OR (c.kind = 'followups' AND NOT ep.followups))) THEN 'unsubscribed'
      WHEN c.channel = 'email' AND c.template = 'team_announcement' AND EXISTS (SELECT 1 FROM public.email_prefs ep WHERE ep.email = lower(c.recipient) AND ep.all_off) THEN 'unsubscribed'
      WHEN c.user_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = c.user_id
        AND (coalesce((p.notify_prefs->>c.channel)::boolean, true) = false OR (c.kind <> 'transactional' AND coalesce((p.notify_prefs->>c.kind)::boolean, true) = false))) THEN 'preference_off'
      WHEN c.channel = 'push' AND NOT EXISTS (SELECT 1 FROM public.push_subscriptions ps WHERE ps.user_id = c.user_id) THEN 'no_device'
      ELSE NULL END,
    CASE WHEN c.channel = 'email' THEN public.email_token(c.recipient, c.language) END
  FROM claimed c;
END $$;

CREATE OR REPLACE FUNCTION public.email_token(_email text, _lang text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _t uuid;
BEGIN
  INSERT INTO public.email_prefs (email, language) VALUES (lower(trim(_email)), CASE WHEN _lang = 'es' THEN 'es' ELSE 'en' END)
  ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email RETURNING token INTO _t;
  RETURN _t;
END $$;

-- Public unsubscribe (token only)
CREATE OR REPLACE FUNCTION public.get_email_prefs(_token uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('email', regexp_replace(email, '^(.).*(@.*)$', '\1•••\2'), 'language', language, 'all_off', all_off,
    'reminders', reminders, 'announcements', announcements, 'badges', badges, 'followups', followups)
  FROM public.email_prefs WHERE token = _token;
$$;

CREATE OR REPLACE FUNCTION public.set_email_prefs(_token uuid, _prefs jsonb) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.email_prefs SET
    all_off = coalesce((_prefs->>'all_off')::boolean, all_off),
    reminders = coalesce((_prefs->>'reminders')::boolean, reminders),
    announcements = coalesce((_prefs->>'announcements')::boolean, announcements),
    badges = coalesce((_prefs->>'badges')::boolean, badges),
    followups = coalesce((_prefs->>'followups')::boolean, followups),
    updated_at = now()
  WHERE token = _token;
  RETURN FOUND;
END $$;

-- Permissions
REVOKE ALL ON FUNCTION public.user_email(uuid), public.enqueue_message(text, text, text, text, text, jsonb, timestamptz, uuid, uuid, uuid, uuid, uuid),
  public.event_payload(uuid, uuid), public.queue_rsvp_reminders(uuid), public.rsvp_reminders_sync(), public.event_messages_sync(),
  public.queue_badge_message(), public.queue_welcome_message(), public.handle_sms_inbound(text, text), public.record_delivery_event(text, text, text, text, jsonb),
  public.claim_outbox(int), public.email_token(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_sms_inbound(text, text), public.record_delivery_event(text, text, text, text, jsonb), public.claim_outbox(int), public.email_token(text, text) TO service_role;
REVOKE ALL ON FUNCTION public.notify_gathering_cancelled(uuid), public.notify_announcement(uuid, boolean, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notify_gathering_cancelled(uuid), public.notify_announcement(uuid, boolean, boolean) TO authenticated;
REVOKE ALL ON FUNCTION public.get_email_prefs(uuid), public.set_email_prefs(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_email_prefs(uuid), public.set_email_prefs(uuid, jsonb) TO anon, authenticated;

-- Every 5 minutes: ask the app to send due messages (preview and published both claim safely)
SELECT cron.schedule('gatherwell-process-outbox', '*/5 * * * *', $cron$
  SELECT net.http_post(url := u, headers := jsonb_build_object('Content-Type','application/json','x-cron-token',(SELECT value FROM public.app_config WHERE key = 'cron_token')), body := '{}'::jsonb)
  FROM unnest(ARRAY['https://project--d56c15d9-a849-4fc3-a192-501da269084f.lovable.app/api/public/outbox/process',
                    'https://project--d56c15d9-a849-4fc3-a192-501da269084f-dev.lovable.app/api/public/outbox/process']) AS u;
$cron$);
