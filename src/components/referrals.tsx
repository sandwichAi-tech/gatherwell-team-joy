import { useEffect, useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ArrowLeft, ChevronRight, Share2 } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { ResponsiveSheet } from '@/components/responsive-sheet';
import { EmptyState, ListSkeleton, RetryState } from '@/components/launch-states';
import { CopyButton, ShareButton } from '@/components/copy-button';
import { useGatherwell } from '@/components/gatherwell-shell';
import { supabase } from '@/integrations/supabase/client';
import { formatMoney, paymentsStatusQuery } from '@/lib/billing';
import { anonId } from '@/lib/analytics';
import { readRefParam, referralUrl, rewardCents, validateReward, REFERRAL_WINDOW_DAYS, type RewardKind, type RewardStatus } from '@/lib/referrals';

type Kind = 'event' | 'offer';
type Program = { id: string; item_kind: Kind; item_id: string; title: string; price_cents: number; eligible: boolean; enabled: boolean; reward_kind: RewardKind; reward_value: number; window_days: number };
type CoachReward = { id: string; program_id: string; referrer_id: string; referrer_name: string; sale_cents: number; reward_cents: number; status: RewardStatus; created_at: string };
type Payout = { id: string; referrer_id?: string; referrer_name?: string; amount_cents: number; paid_on: string; note?: string | null; reference?: string | null };
type Totals = { clicks: number; signups: number; conversions: number; revenue_cents: number; pending_cents: number; available_cents: number; paid_cents: number; reversed_cents: number };
type CoachData = { programs: Program[]; referrers: { id: string; name: string }[]; totals: Totals; rewards: CoachReward[]; payouts: Payout[] };
type Item = { kind: Kind; id: string; title: string; price_cents: number };
export type CoachFilters = { program: string; referrer: string; status: '' | RewardStatus; from: string; to: string };

const STATUSES: RewardStatus[] = ['pending', 'available', 'paid', 'reversed'];
const dateFmt = (iso: string, lang: string) => new Date(iso).toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const rewardLabel = (kind: RewardKind, value: number, lang: string) => kind === 'percent' ? `${value}%` : formatMoney(value, lang);

/** Builds the RPC arguments; empty filters mean "all". */
export function filterArgs(f: CoachFilters) {
  return { _program: f.program || undefined, _referrer: f.referrer || undefined, _status: f.status || undefined, _from: f.from || undefined, _to: f.to || undefined };
}

/** Landing capture on public event/offer pages: records ?rc= once per visit for this device (no personal data). */
export function useReferralCapture() {
  useEffect(() => {
    const code = readRefParam(new URLSearchParams(window.location.search).get('rc'));
    const visitor = anonId();
    if (!code || !/^[0-9a-f-]{36}$/i.test(visitor)) return;
    void supabase.rpc('record_referral_click', { _code: code, _visitor: visitor }).then(() => undefined, () => undefined);
  }, []);
}

/** After sign-up/login, attach this device's recent referral visits to the account. */
export function claimReferralVisits() {
  try {
    const v = localStorage.getItem('gatherwell-aid');
    if (v && /^[0-9a-f-]{36}$/i.test(v)) void supabase.rpc('claim_referral_visitor', { _visitor: v }).then(() => undefined, () => undefined);
  } catch { /* storage unavailable */ }
}

/** Signed-in, non-host visitors of an item with an active program can get their own private link. */
export function ReferralShareCard({ kind, id, signedIn }: { kind: Kind; id: string; signedIn: boolean }) {
  const { t, i18n } = useTranslation(); const lang = i18n.resolvedLanguage ?? 'en';
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['referral-program-for', kind, id], enabled: signedIn, queryFn: async () => {
    const { data, error } = await supabase.rpc('referral_program_for', { _kind: kind, _item: id }); if (error) throw error;
    return data as null | { program_id: string; reward_kind: RewardKind; reward_value: number; example_cents: number; price_cents: number; code: string | null };
  } });
  const [busy, setBusy] = useState(false);
  const [origin, setOrigin] = useState('');
  useEffect(() => setOrigin(window.location.origin), []);
  if (!signedIn || !q.data) return null;
  const p = q.data;
  const get = async () => {
    setBusy(true); const { error } = await supabase.rpc('get_referral_link', { _program: p.program_id }); setBusy(false);
    if (error) { toast.error(t('referral.errors.generic')); return; }
    void qc.invalidateQueries({ queryKey: ['referral-program-for', kind, id] });
  };
  const url = p.code ? referralUrl(origin, kind, id, p.code) : '';
  return <section className="guest-card referral-share" aria-labelledby="referral-share-title">
    <h2 id="referral-share-title" className="guest-subhead">{t('referral.share.title')}</h2>
    <p className="field-hint">{t('referral.share.body', { reward: rewardLabel(p.reward_kind, p.reward_value, lang), example: formatMoney(p.example_cents, lang), days: REFERRAL_WINDOW_DAYS })}</p>
    {p.code ? <>
      <p className="referral-code"><span className="field-label">{t('referral.code')}</span> <strong>{p.code}</strong></p>
      <div className="guest-button-row"><CopyButton text={url} label={t('referral.copyLink')} /><ShareButton url={url} /></div>
      <Link to="/referrals/mine" className="auth-link">{t('referral.mine.open')}<ChevronRight className="inline-icon" /></Link>
    </> : <Button disabled={busy} onClick={() => void get()}><Share2 />{t('referral.share.get')}</Button>}
  </section>;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return <div className="stat-card"><span className="stat-label">{label}</span><strong className="stat-value">{value}</strong></div>;
}

/** Row 56 + 57: host program setup and coach dashboard. */
export function CoachReferralsPage() {
  const { t, i18n } = useTranslation(); const lang = i18n.resolvedLanguage ?? 'en';
  const { userId } = useGatherwell();
  const qc = useQueryClient();
  const [f, setF] = useState<CoachFilters>({ program: '', referrer: '', status: '', from: '', to: '' });
  const { data: gate } = useQuery(paymentsStatusQuery);
  const dash = useQuery({ queryKey: ['referrals-coach', f], queryFn: async () => {
    const { data, error } = await supabase.rpc('coach_referral_dashboard', filterArgs(f)); if (error) throw error; return data as unknown as CoachData;
  } });
  const items = useQuery({ queryKey: ['referral-items', userId], queryFn: async () => {
    const [ev, of] = await Promise.all([
      supabase.from('events').select('id, title, price_cents').eq('host_id', userId).gt('price_cents', 0).neq('visibility', 'team').eq('team_registration', false).neq('status', 'cancelled').order('starts_at', { ascending: false }).limit(60),
      supabase.from('offers').select('id, title_en, title_es, price_cents').eq('host_id', userId).gt('price_cents', 0).in('kind', ['resource', 'course']).eq('visibility', 'public').neq('status', 'archived').limit(60),
    ]);
    if (ev.error) throw ev.error; if (of.error) throw of.error;
    return [...(ev.data ?? []).map(e => ({ kind: 'event' as const, id: e.id, title: e.title, price_cents: e.price_cents ?? 0 })),
      ...(of.data ?? []).map(o => ({ kind: 'offer' as const, id: o.id, title: (lang === 'es' ? o.title_es || o.title_en : o.title_en || o.title_es) ?? '', price_cents: o.price_cents ?? 0 }))] as Item[];
  } });
  const [edit, setEdit] = useState<{ item: Item; program?: Program } | null>(null);
  const [payFor, setPayFor] = useState<{ id: string; name: string } | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ['referrals-coach'] });
  const programs = dash.data?.programs ?? [];
  const rows = useMemo(() => {
    const map = new Map<string, { item: Item; program?: Program }>();
    for (const i of items.data ?? []) map.set(i.id, { item: i });
    for (const p of programs) map.set(p.item_id, { item: { kind: p.item_kind, id: p.item_id, title: p.title, price_cents: p.price_cents }, program: p });
    return [...map.values()];
  }, [items.data, programs]);
  const set = (p: Partial<CoachFilters>) => setF(x => ({ ...x, ...p }));
  const totals = dash.data?.totals;
  const progTitle = (id: string) => programs.find(p => p.id === id)?.title ?? '';
  const availableBy = (rid: string) => (dash.data?.rewards ?? []).filter(r => r.referrer_id === rid && r.status === 'available');

  return <>
    <Link to="/earnings" className="auth-link back-link"><ArrowLeft />{t('billing.earnings')}</Link>
    <div className="page-heading"><div><span className="eyebrow">{t('profile.groupHost')}</span><h1>{t('referral.coach.title')}</h1><p>{t('referral.coach.subtitle')}</p></div></div>
    <p className="not-connected" role="note">{gate?.connected ? t('referral.manualNote') : t('referral.notConnected')}</p>

    <section className="panel" aria-labelledby="ref-programs">
      <div className="section-heading"><h2 id="ref-programs">{t('referral.coach.programs')}</h2></div>
      <p className="field-hint">{t('referral.coach.freeNote')}</p>
      {items.isPending || dash.isPending ? <ListSkeleton /> : items.isError || dash.isError ? <RetryState retry={() => { void items.refetch(); void dash.refetch(); }} />
        : !rows.length ? <EmptyState compact icon="Share2" text={t('referral.coach.noItems')} />
        : rows.map(({ item, program }) => <div key={item.id} className="seat-row">
          <span><strong>{item.title}</strong><small>{formatMoney(item.price_cents, lang)} · {program ? `${t(program.enabled ? 'referral.on' : 'referral.off')} · ${rewardLabel(program.reward_kind, program.reward_value, lang)}` : t('referral.off')}</small></span>
          <Button variant="secondary" onClick={() => setEdit({ item, program })} aria-label={t('referral.coach.setupFor', { title: item.title })}>{program ? t('referral.coach.edit') : t('referral.coach.setup')}</Button>
        </div>)}
    </section>

    <section className="panel referral-filters" aria-labelledby="ref-filters">
      <h2 id="ref-filters">{t('referral.coach.activity')}</h2>
      <div className="referral-filter-grid">
        <label className="field"><span className="field-label">{t('referral.filters.item')}</span>
          <select className="gw-select" value={f.program} onChange={e => set({ program: e.target.value })}><option value="">{t('referral.filters.all')}</option>{programs.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</select></label>
        <label className="field"><span className="field-label">{t('referral.filters.referrer')}</span>
          <select className="gw-select" value={f.referrer} onChange={e => set({ referrer: e.target.value })}><option value="">{t('referral.filters.all')}</option>{(dash.data?.referrers ?? []).map(r => <option key={r.id} value={r.id}>{r.name || t('referral.unnamed')}</option>)}</select></label>
        <label className="field"><span className="field-label">{t('referral.filters.status')}</span>
          <select className="gw-select" value={f.status} onChange={e => set({ status: e.target.value as CoachFilters['status'] })}><option value="">{t('referral.filters.all')}</option>{STATUSES.map(s => <option key={s} value={s}>{t(`referral.status.${s}`)}</option>)}</select></label>
        <label className="field"><span className="field-label">{t('referral.filters.from')}</span><Input type="date" value={f.from} onChange={e => set({ from: e.target.value })} /></label>
        <label className="field"><span className="field-label">{t('referral.filters.to')}</span><Input type="date" value={f.to} onChange={e => set({ to: e.target.value })} /></label>
      </div>
      {totals && <div className="stats-grid" aria-live="polite">
        <Stat label={t('referral.stats.clicks')} value={totals.clicks} /><Stat label={t('referral.stats.signups')} value={totals.signups} />
        <Stat label={t('referral.stats.conversions')} value={totals.conversions} /><Stat label={t('referral.stats.revenue')} value={formatMoney(totals.revenue_cents, lang)} />
        {STATUSES.map(s => <Stat key={s} label={t(`referral.status.${s}`)} value={formatMoney(totals[`${s}_cents`], lang)} />)}
      </div>}
      {dash.data && (!dash.data.rewards.length ? <EmptyState compact icon="Share2" text={t('referral.coach.noRewards')} /> : dash.data.rewards.map(r => <div key={r.id} className="seat-row">
        <span><strong>{r.referrer_name || t('referral.unnamed')}</strong><small>{progTitle(r.program_id)} · {dateFmt(r.created_at, lang)} · {t('referral.sale', { amount: formatMoney(r.sale_cents, lang) })}</small></span>
        <span className={`chip referral-${r.status}`}>{formatMoney(r.reward_cents, lang)} · {t(`referral.status.${r.status}`)}</span>
      </div>))}
      {dash.data && dash.data.referrers.filter(r => availableBy(r.id).length).map(r => <Button key={r.id} variant="secondary" onClick={() => setPayFor(r)}>{t('referral.payout.recordFor', { name: r.name || t('referral.unnamed') })}</Button>)}
    </section>

    <section className="panel" aria-labelledby="ref-ledger">
      <h2 id="ref-ledger">{t('referral.payout.ledger')}</h2>
      <p className="field-hint">{t('referral.payout.ledgerHint')}</p>
      {!(dash.data?.payouts ?? []).length ? <EmptyState compact icon="CreditCard" text={t('referral.payout.none')} /> : dash.data!.payouts.map(p => <div key={p.id} className="seat-row">
        <span><strong>{p.referrer_name || t('referral.unnamed')}</strong><small>{t('referral.payout.recordedOn', { date: dateFmt(p.paid_on, lang) })}{p.reference ? ` · ${p.reference}` : ''}{p.note ? ` · ${p.note}` : ''}</small></span>
        <span className="chip">{formatMoney(p.amount_cents, lang)}</span></div>)}
    </section>

    {edit && <ProgramSheet item={edit.item} program={edit.program} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); void refresh(); }} />}
    {payFor && <PayoutSheet referrer={payFor} rewards={availableBy(payFor.id)} onClose={() => setPayFor(null)} onSaved={() => { setPayFor(null); void refresh(); }} />}
  </>;
}

/** Server error codes → copy keys. */
export function referralErrorKey(message: string | undefined) {
  const m = message ?? '';
  for (const k of ['percent_too_high', 'flat_too_high', 'ineligible', 'invalid_reward', 'payout_date', 'payout_invalid', 'payout_empty']) if (m.includes(`referral_${k}`)) return `referral.errors.${k}`;
  return 'referral.errors.generic';
}

function ProgramSheet({ item, program, onClose, onSaved }: { item: Item; program?: Program; onClose: () => void; onSaved: () => void }) {
  const { t, i18n } = useTranslation(); const lang = i18n.resolvedLanguage ?? 'en';
  const [enabled, setEnabled] = useState(program?.enabled ?? false);
  const [kind, setKind] = useState<RewardKind>(program?.reward_kind ?? 'percent');
  const [amount, setAmount] = useState(program ? (program.reward_kind === 'flat' ? String(program.reward_value / 100) : String(program.reward_value)) : '10');
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const value = kind === 'flat' ? Math.round(Number(amount) * 100) : Number(amount);
  const issue = validateReward(kind, value, item.price_cents);
  const save = async () => {
    if (issue) { setError(t(`referral.errors.${issue}`)); return; }
    setBusy(true); const { error: e } = await supabase.rpc('save_referral_program', { _kind: item.kind, _item: item.id, _enabled: enabled, _reward_kind: kind, _value: value }); setBusy(false);
    if (e) { setError(t(referralErrorKey(e.message))); return; }
    toast.success(t('referral.coach.saved')); onSaved();
  };
  return <ResponsiveSheet open onOpenChange={o => !o && onClose()} title={t('referral.coach.sheetTitle')} description={item.title}
    footer={<Button disabled={busy} onClick={() => void save()}>{t('referral.coach.save')}</Button>}>
    <label className="settings-row is-static"><span className="settings-label">{t('referral.coach.enable')}<small className="field-hint">{t('referral.coach.enableHint')}</small></span><Switch checked={enabled} onCheckedChange={setEnabled} aria-label={t('referral.coach.enable')} /></label>
    <fieldset className="field"><legend className="field-label">{t('referral.coach.rewardType')}</legend>
      <div className="segmented" role="radiogroup">{(['percent', 'flat'] as const).map(k => <label key={k} className={`segmented-option${kind === k ? ' is-active' : ''}`}><input type="radio" name="reward-kind" value={k} checked={kind === k} onChange={() => { setKind(k); setError(null); }} />{t(`referral.kind.${k}`)}</label>)}</div></fieldset>
    <label className="field"><span className="field-label">{kind === 'percent' ? t('referral.coach.percentLabel') : t('referral.coach.flatLabel')}</span>
      <Input inputMode="decimal" value={amount} onChange={e => { setAmount(e.target.value); setError(null); }} aria-invalid={!!issue} aria-describedby="ref-example" /></label>
    <p id="ref-example" className="field-hint" aria-live="polite">{issue ? t(`referral.errors.${issue}`) : t('referral.coach.example', { price: formatMoney(item.price_cents, lang), reward: formatMoney(rewardCents(kind, value, item.price_cents), lang) })}</p>
    <p className="field-hint"><strong>{t('referral.coach.window')}</strong> {t('referral.coach.windowValue', { days: REFERRAL_WINDOW_DAYS })}</p>
    <div className="referral-terms"><h3>{t('referral.terms.title')}</h3><ul>{(['eligibility', 'attribution', 'blocked', 'refunds', 'payouts'] as const).map(k => <li key={k}>{t(`referral.terms.${k}`, { days: REFERRAL_WINDOW_DAYS })}</li>)}</ul></div>
    {error && <p className="field-error" role="alert">{error}</p>}
  </ResponsiveSheet>;
}

function PayoutSheet({ referrer, rewards, onClose, onSaved }: { referrer: { id: string; name: string }; rewards: CoachReward[]; onClose: () => void; onSaved: () => void }) {
  const { t, i18n } = useTranslation(); const lang = i18n.resolvedLanguage ?? 'en';
  const [picked, setPicked] = useState<string[]>(rewards.map(r => r.id));
  const [date, setDate] = useState(''); const [reference, setReference] = useState(''); const [note, setNote] = useState('');
  const [confirm, setConfirm] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  useEffect(() => setDate(new Date().toISOString().slice(0, 10)), []);
  const total = rewards.filter(r => picked.includes(r.id)).reduce((s, r) => s + r.reward_cents, 0);
  const save = async () => {
    if (!confirm) { setError(t('referral.payout.confirmRequired')); return; }
    setBusy(true); const { error: e } = await supabase.rpc('record_referral_payout', { _referrer: referrer.id, _rewards: picked, _paid_on: date, _note: note, _reference: reference }); setBusy(false);
    if (e) { setError(t(referralErrorKey(e.message))); return; }
    toast.success(t('referral.payout.recorded')); onSaved();
  };
  return <ResponsiveSheet open onOpenChange={o => !o && onClose()} title={t('referral.payout.title')} description={referrer.name || t('referral.unnamed')}
    footer={<Button disabled={busy || !picked.length} onClick={() => void save()}>{t('referral.payout.save', { amount: formatMoney(total, lang) })}</Button>}>
    <p className="not-connected" role="note">{t('referral.payout.manualOnly')}</p>
    {rewards.map(r => <label key={r.id} className="settings-row is-static"><Checkbox checked={picked.includes(r.id)} onCheckedChange={v => setPicked(p => v ? [...p, r.id] : p.filter(x => x !== r.id))} />
      <span className="settings-label">{formatMoney(r.reward_cents, lang)}<small className="field-hint">{dateFmt(r.created_at, lang)}</small></span></label>)}
    <label className="field"><span className="field-label">{t('referral.payout.date')}</span><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
    <label className="field"><span className="field-label">{t('referral.payout.reference')}</span><Input value={reference} maxLength={120} onChange={e => setReference(e.target.value)} /></label>
    <label className="field"><span className="field-label">{t('referral.payout.note')}</span><Input value={note} maxLength={500} onChange={e => setNote(e.target.value)} /></label>
    <label className="settings-row is-static"><Checkbox checked={confirm} onCheckedChange={v => setConfirm(v === true)} /><span className="settings-label">{t('referral.payout.confirm')}</span></label>
    {error && <p className="field-error" role="alert">{error}</p>}
  </ResponsiveSheet>;
}

type MyData = { links: { code: string; item_kind: Kind; item_id: string; title: string; enabled: boolean; reward_kind: RewardKind; reward_value: number; clicks: number; conversions: number }[];
  totals: { pending_cents: number; available_cents: number; paid_cents: number; reversed_cents: number }; rewards: { id: string; title: string; reward_cents: number; status: RewardStatus; created_at: string }[]; payouts: Payout[] };

/** Row 58: each referrer's own private earnings. */
export function MyReferralsPage() {
  const { t, i18n } = useTranslation(); const lang = i18n.resolvedLanguage ?? 'en';
  const q = useQuery({ queryKey: ['referrals-mine'], queryFn: async () => { const { data, error } = await supabase.rpc('my_referral_dashboard'); if (error) throw error; return data as unknown as MyData; } });
  const [origin, setOrigin] = useState('');
  useEffect(() => setOrigin(window.location.origin), []);
  return <>
    <Link to="/me" className="auth-link back-link"><ArrowLeft />{t('nav.me')}</Link>
    <div className="page-heading"><div><h1>{t('referral.mine.title')}</h1><p>{t('referral.mine.subtitle')}</p></div></div>
    <p className="not-connected" role="note">{t('referral.mine.honest')}</p>
    {q.isPending ? <ListSkeleton /> : q.isError ? <RetryState retry={() => void q.refetch()} /> : <>
      <div className="stats-grid">{STATUSES.map(s => <Stat key={s} label={t(`referral.status.${s}`)} value={formatMoney(q.data.totals[`${s}_cents`], lang)} />)}</div>
      <section className="panel" aria-labelledby="my-links"><h2 id="my-links">{t('referral.mine.links')}</h2>
        {!q.data.links.length ? <EmptyState compact icon="Share2" text={t('referral.mine.noLinks')} /> : q.data.links.map(l => { const url = referralUrl(origin, l.item_kind, l.item_id, l.code); return <div key={l.code} className="referral-link-row">
          <span><strong>{l.title}</strong><small>{t('referral.code')} {l.code} · {rewardLabel(l.reward_kind, l.reward_value, lang)} · {t('referral.stats.clicksN', { count: l.clicks })} · {t('referral.stats.conversionsN', { count: l.conversions })}{!l.enabled ? ` · ${t('referral.paused')}` : ''}</small></span>
          {l.enabled && <span className="guest-button-row"><CopyButton text={url} label={t('referral.copyLink')} /><ShareButton url={url} title={l.title} /></span>}
        </div>; })}
      </section>
      <section className="panel" aria-labelledby="my-rewards"><h2 id="my-rewards">{t('referral.mine.rewards')}</h2>
        {!q.data.rewards.length ? <EmptyState compact icon="Gift" text={t('referral.mine.noRewards')} /> : q.data.rewards.map(r => <div key={r.id} className="seat-row">
          <span><strong>{r.title}</strong><small>{dateFmt(r.created_at, lang)}</small></span><span className={`chip referral-${r.status}`}>{formatMoney(r.reward_cents, lang)} · {t(`referral.status.${r.status}`)}</span></div>)}
      </section>
      <section className="panel" aria-labelledby="my-payouts"><h2 id="my-payouts">{t('referral.mine.payouts')}</h2>
        {!q.data.payouts.length ? <EmptyState compact icon="CreditCard" text={t('referral.payout.none')} /> : q.data.payouts.map(p => <div key={p.id} className="seat-row">
          <span><strong>{t('referral.payout.recordedOn', { date: dateFmt(p.paid_on, lang) })}</strong><small>{p.reference ?? ''}</small></span><span className="chip">{formatMoney(p.amount_cents, lang)}</span></div>)}
      </section>
      <section className="panel referral-terms" aria-labelledby="my-how"><h2 id="my-how">{t('referral.mine.how')}</h2>
        <ul>{(['attribution', 'blocked', 'states', 'refunds', 'payouts'] as const).map(k => <li key={k}>{t(`referral.terms.${k}`, { days: REFERRAL_WINDOW_DAYS })}</li>)}</ul></section>
    </>}
  </>;
}
