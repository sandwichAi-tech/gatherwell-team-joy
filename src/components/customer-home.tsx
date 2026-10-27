import { personalHomeQuery } from '@/lib/personal-home-query';
import { Link } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/launch-states';
import { CalendarButtons, DirectionsButton } from '@/components/guest-rsvp';
import { ChevronRight, QrCode } from '@/components/icons';
import { CheckinQrSheet, type CheckinQrTarget } from '@/components/checkin-qr-sheet';
import { useEffect, useState } from 'react';
import { formatWhen } from '@/lib/guest';

export function CustomerHome({ userId }: { userId: string }) {
  const { t, i18n } = useTranslation(); const lang = i18n.resolvedLanguage ?? 'en';
  const [qr, setQr] = useState<CheckinQrTarget | null>(null);
  const { data } = useSuspenseQuery(personalHomeQuery(userId));
  const next = data.events.map(event => ({ event, status: event.registration_status, checkin_code: event.checkin_code, checked_in_at: event.checked_in_at }));
  useEffect(() => { setQr(null); }, [data]);
  return <>
    <section className="panel" aria-labelledby="ch-next"><div className="section-heading"><h2 id="ch-next">{t('customerHome.next')}</h2></div>
      {!next.length ? <EmptyState compact icon="CalendarDays" title={t('customerHome.noRsvps')} text={t('customerHome.noRsvpsText')} action={<Button asChild><Link to="/discover">{t('customerHome.find')}</Link></Button>} />
        : <ul className="customer-list">{next.map(r => <li key={r.event.id} className="customer-item">
          <Link to="/e/$id" params={{ id: r.event.id }} className="customer-item-head"><strong>{r.event.title}</strong><small>{formatWhen(r.event.starts_at, lang)}{r.event.location_name ? ` · ${r.event.location_name}` : ''}</small><ChevronRight /></Link>
          {r.status === 'going' && (r.checked_in_at
            ? <p className="customer-checked" role="status">{t('checkinQr.checkedIn')}</p>
            : r.checkin_code
              ? <Button className="customer-qr-button" onClick={() => { if (r.checkin_code) setQr({ code: r.checkin_code, title: r.event.title, startsAt: r.event.starts_at, checkedInAt: r.checked_in_at }); }} aria-label={t('checkinQr.showFor', { title: r.event.title })}><QrCode />{t('checkinQr.show')}</Button>
              : <p className="auth-subtitle" role="status">{t('checkinQr.missing')}</p>)}
          {r.status === 'waitlist' && <p className="auth-subtitle">{t('customerHome.waitlist')}</p>}
          <CalendarButtons event={r.event} />
          <DirectionsButton event={{ ...r.event, is_online: r.event.format === 'online' }} />
        </li>)}</ul>}
      <CheckinQrSheet target={qr} onClose={() => setQr(null)} />
    </section>
    <section className="learn-section"><h2>{t('resourcePlacement.myCoaches')}</h2>{!data.coaches.length ? <EmptyState compact icon="UsersRound" text={t('resourcePlacement.noCoaches')} action={<Button asChild variant="secondary"><Link to="/discover">{t('personalHome.discoverCoaches')}</Link></Button>} /> : <ul className="customer-list">{data.coaches.map(c => <li key={c.id}><Link to="/h/$slug" params={{ slug: c.slug }} className="customer-item-head"><strong>{c.name}</strong><ChevronRight /></Link></li>)}</ul>}</section>
  </>;
}
