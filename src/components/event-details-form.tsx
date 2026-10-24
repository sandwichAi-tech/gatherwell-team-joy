import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { formatMoney } from '@/lib/billing';
import { AGE_BANDS } from '@/lib/identity';
import { PaidBlockedNote } from '@/components/payments-readiness';
import { cleanAddons, cleanTiers, emptyAddon, emptyTier, feeEstimateCents, hostKeepsCents, MAX_ADDONS, MAX_TIERS, parseTags, type Addon, type TicketTier } from '@/lib/event-builder';

/** Extra host-editable event fields saved through update_event_details(). */
export type EventDetails = {
  summaryEn: string; summaryEs: string; language: 'en' | 'es';
  mapUrl: string; regOpens: string; regCloses: string; waitlist: boolean;
  tagsInput: string; contactEmail: string; contactPhone: string;
  accessibility: string; bring: string; cancellation: string;
  allowsMinors: boolean; minAge: string;
  tiers: TicketTier[]; addons: Addon[];
};

export const emptyDetails: EventDetails = {
  summaryEn: '', summaryEs: '', language: 'en', mapUrl: '', regOpens: '', regCloses: '', waitlist: true,
  tagsInput: '', contactEmail: '', contactPhone: '', accessibility: '', bring: '', cancellation: '',
  allowsMinors: false, minAge: '', tiers: [], addons: [],
};

type SourceEvent = Record<string, unknown> & { allows_minors?: boolean | null };

export function detailsFromEvent(e: SourceEvent): EventDetails {
  const s = (k: string) => (typeof e[k] === 'string' ? (e[k] as string) : '');
  const local = (v: unknown) => {
    if (typeof v !== 'string' || !v) return '';
    const d = new Date(v); const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  return {
    summaryEn: s('summary_en'), summaryEs: s('summary_es'), language: e['language'] === 'es' ? 'es' : 'en',
    mapUrl: s('map_url'), regOpens: local(e['reg_opens_at']), regCloses: local(e['reg_closes_at']),
    waitlist: e['waitlist_enabled'] !== false, tagsInput: Array.isArray(e['tags']) ? (e['tags'] as string[]).join(', ') : '',
    contactEmail: s('contact_email'), contactPhone: s('contact_phone'),
    accessibility: s('accessibility_notes'), bring: s('what_to_bring'), cancellation: s('cancellation_policy'),
    allowsMinors: !!e.allows_minors, minAge: e['min_age'] != null ? String(e['min_age']) : '',
    tiers: Array.isArray(e['ticket_tiers']) ? (e['ticket_tiers'] as TicketTier[]) : [],
    addons: Array.isArray(e['addons']) ? (e['addons'] as Addon[]) : [],
  };
}

const iso = (v: string) => (v ? new Date(v).toISOString() : '');

/** Payload for update_event_details(); returns null when a client-checkable rule fails. */
export function detailsPayload(d: EventDetails): Record<string, unknown> | null {
  const tiers = cleanTiers(d.tiers); const addons = cleanAddons(d.addons);
  if (!tiers || !addons) return null;
  if (d.mapUrl.trim() && !/^https:\/\/\S+$/i.test(d.mapUrl.trim())) return null;
  if (d.contactEmail.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.contactEmail.trim())) return null;
  if (d.regOpens && d.regCloses && new Date(d.regOpens) >= new Date(d.regCloses)) return null;
  if (d.minAge && (!d.allowsMinors || Number(d.minAge) < 0 || Number(d.minAge) > 17)) return null;
  return {
    summary_en: d.summaryEn.trim(), summary_es: d.summaryEs.trim(), language: d.language,
    map_url: d.mapUrl.trim(), reg_opens_at: iso(d.regOpens), reg_closes_at: iso(d.regCloses),
    waitlist_enabled: d.waitlist, tags: parseTags(d.tagsInput),
    contact_email: d.contactEmail.trim(), contact_phone: d.contactPhone.trim(),
    accessibility_notes: d.accessibility.trim(), what_to_bring: d.bring.trim(), cancellation_policy: d.cancellation.trim(),
    allows_minors: d.allowsMinors, min_age: d.allowsMinors && d.minAge ? Number(d.minAge) : '',
    ticket_tiers: tiers, addons,
  };
}

/** Prewritten cancellation/refund policy choices; the attendee-facing text stays editable per event. */
export function PolicyPicker({ id, paid, value, onChange }: { id: string; paid: boolean; value: string; onChange: (v: string) => void }) {
  const { t } = useTranslation();
  const presets = paid ? ['paid_24h', 'paid_7d', 'paid_none'] : ['free_anytime', 'free_notify'];
  const matched = presets.find(p => t(`policy.text.${p}`) === value);
  const selected = matched ?? (value.trim() ? 'custom' : '');
  return <>
    <select id={id} className="field-input" value={selected} aria-label={t('builder.cancellation')}
      onChange={e => { const v = e.target.value; if (v === 'custom') onChange(value.trim() ? value : ''); else if (v) onChange(t(`policy.text.${v}`)); else onChange(''); }}>
      <option value="">{t('policy.none')}</option>
      {presets.map(p => <option key={p} value={p}>{t(`policy.preset.${p}`)}</option>)}
      <option value="custom">{t('policy.preset.custom')}</option>
    </select>
    <Textarea rows={3} maxLength={1000} className="field-textarea" value={value} onChange={e => onChange(e.target.value)} placeholder={t('builder.cancellationPlaceholder')} aria-label={t('policy.textLabel')} />
    <small className="field-hint">{t('policy.customHint')}</small>
  </>;
}

export function EventDetailsSections({ value, onChange, priceCents, lang }: { value: EventDetails; onChange: (d: EventDetails) => void; priceCents: number | null; lang: 'en' | 'es' }) {
  const { t } = useTranslation();
  const set = (patch: Partial<EventDetails>) => onChange({ ...value, ...patch });
  const setTier = (id: string, patch: Partial<TicketTier>) => set({ tiers: value.tiers.map(x => x.id === id ? { ...x, ...patch } : x) });
  const setAddon = (id: string, patch: Partial<Addon>) => set({ addons: value.addons.map(x => x.id === id ? { ...x, ...patch } : x) });
  const money = (v: string) => v.replace(/[^\d.]/g, '').slice(0, 7);
  const toCents = (v: string) => Math.round(Number(v || 0) * 100);

  return <>
    <section className="form-section">
      <label className="field-label" htmlFor="g-summary">{t('builder.summary')}</label>
      <Input id="g-summary" className="field-input" maxLength={200} value={value.summaryEn} onChange={e => set({ summaryEn: e.target.value })} placeholder={t('builder.summaryPlaceholder')} />
      <label className="field-label" htmlFor="g-summary-es">{t('builder.summaryEs')}</label>
      <Input id="g-summary-es" className="field-input" maxLength={200} value={value.summaryEs} onChange={e => set({ summaryEs: e.target.value })} placeholder={t('builder.summaryPlaceholder')} />
      <label className="field-label" htmlFor="g-lang">{t('builder.language')}</label>
      <select id="g-lang" className="field-input" value={value.language} onChange={e => set({ language: e.target.value === 'es' ? 'es' : 'en' })}>
        <option value="en">{t('me.english')}</option><option value="es">{t('me.spanish')}</option>
      </select>
    </section>

    <section className="form-section">
      <label className="field-label" htmlFor="g-map">{t('builder.mapLink')}</label>
      <Input id="g-map" type="url" inputMode="url" className="field-input" maxLength={500} value={value.mapUrl} onChange={e => set({ mapUrl: e.target.value })} placeholder="https://" aria-describedby="g-map-hint" />
      <small id="g-map-hint" className="field-hint">{t('builder.mapLinkHint')}</small>
    </section>

    <section className="form-section">
      <span className="field-label">{t('builder.regWindow')}</span>
      <div className="two-col">
        <div><label className="field-label" htmlFor="g-reg-open">{t('builder.regOpens')}</label>
          <Input id="g-reg-open" type="datetime-local" className="field-input" value={value.regOpens} onChange={e => set({ regOpens: e.target.value })} /></div>
        <div><label className="field-label" htmlFor="g-reg-close">{t('builder.regCloses')}</label>
          <Input id="g-reg-close" type="datetime-local" className="field-input" value={value.regCloses} onChange={e => set({ regCloses: e.target.value })} /></div>
      </div>
      {value.regOpens && value.regCloses && new Date(value.regOpens) >= new Date(value.regCloses) && <p className="field-error">{t('builder.errors.reg_window')}</p>}
      <label className="settings-row is-static"><span className="settings-label">{t('builder.waitlist')}<small className="field-hint">{t('builder.waitlistHint')}</small></span><Switch aria-label={t('builder.waitlist')} checked={value.waitlist} onCheckedChange={v => set({ waitlist: v })} /></label>
    </section>

    <section className="form-section">
      <label className="field-label" htmlFor="g-tags">{t('builder.tags')}</label>
      <Input id="g-tags" className="field-input" maxLength={220} value={value.tagsInput} onChange={e => set({ tagsInput: e.target.value })} placeholder={t('builder.tagsPlaceholder')} aria-describedby="g-tags-hint" />
      <small id="g-tags-hint" className="field-hint">{t('builder.tagsHint')}</small>
    </section>

    <section className="form-section two-col">
      <div><label className="field-label" htmlFor="g-cemail">{t('builder.contactEmail')}</label>
        <Input id="g-cemail" type="email" className="field-input" maxLength={200} value={value.contactEmail} onChange={e => set({ contactEmail: e.target.value })} /></div>
      <div><label className="field-label" htmlFor="g-cphone">{t('builder.contactPhone')}</label>
        <Input id="g-cphone" type="tel" inputMode="tel" className="field-input" maxLength={30} value={value.contactPhone} onChange={e => set({ contactPhone: e.target.value })} /></div>
    </section>

    <section className="form-section">
      <label className="field-label" htmlFor="g-access">{t('builder.accessibility')}</label>
      <Textarea id="g-access" rows={2} maxLength={1000} className="field-textarea" value={value.accessibility} onChange={e => set({ accessibility: e.target.value })} placeholder={t('builder.accessibilityPlaceholder')} />
      <label className="field-label" htmlFor="g-bring">{t('builder.bring')}</label>
      <Textarea id="g-bring" rows={2} maxLength={1000} className="field-textarea" value={value.bring} onChange={e => set({ bring: e.target.value })} placeholder={t('builder.bringPlaceholder')} />
      <label className="field-label" htmlFor="g-cancel-preset">{t('builder.cancellation')}</label>
      <PolicyPicker id="g-cancel-preset" paid={!!priceCents} value={value.cancellation} onChange={v => set({ cancellation: v })} />
    </section>

    <section className="form-section">
      <label className="guest-consent"><input type="checkbox" checked={value.allowsMinors} onChange={e => set({ allowsMinors: e.target.checked, minAge: e.target.checked ? value.minAge : '' })} /><span><strong>{t('builder.minors')}</strong><br /><small className="field-hint">{t('builder.minorsHint')}</small></span></label>
      {value.allowsMinors && <div className="inline-field">
        <Input type="number" min={0} max={17} className="field-input" value={value.minAge} onChange={e => set({ minAge: e.target.value.replace(/\D/g, '').slice(0, 2) })} aria-label={t('builder.minAge')} />
        <span>{t('builder.minAge')}</span>
      </div>}
      {value.allowsMinors && <small className="field-hint">{t('builder.minAgeHint')}</small>}
    </section>

    <section className="form-section">
      <span className="field-label">{t('builder.tiers')}</span>
      <p className="field-hint">{t('builder.tiersHint')}</p>
      {value.tiers.map(tier => <div key={tier.id} className="builder-tier">
        <div className="two-col">
          <Input className="field-input" maxLength={60} value={tier.name} onChange={e => setTier(tier.id, { name: e.target.value })} placeholder={t('builder.tierName')} aria-label={t('builder.tierName')} />
          <Input className="field-input" inputMode="decimal" value={tier.price_cents ? String(tier.price_cents / 100) : ''} onChange={e => setTier(tier.id, { price_cents: toCents(money(e.target.value)) })} placeholder="$0" aria-label={t('billing.price')} />
        </div>
        <div className="two-col">
          <Input className="field-input" inputMode="numeric" value={tier.quantity ?? ''} onChange={e => setTier(tier.id, { quantity: e.target.value ? Math.max(1, Number(e.target.value.replace(/\D/g, ''))) : null })} placeholder={t('builder.tierQty')} aria-label={t('builder.tierQty')} />
          <Button type="button" variant="ghost" className="danger-text" onClick={() => set({ tiers: value.tiers.filter(x => x.id !== tier.id) })} aria-label={t('builder.removeTier')}><Trash2 /></Button>
        </div>
        <div className="two-col">
          <Input type="datetime-local" className="field-input" value={tier.sale_starts_at ?? ''} onChange={e => setTier(tier.id, { sale_starts_at: e.target.value || null })} aria-label={t('builder.saleStarts')} />
          <Input type="datetime-local" className="field-input" value={tier.sale_ends_at ?? ''} onChange={e => setTier(tier.id, { sale_ends_at: e.target.value || null })} aria-label={t('builder.saleEnds')} />
        </div>
      </div>)}
      {value.tiers.length < MAX_TIERS && <Button type="button" variant="secondary" onClick={() => set({ tiers: [...value.tiers, emptyTier()] })}><Plus />{t('builder.addTier')}</Button>}
      {value.addons.map(a => <div key={a.id} className="builder-tier">
        <div className="two-col">
          <Input className="field-input" maxLength={60} value={a.name} onChange={e => setAddon(a.id, { name: e.target.value })} placeholder={t('builder.addonName')} aria-label={t('builder.addonName')} />
          <Input className="field-input" inputMode="decimal" value={a.price_cents ? String(a.price_cents / 100) : ''} onChange={e => setAddon(a.id, { price_cents: toCents(money(e.target.value)) })} placeholder="$0" aria-label={t('billing.price')} />
        </div>
        <Button type="button" variant="ghost" className="danger-text" onClick={() => set({ addons: value.addons.filter(x => x.id !== a.id) })} aria-label={t('builder.removeAddon')}><Trash2 />{t('builder.removeAddon')}</Button>
      </div>)}
      {value.addons.length < MAX_ADDONS && <Button type="button" variant="secondary" onClick={() => set({ addons: [...value.addons, emptyAddon()] })}><Plus />{t('builder.addAddon')}</Button>}
      {(value.tiers.length > 0 || value.addons.length > 0) && <PaidBlockedNote />}
    </section>

    {!!priceCents && <section className="form-section builder-fee" aria-label={t('builder.feeEstimate')}>
      <span className="field-label">{t('builder.feeEstimate')}</span>
      <dl className="guest-fee-lines">
        <div><dt>{t('builder.ticketPrice')}</dt><dd className="tabular-nums">{formatMoney(priceCents, lang)}</dd></div>
        <div><dt>{t('builder.platformFee')}</dt><dd className="tabular-nums">{formatMoney(feeEstimateCents(priceCents), lang)}</dd></div>
        <div className="is-total"><dt>{t('builder.youKeep')}</dt><dd className="tabular-nums">{formatMoney(hostKeepsCents(priceCents), lang)}</dd></div>
      </dl>
      <small className="field-hint">{t('builder.feeNote')}</small>
    </section>}
  </>;
}

export { AGE_BANDS };
