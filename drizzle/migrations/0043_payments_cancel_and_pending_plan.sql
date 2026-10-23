-- Cancel keeps paid access until the paid period ends, and a downgrade is
-- applied at month end, so the app must remember both states locally.
ALTER TABLE public.billing_accounts ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false;
ALTER TABLE public.billing_accounts ADD COLUMN IF NOT EXISTS pending_plan text CHECK (pending_plan IN ('free','growth','pro'));
ALTER TABLE public.billing_accounts ADD COLUMN IF NOT EXISTS pending_plan_at timestamptz;
ALTER TABLE public.team_licenses ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.billing_accounts.cancel_at_period_end IS 'true once the person has cancelled; paid access runs to renews_at.';
COMMENT ON COLUMN public.billing_accounts.pending_plan IS 'Plan that takes effect at pending_plan_at from a scheduled switch; null when none.';
COMMENT ON COLUMN public.billing_accounts.pending_plan_at IS 'When pending_plan starts, normally the end of the paid month.';
COMMENT ON COLUMN public.team_licenses.cancel_at_period_end IS 'true once cancelled; seats stay live until renews_at.';