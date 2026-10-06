CREATE TABLE public.network_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester uuid NOT NULL, recipient uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (requester <> recipient)
);
CREATE UNIQUE INDEX network_links_pair ON public.network_links (LEAST(requester,recipient), GREATEST(requester,recipient));
GRANT SELECT ON public.network_links TO authenticated; GRANT ALL ON public.network_links TO service_role;
ALTER TABLE public.network_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own links" ON public.network_links FOR SELECT TO authenticated USING (auth.uid() IN (requester, recipient));

CREATE OR REPLACE FUNCTION public.is_connected(_a uuid, _b uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM network_links WHERE status='accepted' AND ((requester=_a AND recipient=_b) OR (requester=_b AND recipient=_a)))
$$;

CREATE OR REPLACE FUNCTION public.is_host_anywhere(_u uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM team_members WHERE user_id=_u AND role IN ('host','leader'))
$$;

CREATE TABLE public.network_shares (
  event_id uuid PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
  host_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.network_shares TO authenticated; GRANT ALL ON public.network_shares TO service_role;
ALTER TABLE public.network_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "see own or connected shares" ON public.network_shares FOR SELECT TO authenticated USING (host_id = auth.uid() OR public.is_connected(host_id, auth.uid()));

CREATE TABLE public.network_features (
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  featured_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, team_id)
);
GRANT SELECT ON public.network_features TO authenticated; GRANT ALL ON public.network_features TO service_role;
ALTER TABLE public.network_features ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team sees features" ON public.network_features FOR SELECT TO authenticated USING (public.is_team_member(team_id, NULL));

CREATE TABLE public.referral_thanks (
  host_id uuid PRIMARY KEY, kind text NOT NULL DEFAULT 'none' CHECK (kind IN ('none','percent','flat')),
  amount integer NOT NULL DEFAULT 0 CHECK (amount >= 0), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.referral_thanks TO authenticated; GRANT ALL ON public.referral_thanks TO service_role;
ALTER TABLE public.referral_thanks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own or connected thanks" ON public.referral_thanks FOR SELECT TO authenticated USING (host_id = auth.uid() OR public.is_connected(host_id, auth.uid()));

CREATE TABLE public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gathering_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  referring_host uuid NOT NULL, partner_host uuid NOT NULL,
  rsvp_id uuid NOT NULL UNIQUE REFERENCES public.rsvps(id) ON DELETE CASCADE,
  thanks_cents integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.referrals TO authenticated; GRANT ALL ON public.referrals TO service_role;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "both hosts see referrals" ON public.referrals FOR SELECT TO authenticated USING (auth.uid() IN (referring_host, partner_host));

-- RPCs
CREATE OR REPLACE FUNCTION public.network_request(_to uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE me uuid := auth.uid(); existing network_links;
BEGIN
  IF me IS NULL OR NOT is_host_anywhere(me) OR NOT is_host_anywhere(_to) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  SELECT * INTO existing FROM network_links WHERE LEAST(requester,recipient)=LEAST(me,_to) AND GREATEST(requester,recipient)=GREATEST(me,_to);
  IF existing.id IS NULL THEN INSERT INTO network_links(requester,recipient) VALUES (me,_to);
  ELSIF existing.status='declined' THEN UPDATE network_links SET requester=me, recipient=_to, status='pending', updated_at=now() WHERE id=existing.id;
  ELSIF existing.status='pending' AND existing.recipient=me THEN UPDATE network_links SET status='accepted', updated_at=now() WHERE id=existing.id;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.network_respond(_link uuid, _accept boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  UPDATE network_links SET status = CASE WHEN _accept THEN 'accepted' ELSE 'declined' END, updated_at=now()
  WHERE id=_link AND recipient=auth.uid() AND status='pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.network_remove(_link uuid) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  DELETE FROM network_links WHERE id=_link AND auth.uid() IN (requester, recipient);
$$;

CREATE OR REPLACE FUNCTION public.network_share(_event uuid, _on boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM events WHERE id=_event AND host_id=auth.uid() AND visibility='public' AND status='published') THEN RAISE EXCEPTION 'not_allowed'; END IF;
  IF _on THEN INSERT INTO network_shares(event_id, host_id) VALUES (_event, auth.uid()) ON CONFLICT DO NOTHING;
  ELSE DELETE FROM network_shares WHERE event_id=_event; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.network_feature(_event uuid, _team uuid, _on boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE owner uuid;
BEGIN
  SELECT host_id INTO owner FROM network_shares WHERE event_id=_event;
  IF owner IS NULL OR NOT is_connected(owner, auth.uid()) OR NOT is_team_member(_team, ARRAY['host','leader']) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  IF _on THEN INSERT INTO network_features(event_id, team_id, featured_by) VALUES (_event, _team, auth.uid()) ON CONFLICT DO NOTHING;
  ELSE DELETE FROM network_features WHERE event_id=_event AND team_id=_team; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.set_referral_thanks(_kind text, _amount integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT is_host_anywhere(auth.uid()) OR _kind NOT IN ('none','percent','flat') OR _amount < 0 OR (_kind='percent' AND _amount > 50) THEN RAISE EXCEPTION 'invalid'; END IF;
  INSERT INTO referral_thanks(host_id, kind, amount) VALUES (auth.uid(), _kind, _amount)
  ON CONFLICT (host_id) DO UPDATE SET kind=EXCLUDED.kind, amount=EXCLUDED.amount, updated_at=now();
END $$;

-- Guest-callable: record that their just-created RSVP came via a partner host's shared link.
CREATE OR REPLACE FUNCTION public.record_referral(_code text, _ref uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r rsvps; e events; th referral_thanks; cents integer := 0;
BEGIN
  SELECT * INTO r FROM rsvps WHERE checkin_code=_code AND created_at > now() - interval '15 minutes';
  IF r.id IS NULL THEN RETURN; END IF;
  SELECT * INTO e FROM events WHERE id=r.event_id;
  IF e.host_id=_ref OR NOT EXISTS (SELECT 1 FROM network_shares WHERE event_id=e.id) OR NOT is_connected(e.host_id,_ref) THEN RETURN; END IF;
  IF COALESCE(e.price_cents,0) > 0 THEN
    SELECT * INTO th FROM referral_thanks WHERE host_id=e.host_id;
    cents := CASE th.kind WHEN 'percent' THEN e.price_cents * th.amount / 100 WHEN 'flat' THEN LEAST(th.amount, e.price_cents) ELSE 0 END;
  END IF;
  INSERT INTO referrals(gathering_id, referring_host, partner_host, rsvp_id, thanks_cents) VALUES (e.id, _ref, e.host_id, r.id, COALESCE(cents,0)) ON CONFLICT DO NOTHING;
END $$;
GRANT EXECUTE ON FUNCTION public.record_referral(text, uuid) TO anon, authenticated;

-- Directory/feeds
CREATE OR REPLACE FUNCTION public.network_overview() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE me uuid := auth.uid(); my_city text;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not_allowed'; END IF;
  SELECT city INTO my_city FROM profiles WHERE id=me;
  RETURN jsonb_build_object(
    'is_host', is_host_anywhere(me),
    'connections', COALESCE((SELECT jsonb_agg(jsonb_build_object('link_id',l.id,'user_id',p.id,'name',p.full_name,'city',p.city,'avatar',p.avatar_url) ORDER BY p.full_name)
       FROM network_links l JOIN profiles p ON p.id = CASE WHEN l.requester=me THEN l.recipient ELSE l.requester END
       WHERE l.status='accepted' AND me IN (l.requester,l.recipient)),'[]'),
    'incoming', COALESCE((SELECT jsonb_agg(jsonb_build_object('link_id',l.id,'user_id',p.id,'name',p.full_name,'city',p.city,'avatar',p.avatar_url))
       FROM network_links l JOIN profiles p ON p.id=l.requester WHERE l.recipient=me AND l.status='pending'),'[]'),
    'outgoing', COALESCE((SELECT jsonb_agg(jsonb_build_object('link_id',l.id,'user_id',p.id,'name',p.full_name,'city',p.city,'avatar',p.avatar_url))
       FROM network_links l JOIN profiles p ON p.id=l.recipient WHERE l.requester=me AND l.status='pending'),'[]'),
    'suggested', COALESCE((SELECT jsonb_agg(x) FROM (
       SELECT jsonb_build_object('user_id',p.id,'name',p.full_name,'city',p.city,'avatar',p.avatar_url) x
       FROM profiles p WHERE p.id<>me AND my_city IS NOT NULL AND lower(trim(p.city))=lower(trim(my_city)) AND is_host_anywhere(p.id)
         AND NOT EXISTS (SELECT 1 FROM team_members a JOIN team_members b ON a.team_id=b.team_id WHERE a.user_id=me AND b.user_id=p.id)
         AND NOT EXISTS (SELECT 1 FROM network_links l WHERE LEAST(l.requester,l.recipient)=LEAST(me,p.id) AND GREATEST(l.requester,l.recipient)=GREATEST(me,p.id) AND l.status<>'declined')
       LIMIT 12) s),'[]'),
    'gatherings', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',e.id,'title',e.title,'starts_at',e.starts_at,'timezone',e.timezone,'location_name',e.location_name,'online',e.online_url IS NOT NULL,'price_cents',e.price_cents,'host_id',e.host_id,'host_name',p.full_name,'mine',e.host_id=me,
         'featured_teams',(SELECT COALESCE(jsonb_agg(f.team_id),'[]') FROM network_features f WHERE f.event_id=e.id AND f.featured_by=me)) ORDER BY e.starts_at)
       FROM network_shares s JOIN events e ON e.id=s.event_id JOIN profiles p ON p.id=e.host_id
       WHERE e.status='published' AND e.starts_at > now() - interval '3 hours' AND (s.host_id=me OR is_connected(s.host_id, me))),'[]')
  );
END $$;

-- Partner gatherings featured to a team (team members can see them)
CREATE OR REPLACE FUNCTION public.team_featured_gatherings(_team uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT is_team_member(_team, NULL) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object('id',e.id,'title',e.title,'starts_at',e.starts_at,'timezone',e.timezone,'location_name',e.location_name,'host_name',hp.full_name,'shared_by',fp.full_name,'shared_by_id',f.featured_by) ORDER BY e.starts_at)
    FROM network_features f JOIN events e ON e.id=f.event_id JOIN profiles hp ON hp.id=e.host_id JOIN profiles fp ON fp.id=f.featured_by
    WHERE f.team_id=_team AND e.status='published' AND e.starts_at > now() - interval '3 hours'),'[]');
END $$;

CREATE OR REPLACE FUNCTION public.my_referrals() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT jsonb_build_object(
    'sent', (SELECT count(*) FROM referrals WHERE referring_host=auth.uid()),
    'received', (SELECT count(*) FROM referrals WHERE partner_host=auth.uid()),
    'thanks_earned_cents', (SELECT COALESCE(sum(thanks_cents),0) FROM referrals WHERE referring_host=auth.uid()),
    'thanks_owed_cents', (SELECT COALESCE(sum(thanks_cents),0) FROM referrals WHERE partner_host=auth.uid()),
    'thanks', (SELECT jsonb_build_object('kind',kind,'amount',amount) FROM referral_thanks WHERE host_id=auth.uid())
  );
$$;

REVOKE EXECUTE ON FUNCTION public.network_request(uuid), public.network_respond(uuid, boolean), public.network_remove(uuid), public.network_share(uuid, boolean), public.network_feature(uuid, uuid, boolean), public.set_referral_thanks(text, integer), public.network_overview(), public.team_featured_gatherings(uuid), public.my_referrals(), public.is_connected(uuid, uuid), public.is_host_anywhere(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.network_request(uuid), public.network_respond(uuid, boolean), public.network_remove(uuid), public.network_share(uuid, boolean), public.network_feature(uuid, uuid, boolean), public.set_referral_thanks(text, integer), public.network_overview(), public.team_featured_gatherings(uuid), public.my_referrals(), public.is_connected(uuid, uuid), public.is_host_anywhere(uuid) TO authenticated;