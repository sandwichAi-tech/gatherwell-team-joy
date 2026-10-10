import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { GwFeatureTile, GwIcon } from '@/components/gw-icon';
import { GatheringCover } from '@/components/gathering-cover';
import { CropFileInput } from '@/components/image-crop';
import { formatMoney } from '@/lib/billing';
import { linesOf, paymentSchedule, tripDays, type Retreat, type RetreatPayment } from '@/lib/retreat';

const fmtDate = (d: Date | string, lang: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' }) => new Intl.DateTimeFormat(lang === 'es' ? 'es-MX' : 'en-US', opts).format(typeof d === 'string' ? new Date(d) : d);

// ============ Host editor ============
export function RetreatEditor({ value, onChange, end, setEnd, priceCents, onUpload, uploading }: {
  value: Retreat; onChange: (r: Retreat) => void; end: string; setEnd: (v: string) => void; priceCents: number | null;
  onUpload: (file: File) => Promise<string | null>; uploading: boolean;
}) {
  const { t } = useTranslation();
  const set = (p: Partial<Retreat>) => onChange({ ...value, ...p });
  const pay = (p: Partial<RetreatPayment>) => set({ payment: { ...value.payment, ...p } });
  return <div className="retreat-editor">
    <label className="field-label" htmlFor="r-end">{t('retreat.ends')}</label>
    <Input id="r-end" type="datetime-local" className="field-input" value={end} onChange={e => setEnd(e.target.value)} />

    <span className="field-label">{t('retreat.gallery')}</span>
    <div className="retreat-gallery-edit">
      {value.gallery.map((p, i) => <div key={p} className="retreat-thumb"><GatheringCover path={p} title="" className="retreat-thumb-img" /><button type="button" aria-label={t('retreat.removePhoto')} onClick={() => set({ gallery: value.gallery.filter((_, j) => j !== i) })}><GwIcon name="X" size={16} /></button></div>)}
      {value.gallery.length < 6 && <label className="file-button retreat-add-photo"><GwIcon name="Camera" /><span>{uploading ? t('onboarding.saving') : t('retreat.addPhoto')}</span>
        <CropFileInput kind="cover" onCropped={async r => { const path = await onUpload(r.file); if (path) set({ gallery: [...value.gallery, path] }); }} onRejected={() => toast.error(t('gathering.photoTooBig'))} /></label>}
    </div>

    <span className="field-label">{t('retreat.itinerary')}</span>
    {value.itinerary.map((d, i) => <div key={i} className="retreat-day-edit">
      <strong className="retreat-day-num">{t('retreat.dayN', { n: i + 1 })}</strong>
      <Input className="field-input" maxLength={100} value={d.title} placeholder={t('retreat.dayTitle')} aria-label={t('retreat.dayTitle')} onChange={e => set({ itinerary: value.itinerary.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} />
      <Textarea rows={3} maxLength={1500} className="field-textarea" value={d.items} placeholder={t('retreat.dayItems')} aria-label={t('retreat.dayItems')} onChange={e => set({ itinerary: value.itinerary.map((x, j) => (j === i ? { ...x, items: e.target.value } : x)) })} />
      {value.itinerary.length > 1 && <Button variant="ghost" size="sm" onClick={() => set({ itinerary: value.itinerary.filter((_, j) => j !== i) })}><GwIcon name="Trash2" />{t('retreat.removeDay')}</Button>}
    </div>)}
    {value.itinerary.length < 31 && <Button variant="secondary" onClick={() => set({ itinerary: [...value.itinerary, { title: '', items: '' }] })}><GwIcon name="Plus" />{t('retreat.addDay')}</Button>}

    <label className="field-label" htmlFor="r-lodging">{t('retreat.lodging')}</label>
    <Textarea id="r-lodging" rows={2} maxLength={1000} className="field-textarea" value={value.lodging} onChange={e => set({ lodging: e.target.value })} placeholder={t('retreat.lodgingPh')} />
    <label className="field-label" htmlFor="r-meals">{t('retreat.meals')}</label>
    <Textarea id="r-meals" rows={2} maxLength={1000} className="field-textarea" value={value.meals} onChange={e => set({ meals: e.target.value })} placeholder={t('retreat.mealsPh')} />
    <div className="two-col">
      <div><label className="field-label" htmlFor="r-inc">{t('retreat.included')}</label><Textarea id="r-inc" rows={4} maxLength={1500} className="field-textarea" value={value.included} onChange={e => set({ included: e.target.value })} placeholder={t('retreat.onePerLine')} /></div>
      <div><label className="field-label" htmlFor="r-notinc">{t('retreat.notIncluded')}</label><Textarea id="r-notinc" rows={4} maxLength={1500} className="field-textarea" value={value.not_included} onChange={e => set({ not_included: e.target.value })} placeholder={t('retreat.onePerLine')} /></div>
    </div>

    <span className="field-label">{t('retreat.payment')}</span>
    <div className="segmented full" role="group" aria-label={t('retreat.payment')}>{(['full', 'deposit', 'plan'] as const).map(m => <Button key={m} variant="ghost" className={value.payment.mode === m ? 'selected' : ''} aria-pressed={value.payment.mode === m} disabled={m !== 'full' && !priceCents} onClick={() => pay({ mode: m })}>{t(`retreat.mode.${m}`)}</Button>)}</div>
    {!priceCents && <p className="field-hint">{t('retreat.paymentNeedsPrice')}</p>}
    {value.payment.mode !== 'full' && <div className="two-col">
      {value.payment.mode === 'deposit'
        ? <div><label className="field-label" htmlFor="r-dep">{t('retreat.deposit')}</label><Input id="r-dep" inputMode="decimal" className="field-input" value={value.payment.deposit_cents ? String(value.payment.deposit_cents / 100) : ''} onChange={e => pay({ deposit_cents: Math.round(Number(e.target.value.replace(/[^\d.]/g, '')) * 100) || 0 })} placeholder="$0" /></div>
        : <div><span className="field-label">{t('retreat.installments')}</span><div className="segmented full" role="group" aria-label={t('retreat.installments')}>{[2, 3, 4].map(n => <Button key={n} variant="ghost" className={value.payment.installments === n ? 'selected' : ''} aria-pressed={value.payment.installments === n} onClick={() => pay({ installments: n })}>{n}</Button>)}</div></div>}
      <div><label className="field-label" htmlFor="r-due">{t('retreat.balanceDue')}</label><Input id="r-due" type="date" className="field-input" value={value.payment.balance_due ?? ''} onChange={e => pay({ balance_due: e.target.value })} /></div>
    </div>}
    {priceCents && value.payment.mode !== 'full' && value.payment.balance_due ? <PaymentSchedule priceCents={priceCents} payment={value.payment} /> : null}

    <label className="field-label" htmlFor="r-refund">{t('retreat.refund')}</label>
    <Textarea id="r-refund" rows={3} maxLength={1500} className="field-textarea" value={value.refund_policy} onChange={e => set({ refund_policy: e.target.value })} placeholder={t('retreat.refundPh')} />
    <p className="field-hint">{t('retreat.waiverNote')}</p>

    <label className="field-label" htmlFor="r-check">{t('retreat.checklist')}</label>
    <Textarea id="r-check" rows={4} maxLength={2000} className="field-textarea" value={value.checklist.join('\n')} onChange={e => set({ checklist: e.target.value.split('\n').slice(0, 20) })} placeholder={t('retreat.checklistPh')} />

    <span className="field-label">{t('retreat.faq')}</span>
    {value.faq.map((f, i) => <div key={i} className="retreat-day-edit">
      <Input className="field-input" maxLength={200} value={f.q} placeholder={t('retreat.question')} aria-label={t('retreat.question')} onChange={e => set({ faq: value.faq.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)) })} />
      <Textarea rows={2} maxLength={1000} className="field-textarea" value={f.a} placeholder={t('retreat.answer')} aria-label={t('retreat.answer')} onChange={e => set({ faq: value.faq.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)) })} />
      <Button variant="ghost" size="sm" onClick={() => set({ faq: value.faq.filter((_, j) => j !== i) })}><GwIcon name="Trash2" />{t('retreat.removeQuestion')}</Button>
    </div>)}
    {value.faq.length < 12 && <Button variant="secondary" onClick={() => set({ faq: [...value.faq, { q: '', a: '' }] })}><GwIcon name="Plus" />{t('retreat.addQuestion')}</Button>}
  </div>;
}

/** Strip empty rows before saving. */
export function cleanRetreat(r: Retreat): Retreat {
  return { ...r, itinerary: r.itinerary.filter(d => d.title.trim() || d.items.trim()), faq: r.faq.filter(f => f.q.trim() && f.a.trim()), checklist: r.checklist.map(x => x.trim()).filter(Boolean),
    payment: r.payment.mode === 'full' ? { mode: 'full' } : r.payment.mode === 'deposit' ? { mode: 'deposit', deposit_cents: r.payment.deposit_cents ?? 0, balance_due: r.payment.balance_due ?? '' } : { mode: 'plan', installments: r.payment.installments ?? 2, balance_due: r.payment.balance_due ?? '' } };
}

export function PaymentSchedule({ priceCents, payment, since }: { priceCents: number; payment: RetreatPayment; since?: Date }) {
  const { t, i18n } = useTranslation(); const lang = i18n.resolvedLanguage ?? 'en';
  const rows = paymentSchedule(priceCents, payment, since);
  return <ol className="retreat-schedule">{rows.map((r, i) => <li key={i}><span>{r.due ? t('retreat.dueOn', { date: fmtDate(r.due, lang, { month: 'short', day: 'numeric', year: 'numeric' }) }) : t(payment.mode === 'deposit' ? 'retreat.depositNow' : 'retreat.firstNow')}</span><strong className="tabular-nums">{formatMoney(r.amount_cents, lang)}</strong></li>)}</ol>;
}

// ============ Guest page ============
export function RetreatDetails({ retreat, startsAt, endsAt, priceCents }: { retreat: Retreat; startsAt: string; endsAt: string | null; priceCents: number | null }) {
  const { t, i18n } = useTranslation(); const lang = i18n.resolvedLanguage ?? 'en';
  const days = tripDays(startsAt, endsAt);
  const inc = linesOf(retreat.included); const notInc = linesOf(retreat.not_included);
  return <div className="retreat-details">
    <p className="retreat-range"><GwIcon name="CalendarDays" size={18} />{fmtDate(startsAt, lang)}{endsAt ? ` – ${fmtDate(endsAt, lang)}` : ''}<span className="chip">{t('retreat.daysCount', { count: days })}</span></p>
    {retreat.gallery.length > 0 && <div className="retreat-gallery" role="list" aria-label={t('retreat.gallery')}>{retreat.gallery.map((p, i) => <div role="listitem" key={p} className="retreat-gallery-item"><GatheringCover path={p} title={t('retreat.photoN', { n: i + 1 })} className="retreat-gallery-img" /></div>)}</div>}

    {retreat.itinerary.length > 0 && <section className="retreat-section"><h2>{t('retreat.itinerary')}</h2>
      <ol className="retreat-timeline">{retreat.itinerary.map((d, i) => { const date = new Date(startsAt); date.setDate(date.getDate() + i); return <li key={i}>
        <span className="retreat-dot" aria-hidden="true" />
        <div><p className="eyebrow">{t('retreat.dayN', { n: i + 1 })} · {fmtDate(date, lang)}</p>{d.title && <h3>{d.title}</h3>}{linesOf(d.items).length > 0 && <ul>{linesOf(d.items).map((x, j) => <li key={j}>{x}</li>)}</ul>}</div>
      </li>; })}</ol></section>}

    {(retreat.lodging || retreat.meals) && <section className="retreat-section retreat-cards">
      {retreat.lodging && <div className="retreat-card"><GwFeatureTile name="Home" size={22} /><div><h3>{t('retreat.lodging')}</h3><p>{retreat.lodging}</p></div></div>}
      {retreat.meals && <div className="retreat-card"><GwFeatureTile name="Utensils" size={22} /><div><h3>{t('retreat.meals')}</h3><p>{retreat.meals}</p></div></div>}
    </section>}

    {(inc.length > 0 || notInc.length > 0) && <section className="retreat-section retreat-cards">
      {inc.length > 0 && <div className="retreat-card"><div><h3>{t('retreat.included')}</h3><ul className="retreat-list is-yes">{inc.map((x, i) => <li key={i}><GwIcon name="Check" size={16} />{x}</li>)}</ul></div></div>}
      {notInc.length > 0 && <div className="retreat-card"><div><h3>{t('retreat.notIncluded')}</h3><ul className="retreat-list is-no">{notInc.map((x, i) => <li key={i}><GwIcon name="X" size={16} />{x}</li>)}</ul></div></div>}
    </section>}

    {priceCents && retreat.payment.mode !== 'full' && retreat.payment.balance_due ? <section className="retreat-section"><h2>{t('retreat.howToPay')}</h2><PaymentSchedule priceCents={priceCents} payment={retreat.payment} /><p className="muted-small">{t('retreat.reminderNote')}</p></section> : null}
    {retreat.refund_policy && <section className="retreat-section"><h2>{t('retreat.refund')}</h2><p className="retreat-pre">{retreat.refund_policy}</p></section>}
    {retreat.faq.length > 0 && <section className="retreat-section"><h2>{t('retreat.faq')}</h2>{retreat.faq.map((f, i) => <details key={i} className="retreat-faq"><summary>{f.q}<GwIcon name="ChevronDown" size={18} /></summary><p>{f.a}</p></details>)}</section>}
  </div>;
}

// ============ Pass page checklist ============
type Checklist = { items: string[]; done: number[]; payment: RetreatPayment | null; price_cents: number | null; created_at: string };
export function RetreatChecklist({ code }: { code: string }) {
  const { t } = useTranslation(); const qc = useQueryClient(); const [busy, setBusy] = useState<number | null>(null);
  const key = ['retreat-checklist', code];
  const { data } = useQuery({ queryKey: key, queryFn: async () => { const { data } = await supabase.rpc('retreat_checklist', { _code: code }); return (data as unknown as Checklist | null) ?? null; } });
  if (!data) return null;
  const toggle = async (i: number, on: boolean) => {
    setBusy(i);
    qc.setQueryData<Checklist | null>(key, d => d && { ...d, done: on ? [...d.done, i] : d.done.filter(x => x !== i) });
    const { error } = await supabase.rpc('toggle_retreat_item', { _code: code, _item: i, _on: on });
    if (error) { toast.error(t('retreat.saveError')); await qc.invalidateQueries({ queryKey: key }); }
    setBusy(null);
  };
  return <>
    {data.payment && data.payment.mode !== 'full' && data.price_cents ? <section className="panel retreat-section"><h2>{t('retreat.yourPayments')}</h2><PaymentSchedule priceCents={data.price_cents} payment={data.payment} since={new Date(data.created_at)} /><p className="muted-small">{t('retreat.reminderNote')}</p></section> : null}
    {data.items.length > 0 && <section className="panel retreat-section"><div className="section-heading"><h2>{t('retreat.checklist')}</h2><span className="chip tabular-nums">{t('retreat.doneOf', { done: data.done.length, total: data.items.length })}</span></div>
      <ul className="retreat-checklist">{data.items.map((x, i) => { const on = data.done.includes(i); return <li key={i}><label className={on ? 'is-done' : ''}><input type="checkbox" checked={on} disabled={busy === i} onChange={e => void toggle(i, e.target.checked)} /><span>{x}</span></label></li>; })}</ul>
    </section>}
  </>;
}
