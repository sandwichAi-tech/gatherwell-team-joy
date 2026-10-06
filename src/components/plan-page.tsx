import { ReferralCard } from '@/components/network-share';
import { trackEvent } from '@/lib/analytics';
import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
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
import { earningsQuery, formatMoney, formatStorage, LICENSES, licenseQuery, paymentsStatusQuery, PLANS, planStatusQuery, type PlanId } from '@/lib/billing';
import { openBillingPortal, refundPayments, startConnectOnboarding, startLicenseCheckout, startPlanCheckout } from '@/lib/billing.functions';

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
  const run = async (fn: () => Promise<{ ok: boolean; url?: string; error?: string }>) => {
    if (!data?.connected) { setOpen(true); return; }
    setBusy(true);
    try {
      const r = await fn();
      if (r.ok && r.url) { window.location.href = r.url; return; }
      if (r.error === 'not_connected') setOpen(true); else toast.error(t('billing.error'));
    } catch { toast.error(t('billing.error')); }
    setBusy(false);
  };
  return { run, busy, connected: !!data?.connected, sheet: <NotConnectedSheet open={open} onOpenChange={setOpen} /> };
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
  const [period, setPeriod] = useState<'month' | 'year'>('month');
  const [downgrade, setDowngrade] = useState<PlanId | null>(null);
  const gate = usePaymentGate();
  const checkout = useServerFn(startPlanCheckout);
  const license = useServerFn(startLicenseCheckout);
  const portal = useServerFn(openBillingPortal);
  const connect = useServerFn(startConnectOnboarding);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  if (!st) return <p className="auth-subtitle">{t('publicEvent.loading')}</p>;
  const current = st.plan;
  const rank = { free: 0, growth: 1, pro: 2 } as const;
  const lim = st.limits;
  const usedMb = Math.round(st.usage.storage_bytes / 1048576);

  const choose = (id: PlanId) => {
    if (id === st.own_plan) return;
    if (rank[id] < rank[st.own_plan]) { setDowngrade(id); return; }
    if (id === 'free') return;
    trackEvent('upgrade_clicked', { plan: id }); void gate.run(() => checkout({ data: { plan: id, period, origin, lang } }));
  };
  const togglePassFee = async (on: boolean) => {
    const { error } = await supabase.rpc('set_pass_fee', { _on: on });
    if (error) toast.error(t('billing.error')); else void qc.invalidateQueries({ queryKey: ['plan-status'] });
  };

  return <>
    <Back />
    <div className="page-heading"><div><span className="eyebrow">{t('billing.eyebrow')}</span><h1>{t('billing.title')}</h1></div></div>
    {st.status === 'past_due' && <div className="plan-banner" role="alert"><AlertCircle />{t('billing.pastDue')}<Button variant="link" onClick={() => void gate.run(() => portal({ data: { origin } }))}>{t('billing.updateCard')}</Button></div>}

    <section className="panel plan-current">
      <div><span className="eyebrow">{t('billing.current')}</span><h2>{st.source === 'license' ? t('billing.licensePlan', { leader: st.leader || st.team || '' }) : t(`billing.plan_${current}`)}</h2>
        {st.renews_at && <p className="auth-subtitle">{t('billing.renews', { date: new Date(st.renews_at).toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US', { month: 'long', day: 'numeric', year: 'numeric' }) })}</p>}</div>
      <div className="plan-meters">
        <Meter label={lim.gatherings === null ? t('billing.meterGatheringsUnlimited', { used: st.usage.gatherings }) : t('billing.meterGatherings', { used: st.usage.gatherings, max: lim.gatherings })} used={st.usage.gatherings} max={lim.gatherings} />
        <Meter label={lim.guests === null ? t('billing.meterGuestsUnlimited', { used: st.usage.largest_guests }) : t('billing.meterGuests', { used: st.usage.largest_guests, max: lim.guests })} used={st.usage.largest_guests} max={lim.guests} />
        <Meter label={t('billing.meterStorage', { used: formatStorage(usedMb, lang), max: formatStorage(lim.storage_mb, lang) })} used={usedMb} max={lim.storage_mb} />
        <Meter label={t('billing.meterAssistant', { used: st.usage.assistant, max: lim.assistant })} used={st.usage.assistant} max={lim.assistant} />
      </div>
      {st.has_customer && <Button variant="secondary" disabled={gate.busy} onClick={() => void gate.run(() => portal({ data: { origin } }))}><CreditCard />{t('billing.manage')}</Button>}
    </section>

    <div className="segmented plan-toggle" role="group" aria-label={t('billing.period')}>
      {(['month', 'year'] as const).map(p => <Button key={p} variant="ghost" aria-pressed={period === p} className={period === p ? 'selected' : ''} onClick={() => setPeriod(p)}>{t(`billing.${p}ly`)}</Button>)}
    </div>
    {period === 'year' && <p className="auth-subtitle plan-save">{t('billing.annualSave')}</p>}

    <div className="plan-grid">
      {PLANS.map(p => {
        const isCurrent = st.own_plan === p.id && st.source === 'own' || (st.source === 'license' && p.id === 'growth');
        const price = period === 'month' ? p.month : p.year;
        return <article key={p.id} className={`plan-card ${isCurrent ? 'is-current' : ''} ${p.id === 'growth' ? 'is-popular' : ''}`}>
          {p.id === 'growth' && <span className="plan-tag">{t('billing.popular')}</span>}
          <h3>{t(`billing.name_${p.id}`)}</h3>
          <p className="plan-price"><strong>{formatMoney(price, lang)}</strong><span>{p.id === 'free' ? '' : t(period === 'month' ? 'billing.perMonth' : 'billing.perYear')}</span></p>
          <ul className="plan-features">
            <li><Check />{p.limits.gatherings === null ? t('billing.fGatheringsUnlimited') : t('billing.fGatherings', { n: p.limits.gatherings })}</li>
            <li><Check />{p.limits.guests === null ? t('billing.fGuestsUnlimited') : t('billing.fGuests', { n: p.limits.guests })}</li>
            <li><Check />{t('billing.fStorage', { size: formatStorage(p.limits.storage_mb, lang) })}</li>
            <li><Check />{t('billing.fAssistant', { n: p.limits.assistant.toLocaleString(lang) })}</li>
            <li><Check />{t('billing.fFee', { n: p.limits.fee_pct })}</li>
          </ul>
          {isCurrent ? <Button variant="secondary" disabled>{t('billing.yourPlan')}</Button>
            : <Button variant={p.id === 'growth' ? 'default' : 'secondary'} disabled={gate.busy} onClick={() => choose(p.id)}>{rank[p.id] < rank[st.own_plan] ? t('billing.switchTo', { plan: t(`billing.name_${p.id}`) }) : p.id === 'free' ? t('billing.included') : t('billing.upgrade')}</Button>}
        </article>;
      })}
      <article className="plan-card plan-card-team">
        <h3>{t('billing.name_team')}</h3>
        <p className="auth-subtitle">{t('billing.teamText')}</p>
        {LICENSES.map(l => <div key={l.id} className="plan-license-row"><span><strong>{t(`billing.${l.id}`)}</strong><small>{t('billing.seatsGrowth', { n: l.seats })}</small></span><span className="plan-license-price">{formatMoney(l.cents, lang)}{t('billing.perMonth')}</span>
          {ws?.role === 'leader' && <Button variant="secondary" disabled={gate.busy} onClick={() => void gate.run(() => license({ data: { teamId: ws.teamId, tier: l.id, origin, lang } }))}>{t('billing.buy')}</Button>}</div>)}
        <div className="plan-license-row"><span><strong>{t('billing.organization')}</strong><small>{t('billing.orgText')}</small></span><Button asChild variant="secondary"><a href="mailto:help@gatherwell.app">{t('billing.contact')}</a></Button></div>
      </article>
    </div>

    <section className="panel settings-list">
      {ws?.role === 'leader' && <Link className="settings-row" to="/plan/seats"><UsersRound className="settings-icon" /><span className="settings-label">{t('billing.seats')}</span><ChevronRight className="settings-chevron" /></Link>}
      <Link className="settings-row" to="/earnings"><BarChart3 className="settings-icon" /><span className="settings-label">{t('billing.earnings')}</span><ChevronRight className="settings-chevron" /></Link>
    </section>

    <section className="panel get-paid">
      <div className="section-heading"><h2>{t('billing.getPaid')}</h2><span className={`chip connect-${st.connect_status}`}>{t(`billing.connect_${st.connect_status}`)}</span></div>
      <p className="auth-subtitle">{t('billing.getPaidText', { n: lim.fee_pct })}</p>
      {st.connect_status !== 'active' && <Button disabled={gate.busy} onClick={() => void gate.run(() => connect({ data: { origin } }))}>{st.connect_status === 'pending' ? t('billing.connectContinue') : t('billing.connectStart')}</Button>}
      <label className="settings-row is-static"><span className="settings-label">{t('billing.passFee')}<small className="field-hint">{t('billing.passFeeHint')}</small></span><Switch aria-label={t('billing.passFee')} checked={st.pass_fee} onCheckedChange={v => void togglePassFee(v)} /></label>
    </section>

    <ResponsiveSheet open={downgrade !== null} onOpenChange={o => { if (!o) setDowngrade(null); }} title={t('billing.downgradeTitle', { plan: downgrade ? t(`billing.name_${downgrade}`) : '' })}>
      {downgrade && <>
        <ul className="plan-features">
          <li>{t('billing.downKeep')}</li>
          {(() => { const l = PLANS.find(p => p.id === downgrade)!.limits; return <>
            <li>{l.gatherings === null ? t('billing.fGatheringsUnlimited') : t('billing.downGatherings', { n: l.gatherings })}</li>
            <li>{l.guests === null ? t('billing.fGuestsUnlimited') : t('billing.downGuests', { n: l.guests })}</li>
            <li>{t('billing.downStorage', { size: formatStorage(l.storage_mb, lang) })}</li>
            <li>{t('billing.fAssistant', { n: l.assistant })}</li>
            <li>{t('billing.fFee', { n: l.fee_pct })}</li></>; })()}
        </ul>
        <Button className="onboarding-continue" onClick={() => { setDowngrade(null); void gate.run(() => portal({ data: { origin } })); }}>{t('billing.downConfirm')}</Button>
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
      <p className="auth-subtitle">{t('billing.noLicense')}</p>
      {LICENSES.map(l => <div key={l.id} className="plan-license-row"><span><strong>{t(`billing.${l.id}`)}</strong><small>{t('billing.seatsGrowth', { n: l.seats })}</small></span><span className="plan-license-price">{formatMoney(l.cents, lang)}{t('billing.perMonth')}</span>
        <Button disabled={gate.busy} onClick={() => void gate.run(() => license({ data: { teamId, tier: l.id, origin: window.location.origin, lang } }))}>{t('billing.buy')}</Button></div>)}
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
  const gate = usePaymentGate();
  const refund = useServerFn(refundPayments);
  const [confirm, setConfirm] = useState<{ eventId?: string; paymentId?: string } | null>(null);
  const pays = data?.payments ?? [];
  const paid = pays.filter(p => p.status === 'paid');
  const sales = paid.reduce((s, p) => s + p.amount_cents - p.booking_fee_cents, 0);
  const fees = paid.reduce((s, p) => s + p.fee_cents - p.booking_fee_cents, 0);
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
    <div className="stats-grid">{stat(t('billing.ticketSales'), formatMoney(sales, lang))}{stat(t('billing.platformFees'), formatMoney(fees, lang))}{stat(t('billing.payouts'), formatMoney(sales - fees, lang))}{stat(t('billing.ticketsSold'), paid.length)}</div>
    <ReferralCard format={c => formatMoney(c, lang)} />
    {!pays.length ? <section className="panel"><p className="auth-subtitle">{t('billing.noSales')}</p></section> : [...groups.entries()].map(([eid, list]) => {
      const ev = data?.events.get(eid);
      return <section key={eid} className="panel">
        <div className="section-heading"><h2>{ev?.title ?? t('billing.otherSales')}</h2>{eid !== 'other' && list.some(p => p.status === 'paid') && <Button variant="link" onClick={() => setConfirm({ eventId: eid })}>{t('billing.refundAll')}</Button>}</div>
        {list.map(p => <div key={p.id} className="seat-row"><span><strong>{p.buyer_name ?? t('billing.guest')}</strong><small>{formatMoney(p.amount_cents, lang)} · {t(`billing.status_${p.status}`)}</small></span>
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
