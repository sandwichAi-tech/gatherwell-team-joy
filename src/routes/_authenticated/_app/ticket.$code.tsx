import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowLeft, CalendarDays, MapPin, Printer, Video, CreditCard, AlertCircle, CheckCircle2 } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { AddToCalendar } from '@/components/add-to-calendar';
import { ContactHostButton } from '@/components/contact-host';
import { ListSkeleton } from '@/components/launch-states';
import { supabase } from '@/integrations/supabase/client';
import { formatWhen } from '@/lib/guest';
import { gatherwellHead } from '@/lib/gatherwell-head';
import type { IcsEvent } from '@/lib/ics';

export const Route = createFileRoute('/_authenticated/_app/ticket/$code')({ head: () => gatherwellHead('me'), component: TicketDetailPage });

type TicketPayload = {
  found: boolean;
  status?: string;
  guest_name?: string | null;
  plus_ones?: number;
  checked_in_at?: string | null;
  waitlist_position?: number | null;
  tier_name?: string | null;
  event?: {
    id: string; title: string; starts_at: string; ends_at: string | null; timezone: string;
    status: string; visibility: string; format: string | null;
    location_name: string | null; address: string | null; online_url: string | null;
    meeting_note: string | null; accessibility_notes: string | null; cancellation_policy: string | null;
  };
};

const ticketQuery = (code: string) => ({
  queryKey: ['ticket', code],
  queryFn: async (): Promise<TicketPayload> => {
    const { data, error } = await supabase.rpc('ticket_payload', { _code: code });
    if (error) throw error;
    return (data as TicketPayload) ?? { found: false };
  },
  retry: 1,
});

/** Grouped alphanumeric fallback for the QR code, e.g. AB12-CD34-…. */
const groupedCode = (code: string) => code.toUpperCase().replace(/(.{4})(?=.)/g, '$1-');

function TicketDetailPage() {
  const { code } = Route.useParams();
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage === 'es' ? 'es' : 'en';
  const { data, isLoading, error } = useQuery(ticketQuery(code));

  if (isLoading) return <ListSkeleton />;
  if (error || !data?.found || !data.event) {
    return <section className="panel ticket-panel">
      <div className="ticket-state" role="alert">
        <AlertCircle />
        <h1>{t('ticket.notFound')}</h1>
        <p className="muted">{t('ticket.notFoundText')}</p>
        <Button asChild variant="secondary"><Link to="/me">{t('ticket.backToTickets')}</Link></Button>
      </div>
    </section>;
  }

  const e = data.event;
  const status = data.status ?? 'going';
  const active = ['going', 'maybe'].includes(status) && e.status === 'published';
  const ended = new Date(e.ends_at ?? new Date(new Date(e.starts_at).getTime() + 3600000)).getTime() < Date.now();
  const place = [e.location_name, e.address].filter(Boolean).join(' · ');
  const icsEvent: IcsEvent = {
    id: e.id, title: e.title, startsAt: e.starts_at, endsAt: e.ends_at,
    location: e.online_url && !place ? t('teamSpace.online') : place || null,
    status: e.status === 'cancelled' ? 'cancelled' : 'confirmed',
    url: `${window.location.origin}/e/${e.id}`,
  };

  const stateKey = e.status === 'cancelled' ? 'eventCancelled'
    : status === 'cancelled' ? 'cancelled'
    : status === 'waitlist' ? 'waitlisted'
    : ended ? 'expired' : null;

  return <section className="panel ticket-panel">
    <Link to="/me" className="auth-link back-link no-print"><ArrowLeft />{t('ticket.backToTickets')}</Link>

    <div className={`ticket-card-detail ${active ? '' : 'is-inactive'}`}>
      <header className="ticket-head">
        <h1>{e.title}</h1>
        <span className={`chip ${active ? 'published-chip' : ''}`}>{t(`ticket.status.${stateKey ?? status}`)}</span>
      </header>

      <ul className="detail-facts">
        <li><CalendarDays />{formatWhen(e.starts_at, lang)}<span className="muted"> ({e.timezone})</span></li>
        {place && <li><MapPin />{place}</li>}
        {!place && e.online_url && <li><Video />{t('teamSpace.online')}</li>}
      </ul>

      <dl className="ticket-meta">
        <div><dt>{t('ticket.attendee')}</dt><dd>{data.guest_name}</dd></div>
        <div><dt>{t('ticket.partySize')}</dt><dd className="tabular-nums">{1 + (data.plus_ones ?? 0)}</dd></div>
        {data.tier_name && <div><dt>{t('ticket.tier')}</dt><dd>{data.tier_name}</dd></div>}
        {status === 'waitlist' && data.waitlist_position != null && <div><dt>{t('ticket.waitlistPos')}</dt><dd className="tabular-nums">#{data.waitlist_position}</dd></div>}
        {data.checked_in_at && <div><dt>{t('ticket.checkedInAt')}</dt><dd>{new Date(data.checked_in_at).toLocaleString(lang === 'es' ? 'es-419' : 'en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</dd></div>}
      </dl>

      {active && <div className="ticket-qr-block">
        <div className="ticket-qr" aria-hidden="true">
          <QRCodeSVG value={code} size={220} level="M" marginSize={2} />
        </div>
        <p className="ticket-code" aria-label={t('ticket.codeLabel')}>{groupedCode(code)}</p>
        <p className="muted">{t('ticket.showAtDoor')}</p>
      </div>}

      {stateKey && <div className={`ticket-state is-${stateKey}`} role="status">
        {stateKey === 'expired' ? <CheckCircle2 /> : <AlertCircle />}
        <p>{t(`ticket.stateText.${stateKey}`, { position: data.waitlist_position ?? 0 })}</p>
      </div>}

      {e.meeting_note && active && <div className="ticket-note"><strong>{t('ticket.arrival')}</strong><p>{e.meeting_note}</p></div>}
      {e.accessibility_notes && <div className="ticket-note"><strong>{t('ticket.accessibility')}</strong><p>{e.accessibility_notes}</p></div>}
      {e.cancellation_policy && <div className="ticket-note"><strong>{t('ticket.cancelPolicy')}</strong><p>{e.cancellation_policy}</p></div>}

      <div className="ticket-actions no-print">
        <AddToCalendar event={icsEvent} filename={`${e.title.replace(/[^\w-]+/g, '-').toLowerCase()}.ics`} />
        {active && <Button variant="secondary" onClick={() => window.print()}><Printer />{t('ticket.print')}</Button>}
        {e.online_url && active && <Button asChild variant="secondary"><a href={e.online_url} target="_blank" rel="noopener noreferrer"><Video />{t('guest.joinOnline')}</a></Button>}
        {active && <ContactHostButton eventId={e.id} />}
      </div>

      <div className="ticket-wallet no-print">
        <h2>{t('wallet.title')}</h2>
        <div className="wallet-row">
          <Button variant="secondary" disabled aria-disabled="true"><CreditCard />{t('wallet.apple')}</Button>
          <Button variant="secondary" disabled aria-disabled="true"><CreditCard />{t('wallet.google')}</Button>
        </div>
        <p className="muted">{t('wallet.setupRequired')}</p>
      </div>
    </div>
  </section>;
}
