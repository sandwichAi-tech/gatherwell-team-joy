import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Pencil, Trash2, ChevronRight } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { ResponsiveSheet } from '@/components/responsive-sheet';
import { EmptyState, ListSkeleton, RetryState } from '@/components/launch-states';
import { useGatherwell } from '@/components/gatherwell-shell';
import { supabase } from '@/integrations/supabase/client';
import { formatMoney, paymentsStatusQuery } from '@/lib/billing';
import { normalizeCode } from '@/lib/promo';
import type { Database } from '@/integrations/supabase/types';

type Row = Database['public']['Tables']['promo_codes']['Row'];
type Item = { id: string; title: string };

const promosQuery = (userId: string) => ({
  queryKey: ['promos', userId],
  queryFn: async () => {
    const [codes, usage, ev, ch, of] = await Promise.all([
      supabase.from('promo_codes').select('*').eq('host_id', userId).order('created_at', { ascending: false }),
      supabase.rpc('promo_usage'),
      supabase.from('events').select('id, title').eq('host_id', userId).not('price_cents', 'is', null).gte('starts_at', new Date().toISOString()).order('starts_at').limit(60),
      supabase.from('challenges').select('id, title_en, title_es').eq('created_by', userId).eq('is_paid', true).limit(60),
      supabase.from('offers').select('id, title_en, title_es').eq('host_id', userId).not('price_cents', 'is', null).limit(60),
    ]);
    if (codes.error) throw codes.error;
    const use = new Map((usage.data ?? []).map(u => [u.promo_id, u]));
    return { codes: codes.data ?? [], use, events: (ev.data ?? []) as Item[], challenges: (ch.data ?? []).map(c => ({ id: c.id, title: c.title_en || c.title_es || '' })), offers: (of.data ?? []).map(o => ({ id: o.id, title: o.title_en || o.title_es || '' })) };
  },
});

const label = (r: Pick<Row, 'kind' | 'amount'>, lang: string) => r.kind === 'percent' ? `${r.amount}%` : formatMoney(r.amount, lang);

/** Earnings card: how each code has been used. */
export function PromoUsageCard() {
  const { t, i18n } = useTranslation(); const lang = i18n.resolvedLanguage ?? 'en';
  const { userId } = useGatherwell();
  const { data } = useQuery(promosQuery(userId));
  const codes = data?.codes ?? [];
  return <section className="panel">
    <div className="section-heading"><h2>{t('promo.usageTitle')}</h2><Link to="/promos" className="auth-link">{t('promo.manage')}<ChevronRight className="inline-icon" /></Link></div>
    {!codes.length ? <EmptyState compact icon="Gift" text={t('promo.noCodes')} /> : codes.map(c => { const u = data!.use.get(c.id); return <div key={c.id} className="seat-row">
      <span><strong>{c.code}</strong><small>{label(c, lang)} · {t('promo.uses', { count: u?.uses ?? 0 })}{c.max_uses ? ` / ${c.max_uses}` : ''}</small></span>
      <span className="chip">{t('promo.discounted', { amount: formatMoney(u?.discount_cents ?? 0, lang) })}</span></div>; })}
  </section>;
}

export function PromoCodesPage() {
  const { t, i18n } = useTranslation(); const lang = i18n.resolvedLanguage ?? 'en';
  const { userId } = useGatherwell();
  const qc = useQueryClient();
  const q = useQuery(promosQuery(userId));
  const { data: gate } = useQuery(paymentsStatusQuery);
  const [edit, setEdit] = useState<Partial<Row> | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ['promos'] });
  const toggle = async (r: Row, active: boolean) => { const { error } = await supabase.from('promo_codes').update({ active }).eq('id', r.id); if (error) toast.error(t('profile.saveError')); else void refresh(); };
  const remove = async (r: Row) => { const { error } = await supabase.from('promo_codes').delete().eq('id', r.id); if (error) toast.error(t('profile.saveError')); else { toast.success(t('promo.deleted')); void refresh(); } };

  return <>
    <Link to="/me" className="auth-link back-link"><ArrowLeft />{t('profile.groupHost')}</Link>
    <div className="page-heading"><div><span className="eyebrow">{t('profile.groupHost')}</span><h1>{t('promo.title')}</h1><p>{t('promo.subtitle')}</p></div>
      <Button onClick={() => setEdit({ kind: 'percent', amount: 10, applies_all: true, active: true, event_ids: [], challenge_ids: [], offer_ids: [] })}><Plus />{t('promo.new')}</Button></div>
    {gate && !gate.connected && <p className="not-connected">{t('promo.notConnected')}</p>}
    {q.isPending ? <ListSkeleton /> : q.isError ? <RetryState retry={() => void q.refetch()} /> : <section className="panel">
      {!q.data.codes.length ? <EmptyState compact icon="Gift" text={t('promo.noCodes')} /> : q.data.codes.map(c => { const u = q.data.use.get(c.id); const n = c.event_ids.length + c.challenge_ids.length + c.offer_ids.length; return <div key={c.id} className="seat-row promo-row-item">
        <span><strong>{c.code}</strong><small>{t('promo.off', { amount: label(c, lang) })} · {c.applies_all ? t('promo.everything') : t('promo.items', { count: n })} · {t('promo.uses', { count: u?.uses ?? 0 })}{c.max_uses ? ` / ${c.max_uses}` : ''}{c.ends_at ? ` · ${t('promo.endsOn', { date: new Date(c.ends_at).toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US', { month: 'short', day: 'numeric' }) })}` : ''}</small></span>
        <span className="promo-row-actions"><Switch checked={c.active} aria-label={t('promo.active')} onCheckedChange={v => void toggle(c, v)} />
          <Button variant="ghost" size="icon" aria-label={t('promo.edit', { code: c.code })} onClick={() => setEdit(c)}><Pencil /></Button>
          <Button variant="ghost" size="icon" aria-label={t('promo.delete', { code: c.code })} onClick={() => void remove(c)}><Trash2 /></Button></span>
      </div>; })}
    </section>}
    {edit && q.data && <PromoSheet initial={edit} data={q.data} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); void refresh(); }} userId={userId} />}
  </>;
}

const toDate = (iso?: string | null) => iso ? iso.slice(0, 10) : '';

function PromoSheet({ initial, data, onClose, onSaved, userId }: { initial: Partial<Row>; data: { events: Item[]; challenges: Item[]; offers: Item[] }; onClose: () => void; onSaved: () => void; userId: string }) {
  const { t } = useTranslation();
  const [f, setF] = useState({ code: initial.code ?? '', kind: initial.kind ?? 'percent', amount: initial.kind === 'flat' ? String((initial.amount ?? 0) / 100) : String(initial.amount ?? 10), applies_all: initial.applies_all ?? true,
    event_ids: initial.event_ids ?? [], challenge_ids: initial.challenge_ids ?? [], offer_ids: initial.offer_ids ?? [], max_uses: initial.max_uses ? String(initial.max_uses) : '', per_person: initial.per_person ? String(initial.per_person) : '',
    start: toDate(initial.starts_at), end: toDate(initial.ends_at), active: initial.active ?? true });
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const set = (p: Partial<typeof f>) => setF(x => ({ ...x, ...p }));
  const pick = (k: 'event_ids' | 'challenge_ids' | 'offer_ids', id: string, on: boolean) => set({ [k]: on ? [...f[k], id] : f[k].filter(x => x !== id) } as Partial<typeof f>);
  const save = async () => {
    const code = normalizeCode(f.code); const n = Number(f.amount);
    if (code.length < 3) { setError(t('promo.errors.codeShort')); return; }
    if (!Number.isFinite(n) || n <= 0 || (f.kind === 'percent' && n > 100)) { setError(t('promo.errors.amount')); return; }
    if (!f.applies_all && !f.event_ids.length && !f.challenge_ids.length && !f.offer_ids.length) { setError(t('promo.errors.pick')); return; }
    if (f.start && f.end && f.end < f.start) { setError(t('promo.errors.dates')); return; }
    const row = { host_id: userId, code, kind: f.kind, amount: f.kind === 'flat' ? Math.round(n * 100) : Math.round(n), applies_all: f.applies_all,
      event_ids: f.applies_all ? [] : f.event_ids, challenge_ids: f.applies_all ? [] : f.challenge_ids, offer_ids: f.applies_all ? [] : f.offer_ids,
      max_uses: f.max_uses ? Math.max(1, Number(f.max_uses)) : null, per_person: f.per_person ? Math.max(1, Number(f.per_person)) : null,
      starts_at: f.start ? new Date(`${f.start}T00:00:00`).toISOString() : null, ends_at: f.end ? new Date(`${f.end}T23:59:59`).toISOString() : null, active: f.active };
    setBusy(true); setError(null);
    const { error: err } = initial.id ? await supabase.from('promo_codes').update(row).eq('id', initial.id) : await supabase.from('promo_codes').insert(row);
    setBusy(false);
    if (err) { setError(t(err.code === '23505' ? 'promo.errors.taken' : 'profile.saveError')); return; }
    toast.success(t('profile.saved')); onSaved();
  };
  const group = (k: 'event_ids' | 'challenge_ids' | 'offer_ids', title: string, items: Item[]) => items.length > 0 && <fieldset className="promo-targets"><legend className="field-label">{title}</legend>
    {items.map(i => <label key={i.id} className="guest-consent"><Checkbox checked={f[k].includes(i.id)} onCheckedChange={v => pick(k, i.id, !!v)} /><span>{i.title}</span></label>)}</fieldset>;

  return <ResponsiveSheet open onOpenChange={o => !o && onClose()} title={initial.id ? t('promo.editTitle') : t('promo.new')}
    footer={<Button className="onboarding-continue" disabled={busy} onClick={() => void save()}>{busy ? t('guest.saving') : t('profile.save')}</Button>}>
    <div className="edit-form">
      <div><label className="field-label" htmlFor="pc-code">{t('promo.code')}</label><Input id="pc-code" className="field-input" maxLength={20} autoCapitalize="characters" value={f.code} onChange={e => set({ code: normalizeCode(e.target.value) })} placeholder="SPRING20" /></div>
      <div className="form-field"><span className="field-label">{t('promo.type')}</span>
        <div className="segmented" role="group" aria-label={t('promo.type')}>{(['percent', 'flat'] as const).map(k => <Button key={k} type="button" variant="ghost" aria-pressed={f.kind === k} className={f.kind === k ? 'selected' : ''} onClick={() => set({ kind: k })}>{t(`promo.kind_${k}`)}</Button>)}</div></div>
      <div><label className="field-label" htmlFor="pc-amt">{t(f.kind === 'percent' ? 'promo.percentLabel' : 'promo.flatLabel')}</label><Input id="pc-amt" className="field-input" inputMode="decimal" value={f.amount} onChange={e => set({ amount: e.target.value.replace(/[^0-9.]/g, '') })} /></div>
      <label className="switch-row"><Switch checked={f.applies_all} onCheckedChange={v => set({ applies_all: v })} /><span><strong>{t('promo.appliesAll')}</strong><small>{t('promo.appliesAllHelp')}</small></span></label>
      {!f.applies_all && <>{group('event_ids', t('promo.gatherings'), data.events)}{group('challenge_ids', t('promo.challenges'), data.challenges)}{group('offer_ids', t('promo.offers'), data.offers)}
        {!data.events.length && !data.challenges.length && !data.offers.length && <p className="guest-hint">{t('promo.nothingPaid')}</p>}</>}
      <div className="guest-name-row">
        <div><label className="field-label" htmlFor="pc-max">{t('promo.maxUses')}</label><Input id="pc-max" className="field-input" inputMode="numeric" placeholder={t('promo.unlimited')} value={f.max_uses} onChange={e => set({ max_uses: e.target.value.replace(/\D/g, '') })} /></div>
        <div><label className="field-label" htmlFor="pc-pp">{t('promo.perPerson')}</label><Input id="pc-pp" className="field-input" inputMode="numeric" placeholder={t('promo.unlimited')} value={f.per_person} onChange={e => set({ per_person: e.target.value.replace(/\D/g, '') })} /></div>
      </div>
      <div className="guest-name-row">
        <div><label className="field-label" htmlFor="pc-start">{t('promo.starts')}</label><Input id="pc-start" type="date" className="field-input" value={f.start} onChange={e => set({ start: e.target.value })} /></div>
        <div><label className="field-label" htmlFor="pc-end">{t('promo.ends')}</label><Input id="pc-end" type="date" className="field-input" value={f.end} onChange={e => set({ end: e.target.value })} /></div>
      </div>
      <label className="switch-row"><Switch checked={f.active} onCheckedChange={v => set({ active: v })} /><span><strong>{t('promo.active')}</strong><small>{t('promo.activeHelp')}</small></span></label>
      {error && <p className="field-error" role="alert">{error}</p>}
    </div>
  </ResponsiveSheet>;
}
