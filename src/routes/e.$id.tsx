import { useState, type ReactNode } from 'react';
import { ClientOnly, createFileRoute, Link } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Ban, CalendarDays, Clock, MapPin, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Brand, LanguageToggle } from '@/components/auth-frame';
import { GatheringCover } from '@/components/gathering-cover';
import { CalendarButtons, Confirmation, DirectionsButton, RsvpSheet, type RsvpResult } from '@/components/guest-rsvp';
import { initialsOf, mediaUrl } from '@/lib/account';
import { formatWhen, isUuid, publicEventQuery } from '@/lib/guest';
import { getPublicEventMeta } from '@/lib/public-event.functions';
import i18n from '@/lib/i18n';

export const Route = createFileRoute('/e/$id')({
  loader: async ({ params }) => {
    if (!isUuid(params.id)) return null;
    try { return await getPublicEventMeta({ data: { id: params.id } }); } catch { return null; }
  },
  head: ({ loaderData }) => {
    const brand = i18n.t('brand');
    if (!loaderData) {
      const title = `${i18n.t('guest.metaFallback')} · ${brand}`;
      return { meta: [{ title }, { name: 'description', content: i18n.t('meta.event') }, { property: 'og:title', content: title }, { property: 'og:description', content: i18n.t('meta.event') }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] };
    }
    const date = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: loaderData.timezone || 'UTC', timeZoneName: 'short' }).format(new Date(loaderData.startsAt));
    const title = `${loaderData.title} · ${date}`;
    const description = loaderData.cancelled ? i18n.t('guest.cancelledTitle') : `${date} — ${i18n.t('guest.metaInvite')}`;
    const meta: Array<Record<string, string>> = [{ title }, { name: 'description', content: description }, { property: 'og:title', content: title }, { property: 'og:description', content: description }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: loaderData.image ? 'summary_large_image' : 'summary' }, { name: 'twitter:title', content: title }, { name: 'twitter:description', content: description }];
    if (loaderData.image) meta.push({ property: 'og:image', content: loaderData.image }, { name: 'twitter:image', content: loaderData.image });
    return { meta };
  },
  errorComponent: () => <GuestShell><p className="guest-empty">{i18n.t('guest.errors.generic')}</p></GuestShell>,
  notFoundComponent: () => <GuestShell><p className="guest-empty">{i18n.t('publicEvent.notFound')}</p></GuestShell>,
  component: PublicEventPage,
});

export function GuestShell({ children }: { children: ReactNode }) {
  return <ClientOnly fallback={<div className="guest-screen" />}><GuestShellInner>{children}</GuestShellInner></ClientOnly>;
}

function GuestShellInner({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  return <div className="guest-screen">
    <header className="guest-topbar"><Brand /><LanguageToggle /></header>
    <main className="guest-main">{children}</main>
    <footer className="guest-footer"><Link to="/login">{t('guest.hostYourOwn')}</Link></footer>
  </div>;
}

function PublicEventPage() {
  return <GuestShell><PublicEventBody /></GuestShell>;
}

function PublicEventBody() {
  const { t, i18n: inst } = useTranslation(); const lang = inst.resolvedLanguage === 'es' ? 'es' : 'en';
  const { id } = Route.useParams(); const meta = Route.useLoaderData();
  const queryClient = useQueryClient();
  const { data: event, isLoading } = useQuery({ ...publicEventQuery(id), refetchInterval: 15000 });
  const { data: hostPhoto } = useQuery({ queryKey: ['media-url', event?.host?.avatar_url], queryFn: () => mediaUrl(event?.host?.avatar_url), enabled: !!event?.host?.avatar_url });
  const [intent, setIntent] = useState<'going' | 'maybe' | null>(null);
  const [result, setResult] = useState<RsvpResult | null>(null);

  if (isLoading) return <div className="guest-skeleton" aria-busy="true"><div className="guest-cover skeleton" /><p className="guest-empty">{t('publicEvent.loading')}</p></div>;
  if (!event) return <p className="guest-empty">{t('publicEvent.notFound')}</p>;

  const tzOpts: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric' };
  const day = formatWhen(event.starts_at, lang, tzOpts);
  const time = formatWhen(event.starts_at, lang, { hour: 'numeric', minute: '2-digit' }) + (event.ends_at ? ` – ${formatWhen(event.ends_at, lang, { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}` : ` ${formatWhen(event.starts_at, lang, { timeZoneName: 'short' }).split(' ').pop()}`);
  const description = lang === 'es' ? event.description_es || event.description_en : event.description_en || event.description_es;
  const left = event.capacity != null ? Math.max(0, event.capacity - event.going) : null;
  const full = left === 0;
  const cancelled = event.status === 'cancelled';

  if (result) return <>
    <GatheringCover path={event.cover_url} style={event.cover_style} title={event.title} className="guest-cover" />
    <ConfirmationLoader code={result.code} fallbackStatus={result.status} />
  </>;

  return <>
    <GatheringCover path={event.cover_url} style={event.cover_style} title={event.title} className="guest-cover" />
    <article className="guest-body">
      <h1 className="guest-title">{event.title}</h1>
      {cancelled && <div className="guest-cancelled" role="status"><Ban /><div><strong>{t('guest.cancelledTitle')}</strong><p>{t('guest.cancelledText')}</p></div></div>}
      <ul className="guest-facts">
        <li><CalendarDays /><span>{day}</span></li>
        <li><Clock /><span>{time}</span></li>
      </ul>

      <div className="guest-host">
        {hostPhoto ? <img src={hostPhoto} alt="" className="guest-host-photo" /> : <span className="initial-avatar">{initialsOf(event.host?.name ?? null)}</span>}
        <div><span className="guest-label">{t('guest.hostedBy')}</span><strong>{event.host?.name ?? t('teamSpace.someone')}</strong>{event.team_name && <span className="muted">{event.team_name}</span>}</div>
      </div>

      {event.is_online ? <section className="guest-card"><div className="guest-place"><Video /><div><strong>{t('publicEvent.online')}</strong><p>{t('guest.onlineHidden')}</p></div></div></section>
        : (event.location_name || event.address) && <section className="guest-card">
          {meta?.staticMap && <img className="guest-map" src={meta.staticMap} alt={t('guest.mapAlt')} loading="lazy" />}
          <div className="guest-place"><MapPin /><div>
            {event.location_name && <strong>{event.location_name}</strong>}
            {event.address && <p>{event.address}</p>}
            {event.meeting_note && <p className="muted">{t('guest.meetingPoint')}: {event.meeting_note}</p>}
          </div></div>
          {!cancelled && <DirectionsButton event={event} />}
        </section>}

      {description && <section className="guest-description"><p>{description}</p></section>}

      <section className="guest-going" aria-live="polite">
        {!event.hide_guest_list && (event.initials?.length ?? 0) > 0 && <div className="guest-avatars" aria-hidden="true">{event.initials!.map((i, n) => <span key={n} className="initial-avatar">{i}</span>)}</div>}
        <p className="tabular-nums">{t('guest.goingCount', { count: event.going })}{left != null && ` · ${full ? t('guest.full') : t('guest.spotsLeft', { count: left })}`}</p>
      </section>

      {!cancelled && <>
        {event.my_code ? <div className="guest-actions"><p className="guest-label">{t('guest.alreadyIn')}</p><Button asChild className="guest-primary"><Link to="/r/$code" params={{ code: event.my_code }}>{t('guest.manage')}</Link></Button></div>
          : <div className="guest-actions">
            <Button className="guest-primary" onClick={() => setIntent('going')}>{full ? t('guest.joinWaitlist') : t('guest.imIn')}</Button>
            <Button variant="secondary" className="guest-secondary" onClick={() => setIntent('maybe')}>{t('guest.maybe')}</Button>
          </div>}
        <CalendarButtons event={event} />
      </>}
    </article>
    <RsvpSheet event={event} intent={intent} onClose={() => setIntent(null)} onDone={r => { setIntent(null); setResult(r); void queryClient.invalidateQueries({ queryKey: ['public-event', id] }); window.scrollTo({ top: 0 }); }} />
  </>;
}

function ConfirmationLoader({ code, fallbackStatus }: { code: string; fallbackStatus: RsvpResult['status'] }) {
  const { data } = useQuery({ queryKey: ['rsvp', code], queryFn: async () => (await import('@/lib/guest')).rsvpByCodeQuery(code).queryFn() });
  if (!data) return null;
  return <article className="guest-body"><Confirmation event={data.event} code={code} status={data.status ?? fallbackStatus} /></article>;
}
