import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useTranslation } from 'react-i18next';
import { GwIcon } from '@/components/gw-icon';
import { Button } from '@/components/ui/button';
import { getPaymentsReadiness, startConnectOnboarding } from '@/lib/billing.functions';
import { readinessSteps, type ReadinessStep } from '@/lib/payments-readiness';
import { rpcError } from '@/lib/gatherings';
import { toast } from 'sonner';
import { useState } from 'react';

export const paymentsReadinessQuery = {
  queryKey: ['payments-readiness'],
  queryFn: () => getPaymentsReadiness(),
  staleTime: 60_000,
};

function StepIcon({ state }: { state: ReadinessStep['state'] }) {
  if (state === 'ready') return <GwIcon name="CircleCheck" className="payready-icon is-ready" aria-hidden />;
  if (state === 'action') return <GwIcon name="AlertCircle" className="payready-icon is-action" aria-hidden />;
  return <GwIcon name="Clock" className="payready-icon is-waiting" aria-hidden />;
}

/**
 * Truthful payments checklist: what works now (free), what only ZoheeWell can
 * enable (platform connection), and what the coach can do (payout setup via
 * the existing Connect onboarding). Never implies checkout works when it does not.
 */
export function PaymentsReadiness({ showFee = true }: { showFee?: boolean }) {
  const { t } = useTranslation();
  const { data } = useQuery(paymentsReadinessQuery);
  const connect = useServerFn(startConnectOnboarding);
  const [busy, setBusy] = useState(false);
  if (!data) return <p className="auth-subtitle">{t('publicEvent.loading')}</p>;

  const steps = readinessSteps(data);
  const startOnboarding = async () => {
    setBusy(true);
    try {
      const r = await connect({ data: { origin: window.location.origin } });
      if (r.ok && r.url) window.location.href = r.url;
      else if (!r.ok) toast.error(t(`billing.checkoutError_${r.error}`, { defaultValue: t('billing.error') }));
    } catch (e) { toast.error(rpcError(t, e)); }
    setBusy(false);
  };

  return <section className="panel payready" aria-label={t('payReady.title')}>
    <div className="section-heading"><h2>{t('payReady.title')}</h2></div>
    <p className="auth-subtitle">{t('payReady.subtitle')}</p>
    <ul className="payready-list">
      {steps.map(s => <li key={s.id} className={`payready-row is-${s.state}`}>
        <StepIcon state={s.state} />
        <div>
          <strong>{t(`payReady.step.${s.id}`)}</strong>
          <p className="payready-note">{t(`payReady.note.${s.id}_${s.state}`, { defaultValue: t(`payReady.note.${s.id}`) })}</p>
          {s.id === 'payouts' && s.state === 'action' && (
            <Button className="guest-primary" disabled={busy} onClick={() => void startOnboarding()}>
              {data.connectStatus === 'pending' ? t('billing.connectContinue') : t('billing.connectStart')}
            </Button>
          )}
        </div>
      </li>)}
    </ul>
    {showFee && <p className="payready-fee">{t('pricingV4.feeDisclosure')}</p>}
    <p className="payready-note">{t('payReady.draftSafe')}</p>
  </section>;
}

/** One-line honest explanation for blocked paid options, linking to the checklist. */
export function PaidBlockedNote() {
  const { t } = useTranslation();
  const { data } = useQuery(paymentsReadinessQuery);
  if (!data) return null;
  if (data.canSellPaid) return null;
  const reason = !data.platformConnected ? 'platform' : 'payouts';
  return <p className="not-connected-note" role="note">
    <GwIcon name="AlertCircle" aria-hidden />
    <span>{t(`payReady.blocked_${reason}`)} <a href="/plan" className="payready-link">{t('payReady.seeChecklist')}</a></span>
  </p>;
}
