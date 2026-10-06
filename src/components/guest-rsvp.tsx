import { trackEvent } from '@/lib/analytics';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { CalendarPlus, Copy, MessageCircle, MessageSquareText, Minus, Navigation, Plus, Video } from '@/components/icons';
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

type CalEvent = Pick<PublicEvent, 'id' | 'title' | 'starts_at' | 'ends_at' | 'location_name' | 'address'>;

export function CalendarButtons({ event }: { event: CalEvent }) {
  const { t } = useTranslation();
  const details = `${t('guest.calendarDetails')} ${guestLink(event.id)}`;
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
    <Button variant="secondary" onClick={async () => { await navigator.clipboard.writeText(link); toast.success(t('onboarding.copied')); }}><Copy />{t('gathering.copyLink')}</Button>
    <Button asChild variant="secondary"><a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer"><MessageCircle />{t('teamSpace.whatsapp')}</a></Button>
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
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const [price, setPrice] = useState<{ price_cents: number; pass_fee: boolean; fee_pct: number } | null>(null);
  const { data: waiver } = useEventWaiver(intent ? event.id : undefined); const [wName, setWName] = useState(''); const [wOk, setWOk] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const gate = usePaymentGate(); const checkout = useServerFn(startTicketCheckout);
  const lang = i18n.resolvedLanguage === 'es' ? 'es' : 'en';
  useEffect(() => { void supabase.rpc('event_price', { _id: event.id }).then(({ data }) => setPrice((data as typeof price) ?? null)); }, [event.id]);
  const paid = !!price && intent === 'going';
  const qty = 1 + form.plus;
  const fee = price?.pass_fee ? Math.round(price.price_cents * qty * price.fee_pct / 100) : 0;
  const total = price ? price.price_cents * qty + fee : 0;
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
    if (paid) {
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) { setError(t('guest.errors.invalid_email')); return; }
      await gate.run(() => checkout({ data: { eventId: event.id, first: form.first.trim(), last: form.last.trim(), phone: form.phone.trim(), email: form.email.trim(), plusOnes: form.plus, sms: form.sms, mail: form.mail, lang, origin: window.location.origin, waiverName } }));
      return;
    }
    setBusy(true); setError(null);
    const { data, error: err } = await waiverRpc('rsvp_event_full', { _answers: answers, _token: inviteToken(), _waiver_name: waiverName, _event_id: event.id, _first: form.first.trim(), _last: form.last.trim(), _phone: form.phone.trim(), _email: form.email.trim(),
      _language: i18n.resolvedLanguage === 'es' ? 'es' : 'en', _plus_ones: form.plus, _status: intent, _sms: form.sms, _mail: form.mail });
    setBusy(false);
    const row = (Array.isArray(data) ? data[0] : null) as { code: string; status: string } | null;
    if (err || !row) { setError(t(rsvpErrorKey(err))); return; }
    trackEvent('rsvp', { status: row.status });
    onDone({ code: row.code, status: row.status as RsvpResult['status'] });
  };
  const full = event.capacity != null && event.going >= event.capacity;
  const title = intent === 'maybe' ? t('guest.sheetMaybe') : full ? t('guest.sheetWaitlist') : t('guest.sheetGoing');
  return <ResponsiveSheet open={!!intent} onOpenChange={o => !o && onClose()} title={title} description={event.title}>
    <form className="guest-form" onSubmit={submit} noValidate>
      <div className="guest-name-row">
        <div><label className="field-label" htmlFor="g-first">{t('guest.firstName')}</label><Input id="g-first" autoComplete="given-name" required maxLength={60} className="field-input" value={form.first} onChange={e => setForm({ ...form, first: e.target.value })} /></div>
        <div><label className="field-label" htmlFor="g-last">{t('guest.lastName')}</label><Input id="g-last" autoComplete="family-name" maxLength={60} className="field-input" value={form.last} onChange={e => setForm({ ...form, last: e.target.value })} /></div>
      </div>
      <div><label className="field-label" htmlFor="g-phone">{t('guest.phone')}</label><Input id="g-phone" type="tel" inputMode="tel" autoComplete="tel" maxLength={30} className="field-input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
      <div><label className="field-label" htmlFor="g-email">{t('guest.email')}</label><Input id="g-email" type="email" autoComplete="email" maxLength={200} className="field-input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
      <p className="guest-hint">{t('guest.contactHint')}</p>
      <div className="guest-plus"><span className="field-label">{t('guest.plusOnes')}</span><Stepper value={form.plus} onChange={plus => setForm({ ...form, plus })} label={t('guest.plusOnes')} /></div>
      <label className="guest-consent"><Checkbox checked={form.sms} onCheckedChange={v => setForm({ ...form, sms: !!v })} /><span>{t('guest.smsConsent')} <a href="/legal/sms" target="_blank" rel="noopener">{t('legalDocs.docs.sms.title')}</a></span></label>
      <label className="guest-consent"><Checkbox checked={form.mail} onCheckedChange={v => setForm({ ...form, mail: !!v })} /><span>{t('guest.emailConsent')}</span></label>
      {!!event.questions?.length && <RsvpQuestionsFields questions={event.questions} value={answers} onChange={setAnswers} />}
      {event.require_approval && intent === 'going' && <p className="guest-hint">{t('rsvpq.approvalHint')}</p>}
      {waiver && <WaiverAccept waiver={waiver} name={wName} accepted={wOk} onName={setWName} onAccepted={setWOk} />}
      {paid && price && <p className="guest-price"><strong>{formatMoney(price.price_cents, lang)}</strong><span>{t('billing.perPerson')}{fee ? ` · ${t('billing.bookingFee', { fee: formatMoney(fee, lang) })}` : ''}</span></p>}
      {error && <p className="field-error" role="alert">{error}</p>}
      <Button type="submit" className="guest-primary" disabled={busy || gate.busy}>{busy || gate.busy ? t('guest.saving') : paid ? t('billing.payAndRsvp', { amount: formatMoney(total, lang) }) : intent === 'maybe' ? t('guest.confirmMaybe') : full ? t('guest.joinWaitlist') : t('guest.confirmGoing')}</Button>
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
  return <section className="guest-confirm" aria-live="polite">
    <h2 className="guest-confirm-title">{t(`guest.confirm.${status}`)}</h2>
    <p className="guest-confirm-sub">{t(`guest.confirmSub.${status}`)}</p>
    <div className="guest-confirm-card">
      <strong>{event.title}</strong><span>{when}</span>
      {(event.location_name || event.address) && <span>{[event.location_name, event.address].filter(Boolean).join(' · ')}</span>}
      {event.meeting_note && <span className="muted">{event.meeting_note}</span>}
    </div>
    {event.online_url && (status === 'going' || status === 'maybe') && <Button asChild className="guest-primary"><a href={event.online_url} target="_blank" rel="noopener noreferrer"><Video />{t('guest.joinOnline')}</a></Button>}
    {status === 'going' && <div className="guest-qr" ref={qr}><QRCodeSVG value={code} size={176} bgColor="var(--qr-background)" fgColor="var(--qr-foreground)" level="M" marginSize={4} title={t('guest.qrHelp')} /><span>{t('guest.qrHelp')}</span><Button variant="secondary" onClick={saveQr}>{t('launch.saveQr')}</Button></div>}
    {!['cancelled', 'declined'].includes(status) && <><CalendarButtons event={event} /><DirectionsButton event={event} /></>}
    <h3 className="guest-subhead">{t('guest.inviteFriend')}</h3>
    <InviteShare eventId={event.id} title={event.title} when={when} />
    <Link to="/r/$code" params={{ code }} className="guest-manage-link">{t('guest.manage')}</Link>
  </section>;
}
