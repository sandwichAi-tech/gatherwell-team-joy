ALTER TABLE public.referral_rewards
  ADD COLUMN IF NOT EXISTS reward_kind text,
  ADD COLUMN IF NOT EXISTS reward_value integer,
  ADD COLUMN IF NOT EXISTS original_reward_cents integer,
  ADD COLUMN IF NOT EXISTS refunded_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refunded_after_payout boolean NOT NULL DEFAULT false;

UPDATE public.referral_rewards r SET reward_kind = p.reward_kind, reward_value = p.reward_value, original_reward_cents = r.reward_cents
FROM public.referral_programs p WHERE p.id = r.program_id AND r.reward_kind IS NULL;

COMMENT ON COLUMN public.referral_rewards.reward_kind IS 'Rate snapshot at attribution; later program edits never change existing rewards.';
COMMENT ON COLUMN public.referral_rewards.refunded_after_payout IS 'Order refunded/cancelled after a manual payout was recorded; host must reconcile manually. Never auto-clawed back.';

CREATE OR REPLACE FUNCTION public.referral_attribute_order(_order uuid)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE o record; p record; k record; it record; sale int; rid uuid; amt int;
BEGIN
  SELECT * INTO o FROM orders WHERE id = _order;
  IF o IS NULL OR o.status <> 'paid' OR o.buyer_user_id IS NULL OR o.offering_type NOT IN ('event','resource','course') THEN RETURN NULL; END IF;
  SELECT id INTO rid FROM referral_rewards WHERE order_id = _order; IF rid IS NOT NULL THEN RETURN rid; END IF;
  SELECT * INTO p FROM referral_programs WHERE enabled AND ((o.event_id IS NOT NULL AND event_id = o.event_id) OR (o.offer_id IS NOT NULL AND offer_id = o.offer_id));
  IF p IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO it FROM public.referral_item(p.item_kind, coalesce(p.event_id, p.offer_id));
  IF NOT coalesce(it.eligible,false) THEN RETURN NULL; END IF;
  SELECT l.id AS link_id, l.referrer_id INTO k FROM referral_clicks c JOIN referral_links l ON l.id = c.link_id
  WHERE l.program_id = p.id AND c.user_id = o.buyer_user_id
    AND c.clicked_at <= o.created_at AND c.clicked_at > o.created_at - make_interval(days => p.window_days)
    AND l.referrer_id <> o.buyer_user_id AND l.referrer_id <> p.host_id
    AND NOT public.referral_shares_team(l.referrer_id, o.buyer_user_id)
  ORDER BY c.clicked_at DESC, c.id DESC LIMIT 1;
  IF k IS NULL THEN RETURN NULL; END IF;
  sale := greatest(o.gross_cents - o.discount_cents, 0);
  amt := public.referral_reward_cents(p.reward_kind, p.reward_value, sale);
  INSERT INTO referral_rewards(order_id, program_id, link_id, referrer_id, host_id, sale_cents, reward_cents, available_at, reward_kind, reward_value, original_reward_cents)
  VALUES (_order, p.id, k.link_id, k.referrer_id, p.host_id, sale, amt, now() + interval '14 days', p.reward_kind, p.reward_value, amt)
  ON CONFLICT (order_id) DO NOTHING RETURNING id INTO rid;
  RETURN rid;
END $function$;

-- Partial refunds shrink an unpaid reward to the rate snapshot applied to what the buyer kept; a fully refunded remainder reverses it.
CREATE OR REPLACE FUNCTION public.referral_adjust_partial(_order uuid)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r record; refunded int; kept int; amt int;
BEGIN
  SELECT * INTO r FROM referral_rewards WHERE order_id = _order FOR UPDATE;
  IF r IS NULL THEN RETURN 0; END IF;
  SELECT coalesce(sum(amount_cents),0) INTO refunded FROM refunds WHERE order_id = _order AND status = 'succeeded';
  kept := greatest(r.sale_cents - refunded, 0);
  IF r.status = 'paid' THEN
    UPDATE referral_rewards SET refunded_cents = refunded, refunded_after_payout = refunded > 0, updated_at = now() WHERE id = r.id;
    RETURN 1;
  END IF;
  IF r.status NOT IN ('pending','available') THEN RETURN 0; END IF;
  amt := public.referral_reward_cents(coalesce(r.reward_kind,'percent'), coalesce(r.reward_value,0), kept);
  IF r.reward_kind IS NULL THEN amt := floor(coalesce(r.original_reward_cents, r.reward_cents)::numeric * kept / nullif(r.sale_cents,0))::int; END IF;
  IF coalesce(amt,0) <= 0 THEN
    UPDATE referral_rewards SET status = 'reversed', reversed_reason = 'partially_refunded', reward_cents = 0, refunded_cents = refunded, updated_at = now() WHERE id = r.id;
  ELSE
    UPDATE referral_rewards SET reward_cents = least(amt, r.reward_cents), refunded_cents = refunded, updated_at = now() WHERE id = r.id;
  END IF;
  RETURN 1;
END $function$;
REVOKE ALL ON FUNCTION public.referral_adjust_partial(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.referral_reverse_order(_order uuid, _reason text)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE n int;
BEGIN
  UPDATE referral_rewards SET status = 'reversed', reversed_reason = _reason, updated_at = now()
  WHERE order_id = _order AND status IN ('pending','available');
  GET DIAGNOSTICS n = ROW_COUNT;
  UPDATE referral_rewards SET refunded_after_payout = true, updated_at = now() WHERE order_id = _order AND status = 'paid';
  RETURN n;
END $function$;

CREATE OR REPLACE FUNCTION public.orders_referral_hook()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'paid' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'paid') THEN PERFORM public.referral_attribute_order(NEW.id);
  ELSIF NEW.status = 'partially_refunded' THEN PERFORM public.referral_adjust_partial(NEW.id);
  ELSIF NEW.status IN ('refunded','cancelled','disputed','failed') AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN PERFORM public.referral_reverse_order(NEW.id, NEW.status);
  END IF;
  RETURN NEW;
END $function$;