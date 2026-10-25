CREATE OR REPLACE FUNCTION public.record_referral_payout(_referrer uuid, _rewards uuid[], _paid_on date, _note text, _reference text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE total int; n int; pid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF _paid_on IS NULL OR _paid_on > current_date THEN RAISE EXCEPTION 'referral_payout_date'; END IF;
  IF coalesce(array_length(_rewards,1),0) = 0 THEN RAISE EXCEPTION 'referral_payout_empty'; END IF;
  PERFORM public.referral_release_due();
  SELECT count(*), coalesce(sum(reward_cents),0) INTO n, total FROM (
    SELECT reward_cents FROM referral_rewards
    WHERE id = ANY(_rewards) AND host_id = auth.uid() AND referrer_id = _referrer AND status = 'available' FOR UPDATE) locked;
  IF n <> (SELECT count(DISTINCT x) FROM unnest(_rewards) x) OR total <= 0 THEN RAISE EXCEPTION 'referral_payout_invalid'; END IF;
  INSERT INTO referral_payouts(host_id, referrer_id, amount_cents, paid_on, note, reference, recorded_by)
  VALUES (auth.uid(), _referrer, total, _paid_on, nullif(trim(_note),''), nullif(trim(_reference),''), auth.uid()) RETURNING id INTO pid;
  UPDATE referral_rewards SET status = 'paid', payout_id = pid, updated_at = now() WHERE id = ANY(_rewards) AND status = 'available';
  RETURN pid;
END $$;