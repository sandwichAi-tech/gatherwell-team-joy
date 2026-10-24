-- Who manages an offering (event or offer)
CREATE OR REPLACE FUNCTION public.can_manage_offering(_kind text, _id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN _kind = 'event' THEN public.can_manage_event(_id)
    WHEN _kind = 'offer' THEN EXISTS (SELECT 1 FROM offers o WHERE o.id = _id AND (o.host_id = auth.uid()
      OR EXISTS (SELECT 1 FROM offer_managers m WHERE m.offer_id = o.id AND m.user_id = auth.uid())
      OR (o.team_id IS NOT NULL AND public.team_capability(o.team_id, 'content'))))
    ELSE false END
$$;
GRANT EXECUTE ON FUNCTION public.can_manage_offering(text, uuid) TO authenticated;

-- Server-derived audience: active registrants / active entitlement holders only
CREATE OR REPLACE FUNCTION public.offering_audience(_kind text, _id uuid) RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(array_agg(DISTINCT u), '{}') FROM (
    SELECT r.user_id u FROM rsvps r WHERE _kind = 'event' AND r.event_id = _id AND r.user_id IS NOT NULL AND r.status IN ('going','maybe') AND r.merged_into_rsvp_id IS NULL
    UNION SELECT e.user_id FROM entitlements e WHERE _kind = 'offer' AND e.offer_id = _id AND e.revoked_at IS NULL AND (e.ends_at IS NULL OR e.ends_at > now())
  ) x
$$;

CREATE OR REPLACE FUNCTION public.in_offering_audience(_kind text, _id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() = ANY(public.offering_audience(_kind, _id))
$$;

CREATE POLICY host_updates_read ON public.host_updates FOR SELECT TO authenticated
  USING (public.can_manage_offering(offering_kind, offering_id) OR (status = 'published' AND public.in_offering_audience(offering_kind, offering_id)));

-- Draft create/edit
CREATE OR REPLACE FUNCTION public.save_host_update(_id uuid, _kind text, _offering uuid, _title text, _body text, _scheduled_at timestamptz DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _team uuid; _rid uuid; _key text := 'update:' || auth.uid();
BEGIN
  _title := trim(coalesce(_title,'')); _body := trim(coalesce(_body,''));
  IF length(_title) < 1 OR length(_title) > 120 OR length(_body) < 1 OR length(_body) > 4000 THEN RAISE EXCEPTION 'invalid_body'; END IF;
  IF public.has_blocked_claim(_title || ' ' || _body) THEN RAISE EXCEPTION 'blocked_claim'; END IF;
  IF _id IS NOT NULL THEN
    SELECT offering_kind, offering_id INTO _kind, _offering FROM host_updates WHERE id = _id AND status <> 'archived';
    IF _kind IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  END IF;
  IF _kind NOT IN ('event','offer') OR NOT public.can_manage_offering(_kind, _offering) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  IF (SELECT count(*) FROM rsvp_attempts WHERE key = _key AND created_at > now() - interval '1 minute') >= 20 THEN RAISE EXCEPTION 'rate_limited'; END IF;
  INSERT INTO rsvp_attempts (key) VALUES (_key);
  IF _id IS NULL THEN
    _team := CASE WHEN _kind = 'event' THEN (SELECT team_id FROM events WHERE id = _offering) ELSE (SELECT team_id FROM offers WHERE id = _offering) END;
    INSERT INTO host_updates (team_id, author_id, offering_kind, offering_id, title, body, scheduled_at)
    VALUES (_team, auth.uid(), _kind, _offering, _title, _body, _scheduled_at) RETURNING id INTO _rid;
  ELSE
    UPDATE host_updates SET title = _title, body = _body, scheduled_at = _scheduled_at, updated_at = now() WHERE id = _id RETURNING id INTO _rid;
  END IF;
  RETURN _rid;
END $$;
GRANT EXECUTE ON FUNCTION public.save_host_update(uuid, text, uuid, text, text, timestamptz) TO authenticated;

-- Publish in-app now. Future scheduled delivery has no scheduler yet => Setup required (refused, never faked).
CREATE OR REPLACE FUNCTION public.publish_host_update(_id uuid) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u host_updates; _n int;
BEGIN
  SELECT * INTO u FROM host_updates WHERE id = _id;
  IF u.id IS NULL OR NOT public.can_manage_offering(u.offering_kind, u.offering_id) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  IF u.status = 'archived' THEN RAISE EXCEPTION 'archived'; END IF;
  IF u.scheduled_at IS NOT NULL AND u.scheduled_at > now() + interval '1 minute' THEN RAISE EXCEPTION 'scheduling_setup_required'; END IF;
  UPDATE host_updates SET status = 'published', published_at = coalesce(published_at, now()), updated_at = now() WHERE id = _id;
  _n := public.notify_users(public.offering_audience(u.offering_kind, u.offering_id), 'announcement', u.title, left(u.body, 160),
    '/updates?u=' || u.id, 'update:' || u.id::text);
  IF u.team_id IS NOT NULL THEN
    INSERT INTO team_audit (team_id, actor, action, target, meta) VALUES (u.team_id, auth.uid(), 'update_publish', _id, jsonb_build_object('kind', u.offering_kind));
  END IF;
  RETURN _n;
END $$;
GRANT EXECUTE ON FUNCTION public.publish_host_update(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.archive_host_update(_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u host_updates;
BEGIN
  SELECT * INTO u FROM host_updates WHERE id = _id;
  IF u.id IS NULL OR NOT public.can_manage_offering(u.offering_kind, u.offering_id) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  UPDATE host_updates SET status = 'archived', updated_at = now() WHERE id = _id;
END $$;
GRANT EXECUTE ON FUNCTION public.archive_host_update(uuid) TO authenticated;

-- Updates for one offering (managers: all; recipients: published)
CREATE OR REPLACE FUNCTION public.offering_updates(_kind text, _id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _m boolean := public.can_manage_offering(_kind, _id);
BEGIN
  IF NOT _m AND NOT public.in_offering_audience(_kind, _id) THEN RETURN jsonb_build_object('manage', false, 'items', '[]'::jsonb); END IF;
  RETURN jsonb_build_object('manage', _m, 'items', coalesce((SELECT jsonb_agg(jsonb_build_object('id', u.id, 'title', u.title, 'body', u.body, 'status', u.status,
    'scheduled_at', u.scheduled_at, 'published_at', u.published_at, 'updated_at', u.updated_at,
    'read', EXISTS (SELECT 1 FROM update_reads r WHERE r.update_id = u.id AND r.user_id = auth.uid())) ORDER BY coalesce(u.published_at, u.updated_at) DESC)
    FROM host_updates u WHERE u.offering_kind = _kind AND u.offering_id = _id AND (u.status = 'published' OR (_m AND u.status = 'draft'))), '[]'::jsonb));
END $$;
GRANT EXECUTE ON FUNCTION public.offering_updates(text, uuid) TO authenticated;

-- Recipient inbox, paginated
CREATE OR REPLACE FUNCTION public.my_updates(_limit int DEFAULT 20, _offset int DEFAULT 0) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(x ORDER BY (x->>'published_at') DESC), '[]'::jsonb) FROM (
    SELECT jsonb_build_object('id', u.id, 'title', u.title, 'body', u.body, 'published_at', u.published_at,
      'offering_kind', u.offering_kind, 'offering_id', u.offering_id,
      'offering_title', CASE WHEN u.offering_kind = 'event' THEN (SELECT title FROM events WHERE id = u.offering_id) ELSE (SELECT title_en FROM offers WHERE id = u.offering_id) END,
      'read', EXISTS (SELECT 1 FROM update_reads r WHERE r.update_id = u.id AND r.user_id = auth.uid())) x
    FROM host_updates u
    WHERE u.status = 'published' AND auth.uid() = ANY(public.offering_audience(u.offering_kind, u.offering_id))
    ORDER BY u.published_at DESC LIMIT least(greatest(_limit,1),50) OFFSET greatest(_offset,0)) s
$$;
GRANT EXECUTE ON FUNCTION public.my_updates(int, int) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_update_read(_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _id IS NULL THEN
    INSERT INTO update_reads (update_id, user_id)
    SELECT u.id, auth.uid() FROM host_updates u WHERE u.status = 'published' AND auth.uid() = ANY(public.offering_audience(u.offering_kind, u.offering_id))
    ON CONFLICT DO NOTHING;
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM host_updates u WHERE u.id = _id AND u.status = 'published' AND public.in_offering_audience(u.offering_kind, u.offering_id)) THEN RAISE EXCEPTION 'not_found'; END IF;
  INSERT INTO update_reads (update_id, user_id) VALUES (_id, auth.uid()) ON CONFLICT DO NOTHING;
END $$;
GRANT EXECUTE ON FUNCTION public.mark_update_read(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_notifications_read(_id uuid DEFAULT NULL) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE notifications SET read_at = now() WHERE user_id = auth.uid() AND read_at IS NULL AND (_id IS NULL OR id = _id)
$$;
GRANT EXECUTE ON FUNCTION public.mark_notifications_read(uuid) TO authenticated;

-- Moderation reports for a team scope; reporter identity is never returned
CREATE OR REPLACE FUNCTION public.moderation_reports(_team uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _full boolean := public.team_capability(_team, 'moderate');
BEGIN
  IF NOT _full AND NOT EXISTS (SELECT 1 FROM workspace_assignments a JOIN team_members m ON m.team_id = a.team_id AND m.user_id = a.user_id AND m.suspended_at IS NULL
    WHERE a.team_id = _team AND a.user_id = auth.uid() AND a.scope_type = 'moderation' AND a.revoked_at IS NULL) THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id', r.id, 'target_type', r.target_type, 'target_id', r.target_id, 'reason', r.reason,
      'status', coalesce(r.status, 'open'), 'created_at', r.created_at,
      'excerpt', CASE WHEN r.target_type = 'comment' THEN (SELECT left(c.body, 140) FROM comments c WHERE c.id = r.target_id) END,
      'author_id', r.author_id) ORDER BY r.created_at DESC)
    FROM reports r LEFT JOIN comments c ON r.target_type = 'comment' AND c.id = r.target_id
    WHERE r.team_id = _team AND coalesce(r.status, 'open') = 'open'
      AND (_full OR public.has_workspace_assignment(_team, auth.uid(), 'moderation', coalesce(c.event_id, c.topic_id)))), '[]'::jsonb);
END $$;
GRANT EXECUTE ON FUNCTION public.moderation_reports(uuid) TO authenticated;

-- Contact host
CREATE OR REPLACE FUNCTION public.can_view_contact_thread(_thread uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM contact_threads t WHERE t.id = _thread AND (t.user_id = auth.uid()
    OR (t.event_id IS NOT NULL AND public.can_manage_offering('event', t.event_id))
    OR (t.offer_id IS NOT NULL AND public.can_manage_offering('offer', t.offer_id))))
$$;
CREATE POLICY contact_threads_read ON public.contact_threads FOR SELECT TO authenticated USING (public.can_view_contact_thread(id));
CREATE POLICY contact_messages_read ON public.contact_messages FOR SELECT TO authenticated USING (public.can_view_contact_thread(thread_id));

CREATE OR REPLACE FUNCTION public.start_contact_thread(_event uuid, _offer uuid, _body text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _tid uuid; _host uuid; _key text := 'contact:' || auth.uid(); _title text;
BEGIN
  _body := trim(coalesce(_body,''));
  IF _uid IS NULL OR NOT public.is_adult(_uid) THEN RAISE EXCEPTION 'adult_required'; END IF;
  IF length(_body) < 1 OR length(_body) > 2000 THEN RAISE EXCEPTION 'invalid_body'; END IF;
  IF (_event IS NULL) = (_offer IS NULL) THEN RAISE EXCEPTION 'invalid'; END IF;
  IF _event IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM rsvps r WHERE r.event_id = _event AND r.user_id = _uid AND r.status NOT IN ('cancelled','declined') AND r.merged_into_rsvp_id IS NULL) THEN RAISE EXCEPTION 'not_allowed'; END IF;
    SELECT host_id, title INTO _host, _title FROM events WHERE id = _event;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM entitlements e WHERE e.offer_id = _offer AND e.user_id = _uid AND e.revoked_at IS NULL AND (e.ends_at IS NULL OR e.ends_at > now())) THEN RAISE EXCEPTION 'not_allowed'; END IF;
    SELECT host_id, title_en INTO _host, _title FROM offers WHERE id = _offer;
  END IF;
  IF EXISTS (SELECT 1 FROM user_blocks b WHERE b.blocker_id = _host AND b.blocked_id = _uid) THEN RAISE EXCEPTION 'blocked'; END IF;
  IF (SELECT count(*) FROM rsvp_attempts WHERE key = _key AND created_at > now() - interval '1 minute') >= 5 THEN RAISE EXCEPTION 'rate_limited'; END IF;
  INSERT INTO rsvp_attempts (key) VALUES (_key);
  SELECT id INTO _tid FROM contact_threads WHERE user_id = _uid AND event_id IS NOT DISTINCT FROM _event AND offer_id IS NOT DISTINCT FROM _offer AND status = 'open' LIMIT 1;
  IF _tid IS NULL THEN INSERT INTO contact_threads (event_id, offer_id, user_id) VALUES (_event, _offer, _uid) RETURNING id INTO _tid; END IF;
  INSERT INTO contact_messages (thread_id, sender_id, body) VALUES (_tid, _uid, _body);
  UPDATE contact_threads SET last_message_at = now() WHERE id = _tid;
  PERFORM public.notify_users(ARRAY[_host], 'support', 'New question about ' || coalesce(_title, ''), NULL, '/inbox?thread=' || _tid, 'contact:' || _tid || ':' || extract(epoch FROM now())::bigint);
  RETURN _tid;
END $$;
GRANT EXECUTE ON FUNCTION public.start_contact_thread(uuid, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.reply_contact_thread(_thread uuid, _body text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t contact_threads; _host uuid; _key text := 'contact:' || auth.uid(); _to uuid;
BEGIN
  _body := trim(coalesce(_body,''));
  IF length(_body) < 1 OR length(_body) > 2000 THEN RAISE EXCEPTION 'invalid_body'; END IF;
  SELECT * INTO t FROM contact_threads WHERE id = _thread;
  IF t.id IS NULL OR NOT public.can_view_contact_thread(_thread) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  IF t.status = 'closed' THEN RAISE EXCEPTION 'closed'; END IF;
  _host := coalesce((SELECT host_id FROM events WHERE id = t.event_id), (SELECT host_id FROM offers WHERE id = t.offer_id));
  IF auth.uid() = t.user_id AND EXISTS (SELECT 1 FROM user_blocks b WHERE b.blocker_id = _host AND b.blocked_id = t.user_id) THEN RAISE EXCEPTION 'blocked'; END IF;
  IF (SELECT count(*) FROM rsvp_attempts WHERE key = _key AND created_at > now() - interval '1 minute') >= 10 THEN RAISE EXCEPTION 'rate_limited'; END IF;
  INSERT INTO rsvp_attempts (key) VALUES (_key);
  INSERT INTO contact_messages (thread_id, sender_id, body) VALUES (_thread, auth.uid(), _body);
  UPDATE contact_threads SET last_message_at = now() WHERE id = _thread;
  _to := CASE WHEN auth.uid() = t.user_id THEN _host ELSE t.user_id END;
  PERFORM public.notify_users(ARRAY[_to], 'support', 'New reply', NULL, '/inbox?thread=' || _thread, 'contact:' || _thread || ':' || extract(epoch FROM clock_timestamp())::bigint);
END $$;
GRANT EXECUTE ON FUNCTION public.reply_contact_thread(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.close_contact_thread(_thread uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.can_view_contact_thread(_thread) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  UPDATE contact_threads SET status = 'closed' WHERE id = _thread;
END $$;
GRANT EXECUTE ON FUNCTION public.close_contact_thread(uuid) TO authenticated;

-- Thread list and messages: names only, never email/phone
CREATE OR REPLACE FUNCTION public.my_contact_threads() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'status', t.status, 'last_message_at', t.last_message_at,
    'mine', t.user_id = auth.uid(),
    'title', coalesce((SELECT title FROM events WHERE id = t.event_id), (SELECT title_en FROM offers WHERE id = t.offer_id)),
    'other_name', CASE WHEN t.user_id = auth.uid() THEN NULL ELSE (SELECT full_name FROM profiles WHERE id = t.user_id) END,
    'requester_id', CASE WHEN t.user_id = auth.uid() THEN NULL ELSE t.user_id END) ORDER BY t.last_message_at DESC), '[]'::jsonb)
  FROM contact_threads t WHERE public.can_view_contact_thread(t.id)
$$;
GRANT EXECUTE ON FUNCTION public.my_contact_threads() TO authenticated;

CREATE OR REPLACE FUNCTION public.contact_thread_messages(_thread uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _req uuid;
BEGIN
  IF NOT public.can_view_contact_thread(_thread) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  SELECT user_id INTO _req FROM contact_threads WHERE id = _thread;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id', m.id, 'body', m.body, 'created_at', m.created_at,
    'from', CASE WHEN m.sender_id = auth.uid() THEN 'me' WHEN m.sender_id = _req THEN 'attendee' ELSE 'host' END) ORDER BY m.created_at)
    FROM contact_messages m WHERE m.thread_id = _thread), '[]'::jsonb);
END $$;
GRANT EXECUTE ON FUNCTION public.contact_thread_messages(uuid) TO authenticated;

-- Platform support (admins only; hosts never see these)
CREATE POLICY support_tickets_admin ON public.support_tickets FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY support_messages_admin ON public.support_messages FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.create_support_ticket(_category text, _subject text, _body text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid; _key text := 'support:' || auth.uid();
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_allowed'; END IF;
  IF _category NOT IN ('account','billing','safety','other') THEN RAISE EXCEPTION 'invalid_category'; END IF;
  _subject := trim(coalesce(_subject,'')); _body := trim(coalesce(_body,''));
  IF length(_subject) < 3 OR length(_subject) > 140 OR length(_body) < 1 OR length(_body) > 4000 THEN RAISE EXCEPTION 'invalid_body'; END IF;
  IF (SELECT count(*) FROM rsvp_attempts WHERE key = _key AND created_at > now() - interval '10 minutes') >= 3 THEN RAISE EXCEPTION 'rate_limited'; END IF;
  INSERT INTO rsvp_attempts (key) VALUES (_key);
  INSERT INTO support_tickets (user_id, category, subject) VALUES (auth.uid(), _category, _subject) RETURNING id INTO _id;
  INSERT INTO support_messages (ticket_id, sender_id, body) VALUES (_id, auth.uid(), _body);
  RETURN _id;
END $$;
GRANT EXECUTE ON FUNCTION public.create_support_ticket(text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.reply_support_ticket(_ticket uuid, _body text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t support_tickets; _staff boolean := public.has_role(auth.uid(), 'admin'); _key text := 'support-reply:' || auth.uid();
BEGIN
  _body := trim(coalesce(_body,''));
  IF length(_body) < 1 OR length(_body) > 4000 THEN RAISE EXCEPTION 'invalid_body'; END IF;
  SELECT * INTO t FROM support_tickets WHERE id = _ticket;
  IF t.id IS NULL OR NOT (t.user_id = auth.uid() OR _staff) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  IF t.status = 'closed' THEN RAISE EXCEPTION 'closed'; END IF;
  IF (SELECT count(*) FROM rsvp_attempts WHERE key = _key AND created_at > now() - interval '1 minute') >= 10 THEN RAISE EXCEPTION 'rate_limited'; END IF;
  INSERT INTO rsvp_attempts (key) VALUES (_key);
  INSERT INTO support_messages (ticket_id, sender_id, is_staff, body) VALUES (_ticket, auth.uid(), _staff AND t.user_id <> auth.uid(), _body);
  UPDATE support_tickets SET status = CASE WHEN _staff AND t.user_id <> auth.uid() THEN 'answered' ELSE 'open' END, updated_at = now() WHERE id = _ticket;
  IF _staff AND t.user_id <> auth.uid() THEN
    PERFORM public.notify_users(ARRAY[t.user_id], 'support', 'ZoheeWell support replied', NULL, '/support?t=' || _ticket, 'support:' || _ticket || ':' || extract(epoch FROM clock_timestamp())::bigint);
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.reply_support_ticket(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.close_support_ticket(_ticket uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM support_tickets WHERE id = _ticket AND (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  UPDATE support_tickets SET status = 'closed', updated_at = now() WHERE id = _ticket;
END $$;
GRANT EXECUTE ON FUNCTION public.close_support_ticket(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.notify_users(uuid[], text, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.offering_audience(text, uuid) FROM PUBLIC, anon, authenticated;