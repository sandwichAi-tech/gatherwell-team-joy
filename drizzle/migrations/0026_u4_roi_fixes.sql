CREATE OR REPLACE FUNCTION public.host_value_month(_host uuid, _start timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _end timestamptz := _start + interval '1 month';
  _earn int; _fees int; _plan text; _free plan_settings; _pro plan_settings; _free_cost int; _pro_cost int; _founding boolean;
BEGIN
  SELECT coalesce(sum(amount_cents - booking_fee_cents - CASE WHEN service_fee_covered THEN 0 ELSE service_fee_cents END),0)::int,
         coalesce(sum(fee_cents - booking_fee_cents),0)::int
    INTO _earn, _fees FROM payments WHERE host_id=_host AND status='paid' AND created_at>=_start AND created_at<_end;
  _earn := greatest(_earn,0);
  _plan := coalesce(effective_plan(_host)->>'plan','free');
  _founding := coalesce(is_founding_coach(_host), false);
  SELECT * INTO _free FROM plan_settings WHERE plan='free';
  SELECT * INTO _pro FROM plan_settings WHERE plan='pro';
  _free_cost := round(_earn * _free.fee_percent / 100);
  IF _free.monthly_cap IS NOT NULL THEN _free_cost := least(_free_cost, _free.monthly_cap); END IF;
  _free_cost := _free_cost + coalesce(_free.monthly_price,0);
  _pro_cost := coalesce(_pro.monthly_price,0) + round(_earn * _pro.fee_percent / 100);
  RETURN jsonb_build_object('start',_start,'earned',_earn,'fees',_fees,'plan',_plan,'founding',_founding,'free_cost',_free_cost,'pro_cost',_pro_cost);
END $$;
REVOKE ALL ON FUNCTION public.host_value_month(uuid, timestamptz) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.send_value_receipts()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _start timestamptz := date_trunc('month', now()) - interval '1 month'; h record; r jsonb; n int := 0;
BEGIN
  FOR h IN SELECT DISTINCT x.host_id, u.email, coalesce(pr.language,'en') lang, pr.full_name FROM (
      SELECT host_id FROM events WHERE starts_at>=_start AND starts_at<_start+interval '1 month'
      UNION SELECT host_id FROM payments WHERE status='paid' AND created_at>=_start AND created_at<_start+interval '1 month'
    ) x JOIN auth.users u ON u.id=x.host_id LEFT JOIN profiles pr ON pr.id=x.host_id WHERE x.host_id IS NOT NULL
  LOOP
    IF EXISTS (SELECT 1 FROM notification_outbox WHERE user_id=h.host_id AND template='value_receipt' AND payload->>'month'=to_char(_start,'YYYY-MM')) THEN CONTINUE; END IF;
    r := host_month_recap(h.host_id,_start) || jsonb_build_object('month',to_char(_start,'YYYY-MM'),'name',h.full_name);
    PERFORM enqueue_message('email', h.email, h.lang, 'value_receipt', 'transactional', r, now(), null, null, h.host_id, null, null);
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.send_value_receipts() FROM PUBLIC, anon, authenticated;