import { useQuery } from '@tanstack/react-query';
import { RefundLine } from '@/components/refund-line';
import { tgShare } from '@/lib/chat-links';
import { serviceFee } from '@/lib/plan-fees';
import { rsvpReminderConsent } from '@/lib/rsvp-form';
import { GuestBelonging } from '@/components/belonging';
import { PromoField } from '@/components/promo-field';
import { promoDiscount, type Promo } from '@/lib/promo';
import { CopyButton, ShareButton } from '@/components/copy-button';
import { trackEvent } from '@/lib/analytics';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { CalendarPlus, Copy, MessageCircle, MessageSquareText, Minus, Navigation, Plus, Video, Send } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ResponsiveSheet } from '@/components/responsive-sheet';
import { supabase } from '@/integrations/supabase/client';
import { useServerFn } from '@tanstack/react-start';
import { usePaymentGate } from '@/components/plan-page';
import { startTicketCheckout } from '@/lib/billing.functions';
import { formatMoney } from '@/lib/billing';
import { RsvpQuestionsFields, answersReady } from '@/components/rsvp-questions';
import { WaiverAccept, useEventWaiver, waiverReady, waiverRpc } from '@/components/waiver';
import { directionsUrl, downloadIcs, formatWhen, googleCalendarUrl, guestLink, hasPlace, inviteToken, rsvpErrorKey, type PublicEvent } from '@/lib/guest';
import { AGE_BANDS, checkMinorRegistration } from '@/lib/identity';
import { minorBandAllowed } from '@/lib/event-builder';
import { defaultTier, needsTier, registrationReady, tierSpotsLeft, tierState } from '@/lib/registration';

type CalEvent = Pick<PublicEvent, 'id' | 'title' | 'starts_at' | 'ends_at' | 'location_name' | 'address'>;

export function CalendarButtons({ event }: { event: CalEvent }) {
  const { t } = useTranslation();
  // The page link needs the browser address, so it fills in once the page has loaded (it also renders on the server).
  const [link, setLink] = useState('');
  useEffect(() => { setLink(guestLink(event.id)); }, [event.id]);
  const details = `${t('guest.calendarDetails')} ${link}`.trim();
  return <div className="guest-button-row">
    <Button variant="secondary" onClick={() => downloadIcs(event, details)}><CalendarPlus />{t('guest.addCalendar')}</Button>
    <Button asChild variant="secondary"><a href={googleCalendarUrl(event, details)} target="_blank" rel="noopener noreferrer"><CalendarPlus />{t('guest.googleCalendar')}</a></Button>
  </div>;
}

export function DirectionsButton({ event, variant = 'secondary' }: { event: Pick<PublicEvent, 'address' | 'location_name' | 'lat' | 'lng'>; variant?: 'secondary' | 'default' }) {
  const { t } = useTranslation();
  if (!hasPlace(event)) return null;
  return <Button asChild variant={variant}><a href={directionsUrl(event)} target="_blank" rel="noopener noreferrer"><Navigation />{t('guest.directions')}</a></Button>;
}

export function InviteShare({ eventId, title, when }: { eventId: string; title: string; when: string }) {
  const { t } = useTranslation();
  const link = guestLink(eventId); const text = t('guest.inviteText', { title, date: when, link });
  return <div className="share-grid">
    <CopyButton text={link} />
    <ShareButton url={link} />
    <Button asChild variant="secondary"><a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer"><MessageCircle />{t('teamSpace.whatsapp')}</a></Button><Button asChild variant="secondary"><a href={tgShare(text)} target="_blank" rel="noopener noreferrer"><Send />{t('teamSpace.telegram')}</a></Button>
    <Button asChild variant="secondary"><a href={`sms:?&body=${encodeURIComponent(text)}`}><MessageSquareText />{t('gathering.text')}</a></Button>
  </div>;
}

export function Stepper({ value, onChange, max = 3, label }: { value: number; onChange: (n: number) => void; max?: number; label: string }) {
  const { t } = useTranslation();
  return <div className="guest-stepper" role="group" aria-label={label}>
    <Button type="button" variant="secondary" size="icon" aria-label={t('guest.less')} disabled={value <= 0} onClick={() => onChange(value - 1)}><Minus /></Button>
    <output className="tabular-nums" aria-live="polite">{value}</output>
    <Button type="button" variant="secondary" size="icon" aria-label={t('guest.more')} disabled={value >= max} onClick={() => onChange(value + 1)}><Plus /></Button>
  </div>;
}

export type RsvpResult = { code: string; status: 'going' | 'maybe' | 'waitlist' | 'requested' };

export function RsvpSheet({ event, intent, onClose, onDone }: { event: PublicEvent; intent: 'going' | 'maybe' | null; onClose: () => void; onDone: (r: RsvpResult) => void }) {
  const { t, i18n } = useTranslation();
  const [form, setForm] = useState({ first: '', last: '', phone: '', email: '', plus: 0, sms: false, mail: false });
  const [contact, setContact] = useState<'email' | 'phone'>('email');
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const [price, setPrice] = useState<{ price_cents: number; pass_fee: boolean; fee_pct: number; cover_service_fee?: boolean; service_fee_percent?: number; service_fee_fixed?: number; refund_policy?: string } | null>(null);
  const { data: waiver } = useEventWaiver(intent ? event.id : undefined); const [wName, setWName] = useState(''); const [wOk, setWOk] = useState(false); const [adult, setAdult] = useState(false);
  const [minorOn, setMinorOn] = useState(false);
  const [minor, setMinor] = useState({ first: '', band: '' as string, gName: '', gRel: 'parent', gEmail: '', gPhone: '', consent: false });
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [termsOk, setTermsOk] = useState(false);
  const [updates, setUpdates] = useState(false);
  const [tierId, setTierId] = useState<string | null>(null);
  const tiers = event.ticket_tiers ?? [];
  useEffect(() => { if (intent && needsTier(tiers) && !tierId) setTierId(defaultTier(tiers)); }, [intent, tiers, tierId]);
  const gate = usePaymentGate(); const checkout = useServerFn(startTicketCheckout);
  const lang = i18n.resolvedLanguage === 'es' ? 'es' : 'en';
  useEffect(() => { void supabase.rpc('event_price', { _id: event.id }).then(({ data }) => setPrice((data as typeof price) ?? null)); }, [event.id]);
  const paid = !!price && intent === 'going';
  const qty = 1 + form.plus;
  const [promo, setPromo] = useState<Promo | null>(null);
  const discount = price ? promoDiscount(price.price_cents * qty, promo) : 0;
  const fee = price?.pass_fee ? Math.round((price.price_cents * qty - discount) * price.fee_pct / 100) : 0;
  const ticketsCents = price ? price.price_cents * qty - discount : 0;
  const service = price && !price.cover_service_fee ? serviceFee(ticketsCents, Number(price.service_fee_percent ?? 0), price.service_fee_fixed ?? 0) : 0;
  const total = price ? ticketsCents + fee + service : 0;
  useEffect(() => {
    if (!intent) return;
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: p } = await supabase.from('profiles').select('full_name, phone').eq('id', user.id).maybeSingle();
      const [first, ...rest] = (p?.full_name ?? '').trim().split(/\s+/);
      setForm(f => ({ ...f, first: f.first || first || '', last: f.last || rest.join(' '), phone: f.phone || p?.phone || '', email: f.email || user.email || '' }));
    })();
  }, [intent]);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); if (!intent) return;
    if (!form.first.trim()) { setError(t('guest.errors.name_required')); return; }
    if (!form.phone.trim() && !form.email.trim()) { setError(t('guest.errors.contact_required')); return; }
    if (!waiverReady(waiver, wName, wOk)) { setError(t('guest.errors.waiver_required')); return; }
    if (intent === 'going' && !answersReady(event.questions, answers)) { setError(t('guest.errors.answers_required')); return; }
    const waiverName = waiver?.required ? wName.trim() : '';
    const consent = rsvpReminderConsent(form);
    if (!termsOk) { setError(t('guest.errors.terms_required')); return; }
    if (needsTier(tiers) && !paid && !registrationReady({ terms: termsOk, tiers, tierId })) { setError(t('guest.errors.tier_required')); return; }
    if (minorOn && event.allows_minors) {
      const check = checkMinorRegistration(true, true, { firstName: minor.first, ageBand: minor.band, guardianConsent: minor.consent });
      if (!check.ok) { setError(t(`guest.errors.${check.error}`)); return; }
      if (!minor.gName.trim() || !minor.gRel.trim() || (!minor.gEmail.trim() && !minor.gPhone.trim())) { setError(t('guest.errors.guardian_details_incomplete')); return; }
      if (!minorBandAllowed(event.min_age ?? null, minor.band as 'under_5' | '5_12' | '13_17')) { setError(t('guest.errors.min_age_not_met')); return; }
      setBusy(true); setError(null);
      try {
        const { data, error: err } = await supabase.rpc('rsvp_event_minor', {
          _event_id: event.id, _minor_first: minor.first.trim(), _minor_age_band: minor.band,
          _guardian_name: minor.gName.trim(), _guardian_relationship: minor.gRel, _guardian_email: minor.gEmail.trim(), _guardian_phone: minor.gPhone.trim(),
          _language: i18n.resolvedLanguage === 'es' ? 'es' : 'en', _sms: consent.sms, _mail: consent.mail, _token: inviteToken() ?? '' });
        const row = (Array.isArray(data) ? data[0] : null) as { code: string; status: string } | null;
        if (err || !row) { const k = rsvpErrorKey(err); setError(t(k === 'guest.errors.generic' ? 'guest.errors.save_failed' : k)); return; }
        trackEvent('rsvp', { status: row.status, minor: true });
        onDone({ code: row.code, status: row.status as RsvpResult['status'] });
      } catch { setError(t('guest.errors.save_failed')); } finally { setBusy(false); }
      return;
    }
    if (paid) {
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) { setError(t('guest.errors.invalid_email')); return; }
      if (!adult) { setError(t('identity.adultRequired')); return; }
      await gate.run(() => checkout({ data: { eventId: event.id, first: form.first.trim(), last: form.last.trim(), phone: form.phone.trim(), email: form.email.trim(), plusOnes: form.plus, sms: consent.sms, mail: consent.mail, lang, origin: window.location.origin, waiverName, promo: promo?.code ?? '', adult } }));
      return;
    }
    setBusy(true); setError(null);
    try {
      const { data, error: err } = await waiverRpc('register_attendance', { _answers: answers, _token: inviteToken(), _waiver_name: waiverName, _event_id: event.id, _first: form.first.trim(), _last: form.last.trim(), _phone: form.phone.trim(), _email: form.email.trim(),
        _language: i18n.resolvedLanguage === 'es' ? 'es' : 'en', _plus_ones: form.plus, _status: intent, _sms: consent.sms, _mail: consent.mail,
        _terms_ok: termsOk, _updates_opt_in: updates, _tier_id: tierId ?? '' });
      const row = (Array.isArray(data) ? data[0] : null) as { code: string; status: string } | null;
      if (err || !row) { const k = rsvpErrorKey(err); setError(t(k === 'guest.errors.generic' ? 'guest.errors.save_failed' : k)); return; }
      trackEvent('rsvp', { status: row.status });
      onDone({ code: row.code, status: row.status as RsvpResult['status'] });
    } catch (e) {
      console.error('RSVP failed', e);
      setError(t('guest.errors.save_failed'));
    } finally {
      setBusy(false);
    }
  };
  const full = event.capacity != null && event.going >= event.capacity;
  const title = intent === 'maybe' ? t('guest.sheetMaybe') : full ? t('guest.sheetWaitlist') : t('guest.sheetGoing');
  return <ResponsiveSheet open={!!intent} onOpenChange={o => !o && onClose()} title={title} description={event.title} footer={<Button type="submit" form="guest-rsvp-form" className="guest-primary" disabled={busy || gate.busy}>{busy || gate.busy ? t('guest.saving') : paid ? t('billing.payAndRsvp', { amount: formatMoney(total, lang) }) : intent === 'maybe' ? t('guest.confirmMaybe') : full ? t('guest.joinWaitlist') : t('guest.confirmGoing')}</Button>}>
    <form id="guest-rsvp-form" className="guest-form" onSubmit={submit} noValidate>
      <div><label className="field-label" htmlFor="g-first">{t('guest.firstName')}</label><Input id="g-first" autoComplete="given-name" required maxLength={60} className="field-input" value={form.first} onChange={e => setForm({ ...form, first: e.target.value })} /></div>
      {!paid && <div className="segmented full" role="group" aria-label={t('guest.contactMethod')}>
        {(['email', 'phone'] as const).map(key => <Button key={key} type="button" variant="ghost" className={contact === key ? 'selected' : ''} aria-pressed={contact === key} onClick={() => setContact(key)}>{t(`guest.${key}`)}</Button>)}
      </div>}
      {(paid || contact === 'email') ? <div><label className="field-label" htmlFor="g-email">{t('guest.email')}</label><Input id="g-email" type="email" autoComplete="email" maxLength={200} className="field-input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
        : <div><label className="field-label" htmlFor="g-phone">{t('guest.phone')}</label><Input id="g-phone" type="tel" inputMode="tel" autoComplete="tel" maxLength={30} className="field-input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>}
      {form.phone.trim() && <label className="guest-consent"><Checkbox checked={form.sms} onCheckedChange={v => setForm({ ...form, sms: !!v })} /><span>{t('guest.smsConsent')} <a href="/legal/sms" target="_blank" rel="noopener">{t('legalDocs.docs.sms.title')}</a></span></label>}
      {form.email.trim() && <label className="guest-consent"><Checkbox checked={form.mail} onCheckedChange={v => setForm({ ...form, mail: !!v })} /><span>{t('guest.emailConsent')}</span></label>}
      <details className="guest-optional"><summary>{t('guest.optionalDetails')}</summary><div className="guest-optional-body">
        <div><label className="field-label" htmlFor="g-last">{t('guest.lastName')}</label><Input id="g-last" autoComplete="family-name" maxLength={60} className="field-input" value={form.last} onChange={e => setForm({ ...form, last: e.target.value })} /></div>
        <div className="guest-plus"><span className="field-label">{t('guest.plusOnes')}</span><Stepper value={form.plus} onChange={plus => setForm({ ...form, plus })} label={t('guest.plusOnes')} /></div>
      </div></details>
      {event.allows_minors && !paid && intent === 'going' && <section className="guest-minor">
        <label className="guest-consent"><Checkbox checked={minorOn} onCheckedChange={v => setMinorOn(!!v)} /><span>{t('guest.minor.toggle')}</span></label>
        {minorOn && <div className="guest-minor-fields">
          <div><label className="field-label" htmlFor="g-minor-first">{t('guest.minor.firstName')}</label><Input id="g-minor-first" maxLength={40} className="field-input" value={minor.first} onChange={e => setMinor({ ...minor, first: e.target.value })} /></div>
          <div><label className="field-label" htmlFor="g-minor-band">{t('guest.minor.ageBand')}</label>
            <select id="g-minor-band" className="field-input" value={minor.band} onChange={e => setMinor({ ...minor, band: e.target.value })}>
              <option value="">{t('guest.minor.pickBand')}</option>
              {AGE_BANDS.map(b => <option key={b} value={b} disabled={!minorBandAllowed(event.min_age ?? null, b)}>{t(`guest.minor.bands.${b}`)}</option>)}
            </select></div>
          <div><label className="field-label" htmlFor="g-gname">{t('guest.minor.guardianName')}</label><Input id="g-gname" autoComplete="name" maxLength={120} className="field-input" value={minor.gName} onChange={e => setMinor({ ...minor, gName: e.target.value })} /></div>
          <div><label className="field-label" htmlFor="g-grel">{t('guest.minor.relationship')}</label>
            <select id="g-grel" className="field-input" value={minor.gRel} onChange={e => setMinor({ ...minor, gRel: e.target.value })}>
              {(['parent', 'guardian', 'other'] as const).map(r => <option key={r} value={r}>{t(`guest.minor.rel.${r}`)}</option>)}
            </select></div>
          <div><label className="field-label" htmlFor="g-gemail">{t('guest.minor.guardianEmail')}</label><Input id="g-gemail" type="email" maxLength={200} className="field-input" value={minor.gEmail} onChange={e => setMinor({ ...minor, gEmail: e.target.value })} /></div>
          <div><label className="field-label" htmlFor="g-gphone">{t('guest.minor.guardianPhone')}</label><Input id="g-gphone" type="tel" inputMode="tel" maxLength={30} className="field-input" value={minor.gPhone} onChange={e => setMinor({ ...minor, gPhone: e.target.value })} /></div>
          <label className="guest-consent"><Checkbox checked={minor.consent} onCheckedChange={v => setMinor({ ...minor, consent: !!v })} /><span>{t('guest.minor.consent')}</span></label>
        </div>}
      </section>}
      {!!event.questions?.length && <RsvpQuestionsFields questions={event.questions} value={answers} onChange={setAnswers} />}
      {event.require_approval && intent === 'going' && <p className="guest-hint">{t('rsvpq.approvalHint')}</p>}
      {waiver && <WaiverAccept waiver={waiver} name={wName} accepted={wOk} onName={setWName} onAccepted={setWOk} />}
      {!paid && needsTier(tiers) && <fieldset className="guest-tiers">
        <legend className="field-label">{t('guest.tiers.title')}</legend>
        {tiers.map(tier => {
          const state = tierState(tier);
          const left = tierSpotsLeft(tier);
          return <label key={tier.id} className={`guest-tier ${state !== 'open' ? 'is-disabled' : ''}`}>
            <input type="radio" name="ticket-tier" value={tier.id} disabled={state !== 'open'} checked={tierId === tier.id} onChange={() => setTierId(tier.id)} />
            <span className="guest-tier-name">{tier.name}</span>
            <span className="guest-tier-meta">
              {tier.price_cents > 0 ? <>{formatMoney(tier.price_cents, lang)} <span className="chip quiet-chip">{t('guest.tiers.setupRequired')}</span></> : t('guest.tiers.free')}
              {state === 'sold_out' && <> · {t('guest.tiers.soldOut')}</>}
              {state === 'not_yet' && <> · {t('guest.tiers.notYet')}</>}
              {state === 'ended' && <> · {t('guest.tiers.ended')}</>}
              {state === 'open' && left != null && <> · {t('guest.tiers.spotsLeft', { count: left })}</>}
            </span>
          </label>;
        })}
      </fieldset>}
      <label className="guest-consent"><Checkbox checked={termsOk} onCheckedChange={v => setTermsOk(!!v)} /><span>{t('guest.termsAgree')} <a href="/terms" target="_blank" rel="noopener">{t('guest.termsLink')}</a> · <a href="/privacy" target="_blank" rel="noopener">{t('guest.privacyLink')}</a></span></label>
      <label className="guest-consent"><Checkbox checked={updates} onCheckedChange={v => setUpdates(!!v)} /><span>{t('guest.updatesOptIn')}</span></label>
      {paid && price && <p className="guest-price"><strong>{formatMoney(price.price_cents, lang)}</strong><span>{t('billing.perPerson')}{fee ? ` · ${t('billing.bookingFee', { fee: formatMoney(fee, lang) })}` : ''}</span></p>}
      {paid && price && <RefundLine policy={price.refund_policy} />}
      {paid && price && <dl className="guest-fee-lines" aria-label={t('billing.orderSummary')}>
        <div><dt>{t('billing.tickets', { count: qty })}</dt><dd className="tabular-nums">{formatMoney(ticketsCents, lang)}</dd></div>
        {!!fee && <div><dt>{t('billing.bookingFeeLabel')}</dt><dd className="tabular-nums">{formatMoney(fee, lang)}</dd></div>}
        {!!service && <div><dt>{t('billing.serviceFee')}</dt><dd className="tabular-nums">{formatMoney(service, lang)}</dd></div>}
        <div className="is-total"><dt>{t('billing.total')}</dt><dd className="tabular-nums">{formatMoney(total, lang)}</dd></div>
        {price.cover_service_fee && <p className="guest-hint">{t('billing.allInPrice')}</p>}
      </dl>}
      {paid && price && <label className="check-row consent-check"><input type="checkbox" checked={adult} onChange={e => setAdult(e.target.checked)} /><span>{t('identity.adultCheck')}</span></label>}
      {paid && price && <PromoField kind="gathering" target={event.id} buyer={form.email.trim()} discountCents={discount} value={promo} onChange={setPromo} />}
      {error && <p className="field-error" role="alert">{error}</p>}
    </form>
    {gate.sheet}
  </ResponsiveSheet>;
}

type ConfirmEvent = Pick<PublicEvent, 'id' | 'title' | 'starts_at' | 'ends_at' | 'location_name' | 'address' | 'meeting_note' | 'lat' | 'lng'> & { online_url?: string | null };

export function Confirmation({ event, code, status }: { event: ConfirmEvent; code: string; status: 'going' | 'maybe' | 'waitlist' | 'cancelled' | 'requested' | 'declined' }) {
  const { t, i18n } = useTranslation(); const lang = i18n.resolvedLanguage ?? 'en';
  const qr = useRef<HTMLDivElement>(null);
  const saveQr = () => {
    const svg = qr.current?.querySelector('svg'); if (!svg) return;
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' }));
    const a = document.createElement('a'); a.href = url; a.download = 'gatherwell-qr.svg'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const when = formatWhen(event.starts_at, lang);
  const { data: cprice } = useQuery({ queryKey: ['event-price-refund', event.id], queryFn: async () => { const { data } = await supabase.rpc('event_price', { _id: event.id }); return (data as { refund_policy?: string } | null) ?? null; } });
  return <section className="guest-confirm" aria-live="polite">
    <h2 className="guest-confirm-title">{t(`guest.confirm.${status}`)}</h2>
    <p className="guest-confirm-sub">{t(`guest.confirmSub.${status}`)}</p>
    <div className="guest-confirm-card">
      <strong>{event.title}</strong><span>{when}</span>
      {(event.location_name || event.address) && <span>{[event.location_name, event.address].filter(Boolean).join(' · ')}</span>}
      {event.meeting_note && <span className="muted">{event.meeting_note}</span>}
    </div>
    {cprice && status === 'going' && <RefundLine policy={cprice.refund_policy} />}
    {event.online_url && (status === 'going' || status === 'maybe') && <Button asChild className="guest-primary"><a href={event.online_url} target="_blank" rel="noopener noreferrer"><Video />{t('guest.joinOnline')}</a></Button>}
    <GuestBelonging code={code} status={status} />
    {status === 'going' && <div className="guest-qr" ref={qr}><QRCodeSVG value={code} size={176} bgColor="var(--qr-background)" fgColor="var(--qr-foreground)" level="M" marginSize={4} title={t('guest.qrHelp')} /><span>{t('guest.qrHelp')}</span><Button variant="secondary" onClick={saveQr}>{t('launch.saveQr')}</Button></div>}
    {!['cancelled', 'declined'].includes(status) && <><CalendarButtons event={event} /><DirectionsButton event={event} /></>}
    <h3 className="guest-subhead">{t('guest.inviteFriend')}</h3>
    <InviteShare eventId={event.id} title={event.title} when={when} />
    <Link to="/r/$code" params={{ code }} className="guest-manage-link">{t('guest.manage')}</Link>
  </section>;
}
