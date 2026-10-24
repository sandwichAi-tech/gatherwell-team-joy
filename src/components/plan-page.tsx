import { noLimitsPhase } from '@/lib/plan-savings';
import { PlanCardBody } from '@/components/plan-features';
import { FoundingCommitmentsCard, FoundingPlanBanner } from '@/components/founding';
import { EarningsMilestones } from '@/components/coach-launch';
import { PromoUsageCard } from '@/components/promo-codes';
import { EmptyState } from '@/components/launch-states';
import { ReferralCard } from '@/components/network-share';
import { WelcomeRewardsCard } from '@/components/welcome';
import { trackEvent } from '@/lib/analytics';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { AlertCircle, ArrowLeft, Check, ChevronRight, CreditCard, UsersRound, BarChart3 } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ResponsiveSheet } from '@/components/responsive-sheet';
import { useGatherwell } from '@/components/gatherwell-shell';
import { supabase } from '@/integrations/supabase/client';
import { workspaceQuery } from '@/lib/account';
import { rosterQuery } from '@/lib/team';
import { isAdminQuery } from '@/lib/site-media';
import { earningsQuery, formatMoney, formatStorage, LICENSES, licenseQuery, paymentsStatusQuery, PLANS, PRO_FEATURES, planSettingsQuery, planStatusQuery, type PlanId } from '@/lib/billing';
import { openBillingPortal, refundPayments, schedulePlanChange, startConnectOnboarding, startLicenseCheckout, startPlanCheckout } from '@/lib/billing.functions';
import { getStripeEnvironment, paymentsTokenPresent } from '@/lib/stripe';
import { useInlineCheckout } from '@/components/inline-checkout';
import { PaymentTestModeBanner } from '@/components/payment-test-mode-banner';

const fmtDate = (iso: string, lang: string) => new Date(iso).toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US', { month: 'long', day: 'numeric', year: 'numeric' });

/** Blueprint v4 prices shown on the prospective cards. plan_settings rows and Stripe price IDs stay
 *  untouched, so paid checkout stays disabled ("Setup required") until the approved prices are configured. */
const V4_MONTHLY_CENTS: Record<PlanId, number> = { free: 0, growth: 4900, pro: 9900 };
const V4_FEE_PERCENT = 5;

/** App errors with their own wording; anything else is the provider's message. */
const CHECKOUT_ERRORS = ['already_on_plan', 'already_on_license', 'price_mismatch', 'price_not_found', 'founding_free', 'no_subscription', 'no_period_end'];

/** Says so once when the provider returns after a paid checkout. */
function useCheckoutNotice() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const location = useLocation();
  const done = new URLSearchParams(location.searchStr).get('checkout') === 'done';
  useEffect(() => {
    if (!done) return;
    toast.success(t('billing.checkoutDone'));
    void qc.invalidateQueries({ queryKey: ['plan-status'] });
    const url = new URL(window.location.href);
    url.searchParams.delete('checkout'); url.searchParams.delete('session_id');
    window.history.replaceState({}, '', url.toString());
  }, [done, t, qc]);
}

export function NotConnectedSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation();
  return <ResponsiveSheet open={open} onOpenChange={onOpenChange} title={t('billing.notConnectedTitle')}>
    <p className="auth-subtitle">{t('billing.notConnected')}</p>
    <Button className="onboarding-continue" onClick={() => onOpenChange(false)}>{t('common.close')}</Button>
  </ResponsiveSheet>;
}

/** Wraps any payment action: when payments aren't connected, opens the calm sheet instead. */
export function usePaymentGate() {
  const { data } = useQuery(paymentsStatusQuery);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { t } = useTranslation();
  const { openCheckout, element } = useInlineCheckout();
  const ready = !!data?.connected && paymentsTokenPresent();
  const run = async (fn: () => Promise<{ ok: boolean; url?: string; clientSecret?: string; error?: string }>, opts?: { newTab?: boolean }) => {
    if (!ready) { setOpen(true); return; }
    setBusy(true);
    try {
      const r = await fn();
      // Inline form: hand the captured secret to the provider's own checkout.
      if (r.ok && r.clientSecret) { const secret = r.clientSecret; openCheckout(async () => secret); return; }
      if (r.ok && r.url) { if (opts?.newTab) window.open(r.url, '_blank', 'noopener'); else window.location.href = r.url; return; }
      if (r.ok) return; // the caller already reported its own outcome
      if (r.error === 'not_connected') setOpen(true);
      else toast.error(CHECKOUT_ERRORS.includes(r.error ?? '') ? t(`billing.checkoutError_${r.error}`) : r.error || t('billing.error'));
    } catch { toast.error(t('billing.error')); }
    setBusy(false);
  };
  return { run, busy, connected: ready, sheet: <><NotConnectedSheet open={open} onOpenChange={setOpen} />{element}</> };
}

export function UpgradeSheet({ open, onOpenChange, reason }: { open: boolean; onOpenChange: (o: boolean) => void; reason: 'gatherings' | 'storage' | 'guests' }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return <ResponsiveSheet open={open} onOpenChange={onOpenChange} title={t('billing.limitTitle')}>
    <p className="auth-subtitle">{t(`billing.limit_${reason}`)}</p>
    <p className="auth-subtitle">{t('billing.limitSafe')}</p>
    <Button className="onboarding-continue" onClick={() => { onOpenChange(false); void navigate({ to: '/plan' }); }}>{t('billing.seePlans')}</Button>
    <Button variant="secondary" onClick={() => onOpenChange(false)}>{t('billing.notNow')}</Button>
  </ResponsiveSheet>;
}

function Meter({ label, used, max }: { label: string; used: number; max: number | null }) {
  const pct = max ? Math.min(100, Math.round((used / max) * 100)) : 0;
  return <div className="plan-meter"><span className="plan-meter-label">{label}</span>{max !== null && <span className="plan-meter-bar" aria-hidden><span style={{ width: `${pct}%` }} className={pct >= 100 ? 'is-full' : pct >= 80 ? 'is-near' : ''} /></span>}</div>;
}

function Back({ to = '/me' as '/me' | '/plan' }) {
  const { t } = useTranslation();
  return <Link to={to} className="back-link"><ArrowLeft />{t('common.back')}</Link>;
}

export function PlanPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage === 'es' ? 'es' : 'en';
  const { userId } = useGatherwell();
  const qc = useQueryClient();
  const { data: st } = useQuery(planStatusQuery(userId));
  const { data: ws } = useQuery(workspaceQuery(userId));
  const { data: settings } = useQuery(planSettingsQuery);
  const [downgrade, setDowngrade] = useState<PlanId | null>(null);
  const gate = usePaymentGate();
  useCheckoutNotice();
  const checkout = useServerFn(startPlanCheckout);
  const license = useServerFn(startLicenseCheckout);
  const portal = useServerFn(openBillingPortal);
  const connect = useServerFn(startConnectOnboarding);
  const schedule = useServerFn(schedulePlanChange);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const rank: Record<PlanId, number> = { free: 0, growth: 1, pro: 2 };
  if (!st || !settings) return <p className="auth-subtitle">{t('publicEvent.loading')}</p>;
  const current = st.plan;
  const lim = st.limits;
  const usedMb = Math.round(st.usage.storage_bytes / 1048576);

  const choose = (id: PlanId) => {
    if (id === st.own_plan && st.legacy_price_cents === null) return;
    // Moving down keeps what they paid for, so it is scheduled for the month end.
    if (id === 'free' || rank[id] < rank[st.own_plan]) { setDowngrade(id); return; }
    trackEvent('upgrade_clicked', { plan: id });
    void gate.run(() => checkout({ data: { plan: id === 'growth' ? 'growth' : 'pro', origin, lang, environment: getStripeEnvironment() } }));
  };
  const runScheduled = (target: PlanId) => void gate.run(async () => {
    const r = await schedule({ data: { target, environment: getStripeEnvironment() } });
    if (r.ok) { toast.success(t('billing.downgradeScheduled', { date: fmtDate(r.at, lang) })); void qc.invalidateQueries({ queryKey: ['plan-status'] }); return { ok: true }; }
    return r;
  });
  const togglePassFee = async (on: boolean) => {
    const { error } = await supabase.rpc('set_pass_fee', { _on: on });
    if (error) toast.error(t('billing.error')); else void qc.invalidateQueries({ queryKey: ['plan-status'] });
  };

  return <>
    <PaymentTestModeBanner />
    <Back />
    <div className="page-heading"><div><span className="eyebrow">{t('billing.eyebrow')}</span><h1>{t('billing.title')}</h1></div></div>
    {st.status === 'past_due' && <div className="plan-banner" role="alert"><AlertCircle />{t('billing.pastDue')}<Button variant="link" onClick={() => void gate.run(() => portal({ data: { origin, environment: getStripeEnvironment() } }), { newTab: true })}>{t('billing.updateCard')}</Button></div>}
    {st.cancel_at_period_end && st.renews_at && <div className="plan-banner" role="status"><AlertCircle />{t('billing.cancelsOn', { date: fmtDate(st.renews_at, lang) })}</div>}
    {st.pending_plan && st.pending_plan_at && <div className="plan-banner" role="status"><AlertCircle />{t('billing.pendingSwitch', { plan: t(`billing.name_${st.pending_plan}`), date: fmtDate(st.pending_plan_at, lang) })}</div>}

    <section className="panel plan-current">
      <div><span className="eyebrow">{t('billing.current')}</span><h2>{st.source === 'license' ? t('billing.licensePlan', { leader: st.leader || st.team || '' }) : t(`billing.plan_${current}`)}</h2>
        {st.renews_at && <p className="auth-subtitle">{t('billing.renews', { date: new Date(st.renews_at).toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US', { month: 'long', day: 'numeric', year: 'numeric' }) })}</p>}</div>
      <div className="plan-meters">
        <Meter label={lim.gatherings === null ? t('billing.meterGatheringsUnlimited', { used: st.usage.gatherings }) : t('billing.meterGatherings', { used: st.usage.gatherings, max: lim.gatherings })} used={st.usage.gatherings} max={lim.gatherings} />
        <Meter label={lim.guests === null ? t('billing.meterGuestsUnlimited', { used: st.usage.largest_guests }) : t('billing.meterGuests', { used: st.usage.largest_guests, max: lim.guests })} used={st.usage.largest_guests} max={lim.guests} />
        <Meter label={t('billing.meterStorage', { used: formatStorage(usedMb, lang), max: formatStorage(lim.storage_mb, lang) })} used={usedMb} max={lim.storage_mb} />
        <Meter label={t('billing.meterAssistant', { used: st.usage.assistant, max: lim.assistant })} used={st.usage.assistant} max={lim.assistant} />
      </div>
      {st.has_customer && <Button variant="secondary" disabled={gate.busy} onClick={() => void gate.run(() => portal({ data: { origin, environment: getStripeEnvironment() } }), { newTab: true })}><CreditCard />{t('billing.manage')}</Button>}
    </section>

    {st.source === 'own' && (() => {
      const dfmt = (d: string) => new Date(d).toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US', { month: 'long', day: 'numeric' });
      const phase = noLimitsPhase(st.no_limits_until);
      return <section className="panel" aria-live="polite">
        <strong>{t('billing.feesMonth', { paid: formatMoney(st.fees_month, lang) })}</strong>
        {st.plan === 'free' && phase && st.no_limits_until && <p className="field-hint">{phase === 'active' ? t('billing.noLimitsUntil', { date: dfmt(st.no_limits_until) }) : t('billing.noLimitsEnding', { date: dfmt(st.no_limits_until) })}</p>}
      </section>;
    })()}
    {st.source === 'own' && st.plan === 'free' && !noLimitsPhase(st.no_limits_until) && (() => {
      const g = lim.gatherings !== null && st.usage.gatherings >= lim.gatherings;
      const q = lim.guests !== null && st.usage.largest_guests >= lim.guests;
      if (!g && !q) return null;
      return <section className="panel plan-upgrade" role="status">
        <h2>{t('billing.upgradeAdvTitle')}</h2>
        <p className="auth-subtitle">{g ? t('billing.upgradeReasonGatherings', { used: st.usage.gatherings, max: lim.gatherings }) : t('billing.upgradeReasonGuests', { max: lim.guests })}</p>
        <p className="field-hint">{t('billing.upgradeAdvBody')}</p>
        <Button variant="secondary" disabled>{t('pricingV4.setupRequired')}</Button>
      </section>;
    })()}
    {st.founding && <FoundingPlanBanner f={st.founding} />}
    {st.legacy_price_cents !== null && st.source === 'own' && !st.founding && <div className="plan-banner" role="status"><AlertCircle />{t('billing.legacyNote', { plan: t(`billing.name_${st.own_plan}`), price: formatMoney(st.legacy_price_cents, lang) })}</div>}

    <div className="plan-grid">
      {PLANS.map(p => {
        const ps = settings[p.id];
        const isCurrent = (st.source === 'founding' && p.id === 'pro') || st.source === 'own' && (st.own_plan === p.id && st.legacy_price_cents === null || (p.id === 'free' && st.own_plan === 'free'));
        return <article key={p.id} className={`plan-card ${isCurrent ? 'is-current' : ''} `}>
          <PlanCardBody id={p.id} setting={ps} tagClass="plan-tag" priceClass="plan-price" feeClass="plan-fee-line" />
          {isCurrent ? <Button variant="secondary" disabled>{t('billing.yourPlan')}</Button>
            : p.id !== 'free' && !gate.connected ? <Button variant="secondary" disabled>{t('billing.comingSoon')}</Button>
            : <Button variant={p.id === 'pro' ? 'default' : 'secondary'} disabled={gate.busy} onClick={() => choose(p.id)}>{p.id === 'free' ? t('billing.switchTo', { plan: t('billing.name_free') }) : t('billing.upgrade')}</Button>}
        </article>;
      })}
      <article className="plan-card plan-card-team">
        <h3>{t('billing.name_team')}</h3>
        <p className="auth-subtitle">{t('billing.teamText')}</p>
        {LICENSES.map(l => <div key={l.id} className="plan-license-row"><span><strong>{t(`billing.${l.id}`)}</strong><small>{t('billing.seatsGrowth', { n: l.seats })}</small></span><span className="plan-license-price">{formatMoney(l.cents, lang)}{t('billing.perMonth')}</span>
          {ws?.role === 'leader' && <Button variant="secondary" disabled={gate.busy} onClick={() => void gate.run(() => license({ data: { teamId: ws.teamId, tier: l.id, origin, lang, environment: getStripeEnvironment() } }))}>{t('billing.buy')}</Button>}</div>)}
        <div className="plan-license-row"><span><strong>{t('billing.organization')}</strong><small>{t('billing.orgText')}</small></span><Button asChild variant="secondary"><a href="mailto:help@gatherwell.app">{t('billing.contact')}</a></Button></div>
      </article>
    </div>

    <FoundingCommitmentsCard />
    <p className="auth-subtitle">{t('billing.cardNote')}</p>

    <section className="panel settings-list">
      {ws?.role === 'leader' && <Link className="settings-row" to="/plan/seats"><UsersRound className="settings-icon" /><span className="settings-label">{t('billing.seats')}</span><ChevronRight className="settings-chevron" /></Link>}
      <Link className="settings-row" to="/earnings"><BarChart3 className="settings-icon" /><span className="settings-label">{t('billing.earnings')}</span><ChevronRight className="settings-chevron" /></Link>
    </section>

    <section className="panel get-paid">
      <div className="section-heading"><h2>{t('billing.getPaid')}</h2><span className={`chip connect-${st.connect_status}`}>{t(`billing.connect_${st.connect_status}`)}</span></div>
      <p className="auth-subtitle">{lim.fee_cap != null ? t('billing.getPaidCapped', { n: lim.fee_pct, cap: formatMoney(lim.fee_cap, lang) }) : t('billing.getPaidText', { n: lim.fee_pct })}</p>
      {st.connect_status !== 'active' && <Button disabled={gate.busy} onClick={() => void gate.run(() => connect({ data: { origin } }))}>{st.connect_status === 'pending' ? t('billing.connectContinue') : t('billing.connectStart')}</Button>}
      <label className="settings-row is-static"><span className="settings-label">{t('billing.passFee')}<small className="field-hint">{t('billing.passFeeHint')}</small></span><Switch aria-label={t('billing.passFee')} checked={st.pass_fee} onCheckedChange={v => void togglePassFee(v)} /></label>
    </section>

    <ResponsiveSheet open={downgrade !== null} onOpenChange={o => { if (!o) setDowngrade(null); }} title={t('billing.downgradeTitle', { plan: downgrade ? t(`billing.name_${downgrade}`) : '' })}>
      {downgrade && <>
        <ul className="plan-features">
          <li>{t('billing.downKeep')}</li>
          {(() => { const l = { ...PLANS.find(p => p.id === downgrade)!.limits, fee_pct: settings[downgrade].fee_percent }; return <>
            <li>{l.gatherings === null ? t('billing.fGatheringsUnlimited') : t('billing.downGatherings', { n: l.gatherings })}</li>
            <li>{l.guests === null ? t('billing.fGuestsUnlimited') : t('billing.downGuests', { n: l.guests })}</li>
            <li>{t('billing.downStorage', { size: formatStorage(l.storage_mb, lang) })}</li>
            <li>{t('billing.fAssistant', { n: l.assistant })}</li>
            <li>{t('billing.fFee', { n: l.fee_pct })}</li></>; })()}
        </ul>
        <p className="field-hint">{t('billing.downgradeAtMonthEnd')}</p>
        <Button className="onboarding-continue" disabled={gate.busy} onClick={() => { const target = downgrade!; setDowngrade(null); runScheduled(target); }}>{t('billing.downConfirm')}</Button>
        <Button variant="secondary" onClick={() => setDowngrade(null)}>{t('billing.notNow')}</Button>
      </>}
    </ResponsiveSheet>
    {gate.sheet}
  </>;
}

export function SeatsPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage === 'es' ? 'es' : 'en';
  const { userId } = useGatherwell();
  const qc = useQueryClient();
  const { data: ws } = useQuery(workspaceQuery(userId));
  const teamId = ws?.teamId ?? '';
  const { data: lic } = useQuery({ ...licenseQuery(teamId), enabled: !!teamId });
  const { data: roster = [] } = useQuery({ ...rosterQuery(teamId), enabled: !!teamId });
  const { data: isAdmin } = useQuery(isAdminQuery(userId));
  const gate = usePaymentGate();
  const license = useServerFn(startLicenseCheckout);
  const [busy, setBusy] = useState<string | null>(null);
  if (ws && ws.role !== 'leader') return <><Back to="/plan" /><p className="auth-subtitle">{t('billing.leadersOnly')}</p></>;
  const used = lic?.seats.size ?? 0;
  const total = lic?.license?.seats ?? 0;
  const active = lic?.license && lic.license.status !== 'canceled';

  const toggle = async (uid: string, on: boolean) => {
    setBusy(uid);
    const { error } = await supabase.rpc('assign_license_seat', { _team: teamId, _user: uid, _on: on });
    setBusy(null);
    if (error) { toast.error(error.message.includes('seats_full') ? t('billing.seatsFull') : t('billing.error')); return; }
    void qc.invalidateQueries({ queryKey: ['license', teamId] }); void qc.invalidateQueries({ queryKey: ['plan-status'] });
  };
  const grantPreview = async () => {
    const { error } = await supabase.rpc('admin_grant_preview_license', { _team: teamId, _tier: 'team25' });
    if (error) toast.error(t('billing.error')); else void qc.invalidateQueries({ queryKey: ['license', teamId] });
  };

  return <>
    <PaymentTestModeBanner />
    <Back to="/plan" />
    <div className="page-heading"><div><span className="eyebrow">{ws?.name}</span><h1>{t('billing.seats')}</h1></div></div>
    {active ? <section className="panel">
      <div className="section-heading"><h2>{t(`billing.${lic!.license!.tier}`)}{lic!.license!.is_preview ? ` · ${t('billing.previewLicense')}` : ''}</h2><span className="chip">{t('billing.seatsUsed', { used, total })}</span></div>
      <Meter label={t('billing.seatsUsed', { used, total })} used={used} max={total} />
      <div className="seat-list">{roster.map(m => {
        const on = lic!.seats.has(m.userId);
        return <div key={m.userId} className="seat-row"><span><strong>{m.name ?? t('roles.member')}</strong><small>{t(`roles.${m.role}`)}{on ? ` · ${t('billing.name_growth')}` : ''}</small></span>
          <Button variant={on ? 'secondary' : 'default'} disabled={busy === m.userId || (!on && used >= total)} onClick={() => void toggle(m.userId, !on)}>{on ? t('billing.removeSeat') : t('billing.assignSeat')}</Button></div>;
      })}</div>
    </section> : <section className="panel">
      <EmptyState compact icon="CreditCard" text={t('billing.noLicense')} />
      {LICENSES.map(l => <div key={l.id} className="plan-license-row"><span><strong>{t(`billing.${l.id}`)}</strong><small>{t('billing.seatsGrowth', { n: l.seats })}</small></span><span className="plan-license-price">{formatMoney(l.cents, lang)}{t('billing.perMonth')}</span>
        <Button disabled={gate.busy} onClick={() => void gate.run(() => license({ data: { teamId, tier: l.id, origin: window.location.origin, lang, environment: getStripeEnvironment() } }))}>{t('billing.buy')}</Button></div>)}
      {isAdmin && <Button variant="secondary" onClick={() => void grantPreview()}>{t('billing.grantPreview')}</Button>}
    </section>}
    {gate.sheet}
  </>;
}

export function EarningsPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? 'en';
  const { userId } = useGatherwell();
  const qc = useQueryClient();
  const { data } = useQuery(earningsQuery(userId));
  const { data: st } = useQuery(planStatusQuery(userId));
  const gate = usePaymentGate();
  const refund = useServerFn(refundPayments);
  const [confirm, setConfirm] = useState<{ eventId?: string; paymentId?: string } | null>(null);
  const pays = data?.payments ?? [];
  const paid = pays.filter(p => p.status === 'paid');
  // Ticket sales exclude anything the guest paid on top (booking and service fees); a covered service fee comes out of the payout.
  const guestPaidFee = (p: (typeof paid)[number]) => p.booking_fee_cents + (p.service_fee_covered ? 0 : p.service_fee_cents);
  const sales = paid.reduce((s, p) => s + p.amount_cents - guestPaidFee(p), 0);
  const fees = paid.reduce((s, p) => s + p.fee_cents - p.booking_fee_cents, 0);
  const coveredService = paid.reduce((s, p) => s + (p.service_fee_covered ? p.service_fee_cents : 0), 0);
  const guestService = paid.reduce((s, p) => s + (p.service_fee_covered ? 0 : p.service_fee_cents), 0);
  const groups = new Map<string, typeof pays>();
  pays.forEach(p => { const k = p.event_id ?? 'other'; groups.set(k, [...(groups.get(k) ?? []), p]); });

  const doRefund = async () => {
    const c = confirm; setConfirm(null);
    if (!gate.connected) { void gate.run(async () => ({ ok: false, error: 'not_connected' })); return; }
    const r = await refund({ data: c ?? {} });
    if (r.ok) { toast.success(t('billing.refunded', { count: r.refunded })); void qc.invalidateQueries({ queryKey: ['earnings'] }); } else toast.error(t('billing.error'));
  };
  const stat = (label: string, value: ReactNode) => <div className="stat-card"><div className="stat-heading"><span>{label}</span></div><strong className="stat-value">{value}</strong></div>;

  return <>
    <Back to="/plan" />
    <div className="page-heading"><div><span className="eyebrow">{t('billing.eyebrow')}</span><h1>{t('billing.earnings')}</h1></div></div>
    <p className="auth-subtitle">{t('billing.earningsText')}</p>
    <RoiMeter />
    <EarningsMilestones />
    {st && st.limits.fee_cap != null && <section className="panel fee-cap-card" aria-live="polite">
      <div className="fee-cap-head"><strong>{t('billing.feesThisMonth', { paid: formatMoney(Math.min(st.fees_month, st.limits.fee_cap), lang), cap: formatMoney(st.limits.fee_cap, lang) })}</strong>
        {st.fees_month >= st.limits.fee_cap && <span className="chip connect-active">{t('billing.capReached')}</span>}</div>
      <span className="plan-meter-bar" aria-hidden><span style={{ width: `${Math.min(100, Math.round(st.fees_month / Math.max(st.limits.fee_cap, 1) * 100))}%` }} /></span>
      <p className="field-hint">{st.fees_month >= st.limits.fee_cap ? t('billing.capReachedHint') : t('billing.capHint', { pct: st.limits.fee_pct, cap: formatMoney(st.limits.fee_cap, lang) })}</p>
    </section>}
    <div className="stats-grid">{stat(t('billing.ticketSales'), formatMoney(sales, lang))}{stat(t('billing.platformFees'), formatMoney(fees, lang))}{stat(t('billing.serviceCovered'), formatMoney(coveredService, lang))}{stat(t('billing.payouts'), formatMoney(sales - fees - coveredService, lang))}{stat(t('billing.ticketsSold'), paid.length)}</div>
    {guestService > 0 && <p className="field-hint">{t('billing.guestServiceNote', { amount: formatMoney(guestService, lang) })}</p>}
    <PromoUsageCard />
    <ReferralCard format={c => formatMoney(c, lang)} />
    <WelcomeRewardsCard />
    {!pays.length ? <section className="panel"><EmptyState compact icon="CreditCard" text={t('billing.noSales')} /></section> : [...groups.entries()].map(([eid, list]) => {
      const ev = data?.events.get(eid);
      return <section key={eid} className="panel">
        <div className="section-heading"><h2>{ev?.title ?? t('billing.otherSales')}</h2>{eid !== 'other' && list.some(p => p.status === 'paid') && <Button variant="link" onClick={() => setConfirm({ eventId: eid })}>{t('billing.refundAll')}</Button>}</div>
        {list.map(p => <div key={p.id} className="seat-row"><span><strong>{p.buyer_name ?? t('billing.guest')}</strong><small>{formatMoney(p.amount_cents, lang)}{p.service_fee_cents ? ` · ${t(p.service_fee_covered ? 'billing.serviceFeeCoveredRow' : 'billing.serviceFeeRow', { fee: formatMoney(p.service_fee_cents, lang) })}` : ''} · {t(`billing.status_${p.status}`)}</small></span>
          {p.status === 'paid' && <Button variant="secondary" onClick={() => setConfirm({ paymentId: p.id })}>{t('billing.refund')}</Button>}</div>)}
      </section>;
    })}
    <ResponsiveSheet open={!!confirm} onOpenChange={o => { if (!o) setConfirm(null); }} title={confirm?.eventId ? t('billing.refundAll') : t('billing.refund')}>
      <p className="auth-subtitle">{t('billing.refundText')}</p>
      <Button className="onboarding-continue" onClick={() => void doRefund()}>{t('billing.refundConfirm')}</Button>
      <Button variant="secondary" onClick={() => setConfirm(null)}>{t('billing.notNow')}</Button>
    </ResponsiveSheet>
    {gate.sheet}
  </>;
}

type ValueMeter = { earned: number; fees: number; plan: string; founding: boolean; nudge: { kind: 'pro' | 'free'; saving: number } | null };
// Every figure here comes from paid sales this calendar month; the nudge appears only when the other plan would truly have cost less.
export function RoiMeter() {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? 'en';
  const { userId } = useGatherwell();
  const { data } = useQuery({ queryKey: ['value-meter', userId], queryFn: async () => { const { data, error } = await supabase.rpc('my_value_meter'); if (error) throw error; return data as unknown as ValueMeter; } });
  if (!data) return null;
  const total = Math.max(data.earned + data.fees, 1);
  return <section className="panel roi-meter" aria-live="polite">
    <p className="roi-line">{t('roi.line', { earned: formatMoney(data.earned, lang), fees: formatMoney(data.fees, lang) })}</p>
    <span className="roi-bar" aria-hidden><span className="roi-earned" style={{ width: `${Math.round(data.earned / total * 100)}%` }} /><span className="roi-fees" style={{ width: `${Math.round(data.fees / total * 100)}%` }} /></span>
    <div className="roi-legend"><span><i className="roi-dot roi-earned" />{t('roi.earned')}</span><span><i className="roi-dot roi-fees" />{t('roi.fees')}</span></div>
    {data.nudge && <p className="roi-nudge"><BarChart3 size={18} aria-hidden />{data.nudge.kind === 'pro' ? t('roi.pro', { amount: formatMoney(data.nudge.saving, lang) }) : t('roi.free', { amount: formatMoney(data.nudge.saving, lang) })}
      <Link to="/plan" className="roi-link">{t('roi.compare')}</Link></p>}
  </section>;
}
