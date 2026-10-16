import { useState, type FormEvent } from 'react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { Plus, Trash2, UsersRound, ShieldCheck } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ResponsiveSheet } from '@/components/responsive-sheet';
import { CopyButton, ShareButton } from '@/components/copy-button';
import { RsvpQuestionsFields, answersReady } from '@/components/rsvp-questions';
import { WaiverAccept, useEventWaiver, waiverRpc } from '@/components/waiver';
import { inviteToken, rsvpErrorKey, type PublicEvent } from '@/lib/guest';
import { formatMoney } from '@/lib/billing';
import { trackEvent } from '@/lib/analytics';

type Person = { first: string; last: string; phone: string; email: string; sms: boolean; mail: boolean; answers: Record<string, string>; wName: string; wOk: boolean };
const blank = (): Person => ({ first: '', last: '', phone: '', email: '', sms: false, mail: false, answers: {}, wName: '', wOk: false });
export type TeamResult = { status: string; team: string; participants: { name: string; code: string; signed: boolean }[] };

export function teamErrorKey(err: unknown) {
  const m = typeof err === 'object' && err && 'message' in err ? String((err as { message: unknown }).message) : '';
  for (const k of ['team_name_required', 'team_size', 'payment_required']) if (m.includes(k)) return `teamRsvp.errors.${k}`;
  return rsvpErrorKey(err);
}

export function TeamRsvpSheet({ event, open, price, onClose, onDone }: { event: PublicEvent; open: boolean; price: { price_cents: number } | null; onClose: () => void; onDone: (r: TeamResult) => void }) {
  const { t, i18n } = useTranslation(); const lang = i18n.resolvedLanguage === 'es' ? 'es' : 'en';
  const min = event.team_min ?? 2, max = event.team_max ?? 6;
  const [name, setName] = useState(''); const [people, setPeople] = useState<Person[]>(() => Array.from({ length: min }, blank));
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const { data: waiver } = useEventWaiver(open ? event.id : undefined);
  const set = (i: number, p: Partial<Person>) => setPeople(ps => ps.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const total = price ? (event.team_price_mode === 'team' ? price.price_cents : price.price_cents * people.length) : 0;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError(t('teamRsvp.errors.team_name_required')); return; }
    if (people.some(p => !p.first.trim())) { setError(t('guest.errors.name_required')); return; }
    if (!people[0]!.phone.trim() && !people[0]!.email.trim()) { setError(t('teamRsvp.errors.captain_contact')); return; }
    if (people.some(p => !answersReady(event.questions, p.answers))) { setError(t('guest.errors.answers_required')); return; }
    if (price) { setError(t('teamRsvp.errors.payment_required')); return; }
    setBusy(true); setError(null);
    const { data, error: err } = await waiverRpc('rsvp_team', { _event_id: event.id, _token: inviteToken(), _team_name: name.trim(), _language: lang,
      _participants: people.map(p => ({ first: p.first.trim(), last: p.last.trim(), phone: p.phone.trim(), email: p.email.trim(), sms: p.sms, mail: p.mail, answers: p.answers, waiver_name: waiver?.required && p.wOk ? p.wName.trim() : '' })) });
    setBusy(false);
    if (err || !data) { setError(t(teamErrorKey(err))); return; }
    trackEvent('rsvp', { status: (data as TeamResult).status });
    onDone(data as TeamResult);
  };

  return <ResponsiveSheet open={open} onOpenChange={o => !o && onClose()} title={t('teamRsvp.title')} description={event.title}>
    <form className="guest-form" onSubmit={submit} noValidate>
      <div><label className="field-label" htmlFor="tr-name">{t('teamRsvp.teamName')}</label><Input id="tr-name" maxLength={80} className="field-input" value={name} onChange={e => setName(e.target.value)} /></div>
      <p className="guest-hint">{t('teamRsvp.sizeHint', { min, max })}</p>
      {people.map((p, i) => <fieldset key={i} className="team-person">
        <legend className="field-label">{i === 0 ? t('teamRsvp.captain') : t('teamRsvp.person', { n: i + 1 })}</legend>
        {people.length > min && i > 0 && <Button type="button" variant="ghost" size="icon" className="team-person-remove" aria-label={t('teamRsvp.remove', { n: i + 1 })} onClick={() => setPeople(ps => ps.filter((_, j) => j !== i))}><Trash2 /></Button>}
        <div className="guest-name-row">
          <div><label className="field-label" htmlFor={`tr-f${i}`}>{t('guest.firstName')}</label><Input id={`tr-f${i}`} maxLength={60} className="field-input" value={p.first} onChange={e => set(i, { first: e.target.value })} /></div>
          <div><label className="field-label" htmlFor={`tr-l${i}`}>{t('guest.lastName')}</label><Input id={`tr-l${i}`} maxLength={60} className="field-input" value={p.last} onChange={e => set(i, { last: e.target.value })} /></div>
        </div>
        <div><label className="field-label" htmlFor={`tr-p${i}`}>{t('guest.phone')}{i > 0 && ` (${t('teamRsvp.optional')})`}</label><Input id={`tr-p${i}`} type="tel" inputMode="tel" maxLength={30} className="field-input" value={p.phone} onChange={e => set(i, { phone: e.target.value })} /></div>
        <div><label className="field-label" htmlFor={`tr-e${i}`}>{t('guest.email')}{i > 0 && ` (${t('teamRsvp.optional')})`}</label><Input id={`tr-e${i}`} type="email" maxLength={200} className="field-input" value={p.email} onChange={e => set(i, { email: e.target.value })} /></div>
        {p.phone.trim() && <label className="guest-consent"><Checkbox checked={p.sms} onCheckedChange={v => set(i, { sms: !!v })} /><span>{t('guest.smsConsent')} <a href="/legal/sms" target="_blank" rel="noopener">{t('legalDocs.docs.sms.title')}</a></span></label>}
        {p.email.trim() && <label className="guest-consent"><Checkbox checked={p.mail} onCheckedChange={v => set(i, { mail: !!v })} /><span>{t('guest.emailConsent')}</span></label>}
        {!!event.questions?.length && <RsvpQuestionsFields questions={event.questions} value={p.answers} onChange={a => set(i, { answers: a })} />}
        {waiver?.required && <>
          <WaiverAccept waiver={waiver} name={p.wName} accepted={p.wOk} onName={v => set(i, { wName: v })} onAccepted={v => set(i, { wOk: v })} idPrefix={`tw${i}`} />
          <p className="guest-hint">{t('teamRsvp.waiverLater')}</p>
        </>}
      </fieldset>)}
      {people.length < max && <Button type="button" variant="secondary" onClick={() => setPeople(ps => [...ps, blank()])}><Plus />{t('teamRsvp.add')}</Button>}
      {price && <p className="guest-price"><strong>{formatMoney(total, lang)}</strong><span>{t(event.team_price_mode === 'team' ? 'teamRsvp.perTeam' : 'teamRsvp.perPersonTotal', { count: people.length })}</span></p>}
      {price && <p className="not-connected">{t('teamRsvp.paymentsNotConnected')}</p>}
      {event.require_approval && <p className="guest-hint">{t('rsvpq.approvalHint')}</p>}
      {error && <p className="field-error" role="alert">{error}</p>}
      <Button type="submit" className="guest-primary" disabled={busy || !!price}>{busy ? t('guest.saving') : t('teamRsvp.submit', { count: people.length })}</Button>
    </form>
  </ResponsiveSheet>;
}

export function TeamConfirmation({ result }: { result: TeamResult }) {
  const { t } = useTranslation();
  return <section className="guest-confirm" aria-live="polite">
    <h2 className="guest-confirm-title"><UsersRound /> {t(`teamRsvp.done.${result.status === 'going' ? 'going' : result.status === 'requested' ? 'requested' : 'waitlist'}`, { team: result.team })}</h2>
    <p className="guest-confirm-sub">{t('teamRsvp.doneSub')}</p>
    <ul className="team-codes">{result.participants.map(p => {
      const link = `${window.location.origin}/r/${p.code}`;
      return <li key={p.code} className="guest-confirm-card">
        <strong>{p.name}</strong>
        {result.status === 'going' && <QRCodeSVG value={p.code} size={120} bgColor="var(--qr-background)" fgColor="var(--qr-foreground)" level="M" marginSize={3} title={t('guest.qrHelp')} />}
        <span className={`waiver-status ${p.signed ? 'is-signed' : 'is-missing'}`}>{p.signed && <ShieldCheck />}{p.signed ? t('waiver.signed') : t('teamRsvp.waiverPending')}</span>
        <CopyButton text={link} />
        <ShareButton url={link} />
        <Link to="/r/$code" params={{ code: p.code }} className="guest-manage-link">{t('teamRsvp.openPass')}</Link>
      </li>;
    })}</ul>
    <p className="guest-hint">{t('teamRsvp.sendLinks')}</p>
  </section>;
}

/** On a participant's own pass: lets them accept the waiver themselves. */
export function SignWaiverByCode({ eventId, code }: { eventId: string; code: string }) {
  const { t } = useTranslation(); const { data: waiver } = useEventWaiver(eventId);
  const [name, setName] = useState(''); const [ok, setOk] = useState(false); const [done, setDone] = useState(false); const [busy, setBusy] = useState(false);
  if (!waiver?.required || done) return done ? <p className="guest-hint"><ShieldCheck /> {t('waiver.signed')}</p> : null;
  return <section className="guest-card">
    <WaiverAccept waiver={waiver} name={name} accepted={ok} onName={setName} onAccepted={setOk} idPrefix="sw" />
    <Button disabled={busy || !ok || name.trim().length < 2} onClick={async () => { setBusy(true); const { error } = await waiverRpc('sign_waiver_by_code', { _code: code, _name: name.trim() }); setBusy(false); if (error) toast.error(t('guest.errors.generic')); else { setDone(true); toast.success(t('waiver.signed')); } }}>{t('teamRsvp.signNow')}</Button>
  </section>;
}
