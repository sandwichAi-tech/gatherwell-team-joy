import { RefundLine } from '@/components/refund-line';
import { CommunitySeatCard } from '@/components/community-seats';
import { serviceFee } from '@/lib/plan-fees';
import { RetreatDetails } from '@/components/retreat';
import { asRetreat } from '@/lib/retreat';
import { VerifiedMark } from '@/components/coach-trust';
import { EarlyAccessNotice, earlyAccessQuery } from '@/components/early-access';
import { recordReferral, rememberRef } from '@/lib/network';
import { recordInvite, rememberInvite } from '@/lib/welcome';
import { useEffect, useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { GuestShell } from '@/components/guest-shell';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Ban, CalendarDays, Clock, MapPin, Video } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { GatheringCover } from '@/components/gathering-cover';
import { TeamRsvpSheet, TeamConfirmation, type TeamResult } from '@/components/team-rsvp';
import { CalendarButtons, Confirmation, DirectionsButton, RsvpSheet, type RsvpResult } from '@/components/guest-rsvp';
import { initialsOf, mediaUrl } from '@/lib/account';
import { Polls, PhotoRoll, WeatherNote, useLiveCounts } from '@/components/event-live';
import { formatWhen, isUuid, prefetchPublic, publicEventQuery, rsvpByCodeQuery } from '@/lib/guest';
import { regWindowState } from '@/lib/event-builder';
import { getPublicEventMeta } from '@/lib/public-event.functions';
import i18n from '@/lib/i18n';
import { supabase } from '@/integrations/supabase/client';
import { formatMoney } from '@/lib/billing';
import { ReportButton } from '@/components/report-button';
import { RetryState } from '@/components/launch-states';

export const Route = createFileRoute('/e/$id')({
  loader: async ({ params, context }) => {
    if (!isUuid(params.id)) return null;
    await prefetchPublic(context.queryClient, publicEventQuery(params.id));
    try { return await getPublicEventMeta({ data: { id: params.id } }); } catch { return null; }
  },
  head: ({ loaderData }) => {
    const brand = i18n.t('brand');
    if (!loaderData) {
      const title = `${i18n.t('guest.metaFallback')} · ${brand}`;
      return { meta: [{ title }, { name: 'description', content: i18n.t('meta.event') }, { property: 'og:title', content: title }, { property: 'og:description', content: i18n.t('meta.event') }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] };
    }
    const date = new Intl.DateTimeFormat(i18n.resolvedLanguage === 'es' ? 'es-419' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: loaderData.timezone || 'UTC', timeZoneName: 'short' }).format(new Date(loaderData.startsAt));
    const title = `${loaderData.title} · ${date}`;
    const lng = i18n.resolvedLanguage === 'es' ? 'es' : 'en';
    const bits = [date, loaderData.place ?? (loaderData.online ? i18n.t('guest.metaOnline') : null), loaderData.host ? i18n.t('guest.metaHost', { name: loaderData.host }) : null, loaderData.priceCents ? formatMoney(loaderData.priceCents, lng) : i18n.t('guest.metaFree')].filter(Boolean);
    const description = loaderData.cancelled ? i18n.t('guest.cancelledTitle') : `${bits.join(' · ')} — ${i18n.t('guest.metaInvite')}`;
    const meta: Array<Record<string, string>> = [{ title }, { name: 'description', content: description }, { property: 'og:title', content: title }, { property: 'og:description', content: description }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: loaderData.image ? 'summary_large_image' : 'summary' }, { name: 'twitter:title', content: title }, { name: 'twitter:description', content: description }];
    if (loaderData.image) meta.push({ property: 'og:image', content: loaderData.image }, { name: 'twitter:image', content: loaderData.image });
    return { meta };
  },
  errorComponent: ({ reset }) => <GuestShell><RetryState retry={reset} /></GuestShell>,
  notFoundComponent: () => <GuestShell><p className="guest-empty">{i18n.t('publicEvent.notFound')}</p></GuestShell>,
  component: PublicEventPage,
});

function PublicEventPage() {
  return <GuestShell><PublicEventBody /></GuestShell>;
}

function PublicEventBody() {
  const { t, i18n: inst } = useTranslation(); const lang = inst.resolvedLanguage === 'es' ? 'es' : 'en';
  const { id } = Route.useParams(); const meta = Route.useLoaderData();
  const queryClient = useQueryClient();
  const { data: event, isLoading, error, refetch } = useQuery(publicEventQuery(id));
  useLiveCounts(id, () => void queryClient.invalidateQueries({ queryKey: ['public-event', id] }));
  const { data: hostPhoto } = useQuery({ queryKey: ['media-url', event?.host?.avatar_url], queryFn: () => mediaUrl(event?.host?.avatar_url), enabled: !!event?.host?.avatar_url });
  useEffect(() => { rememberRef(id, new URLSearchParams(window.location.search).get('ref')); rememberInvite(new URLSearchParams(window.location.search).get('inv')); }, [id]);
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => { void supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session)); }, []);
  const [intent, setIntent] = useState<'going' | 'maybe' | null>(null);
  const [result, setResult] = useState<RsvpResult | null>(null);
  const [teamOpen, setTeamOpen] = useState(false); const [teamResult, setTeamResult] = useState<TeamResult | null>(null);
  const { data: price } = useQuery({ queryKey: ['event-price', id], queryFn: async () => { const { data } = await supabase.rpc('event_price', { _id: id }); return (data as { price_cents: number; pass_fee: boolean; fee_pct: number; cover_service_fee?: boolean; service_fee_percent?: number; service_fee_fixed?: number; refund_policy?: string } | null) ?? null; } });
  const { data: early } = useQuery(earlyAccessQuery(id));

  if (isLoading) return <div className="guest-skeleton" aria-busy="true"><div className="guest-cover skeleton" /><p className="guest-empty">{t('publicEvent.loading')}</p></div>;
  if (error) return <RetryState retry={() => void refetch()} />;
  if (!event) return <p className="guest-empty">{t('publicEvent.notFound')}</p>;

  const tzOpts: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric' };
  const day = formatWhen(event.starts_at, lang, tzOpts);
  const time = formatWhen(event.starts_at, lang, { hour: 'numeric', minute: '2-digit' }) + (event.ends_at ? ` – ${formatWhen(event.ends_at, lang, { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}` : ` ${formatWhen(event.starts_at, lang, { timeZoneName: 'short' }).split(' ').pop()}`);
  const description = lang === 'es' ? event.description_es || event.description_en : event.description_en || event.description_es;
  const left = event.capacity != null ? Math.max(0, event.capacity - event.going) : null;
  const full = left === 0;
  const cancelled = event.status === 'cancelled';
  const summary = lang === 'es' ? event.summary_es || event.summary_en : event.summary_en || event.summary_es;
  const regState = regWindowState(event.reg_opens_at, event.reg_closes_at);
  const regClosed = regState === 'closed';
  const regNotOpen = regState === 'not_open';
  const waitlistOff = full && event.waitlist_enabled === false;

  if (teamResult) return <>
    <GatheringCover path={event.cover_url} style={event.cover_style} title={event.title} className="guest-cover" />
    <div className="guest-body"><TeamConfirmation result={teamResult} /></div>
  </>;

  if (result) return <>
    <GatheringCover path={event.cover_url} style={event.cover_style} title={event.title} className="guest-cover" />
    <ConfirmationLoader code={result.code} fallbackStatus={result.status} />
    <div className="guest-body live-extras"><Polls eventId={id} code={result.code} /></div>
  </>;

  return <>
    <GatheringCover path={event.cover_url} style={event.cover_style} title={event.title} className="guest-cover" />
    <article className="guest-body">
      <div className="guest-title-row"><h1 className="guest-title">{event.title}</h1><ReportButton type="event" id={id} /></div>
      {summary && <p className="guest-summary">{summary}</p>}
      {!!event.tags?.length && <ul className="guest-tags" aria-label={t('builder.tags')}>{event.tags.map(tag => <li key={tag} className="chip">{tag}</li>)}</ul>}
      {price && <p className="guest-price-line"><strong className="tabular-nums">{formatMoney(price.price_cents, lang)}</strong><span>{t('billing.perPerson')}{price.pass_fee ? ` · ${t('billing.feeNote', { pct: price.fee_pct })}` : ''}{price.cover_service_fee ? ` · ${t('billing.allInShort')}` : ` · ${t('billing.plusServiceFee', { fee: formatMoney(serviceFee(price.price_cents, Number(price.service_fee_percent ?? 0), price.service_fee_fixed ?? 0), lang) })}`}</span></p>}
      {price && <RefundLine policy={price.refund_policy} />}
      {cancelled && <div className="guest-cancelled" role="status"><Ban /><div><strong>{t('guest.cancelledTitle')}</strong><p>{t('guest.cancelledText')}</p></div></div>}
      <ul className="guest-facts">
        <li><CalendarDays /><span>{day}</span></li>
        <li><Clock /><span>{time}</span></li>
      </ul>
      {!event.is_online && !cancelled && <WeatherNote lat={event.lat} lng={event.lng} startsAt={event.starts_at} />}

      <div className="guest-host">
        {hostPhoto ? <img src={hostPhoto} alt="" className="guest-host-photo" /> : <span className="initial-avatar">{initialsOf(event.host?.name ?? null)}</span>}
        <div><span className="guest-label">{t('guest.hostedBy')}</span><strong>{event.host?.name ?? t('teamSpace.someone')}{event.host?.verified && <> <VerifiedMark compact /></>}</strong>{event.team_name && <span className="muted">{event.team_name}</span>}</div>
      </div>
      {!!event.cohosts?.length && <div className="guest-cohosts"><span className="guest-label">{t('cohosts.withCohosts')}</span><ul>{event.cohosts.map((c, i) => <li key={i}><span className="initial-avatar">{initialsOf(c.name)}</span><span>{c.name ?? t('teamSpace.someone')}</span></li>)}</ul></div>}

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
      {asRetreat(event.retreat) && <RetreatDetails retreat={asRetreat(event.retreat)!} startsAt={event.starts_at} endsAt={event.ends_at} priceCents={price?.price_cents ?? null} />}

      <section className="guest-going" aria-live="polite">
        {!event.hide_guest_list && (event.initials?.length ?? 0) > 0 && <div className="guest-avatars" aria-hidden="true">{event.initials!.map((i, n) => <span key={n} className="initial-avatar">{i}</span>)}</div>}
        <p className="tabular-nums">{t('guest.goingCount', { count: event.going })}{left != null && ` · ${full ? t('guest.full') : t('guest.spotsLeft', { count: left })}`}</p>
      </section>

      {!cancelled && early && <EarlyAccessNotice access={early} />}
      {!cancelled && (!early || early.has_access || event.my_code) && <>
        {event.my_code ? <div className="guest-actions"><p className="guest-label">{t('guest.alreadyIn')}</p><Button asChild className="guest-primary"><Link to="/r/$code" params={{ code: event.my_code }}>{t('guest.manage')}</Link></Button></div>
          : <div className="guest-actions">
            <Button className="guest-primary" onClick={() => setIntent('going')}>{full ? t('guest.joinWaitlist') : price ? t('billing.imInPrice', { amount: formatMoney(price.price_cents, lang) }) : t('guest.imIn')}</Button>
            <Button variant="secondary" className="guest-secondary" onClick={() => setIntent('maybe')}>{t('guest.maybe')}</Button>
            {event.team_registration && <Button variant="secondary" className="guest-secondary" onClick={() => setTeamOpen(true)}>{t('teamRsvp.cta', { min: event.team_min ?? 2, max: event.team_max ?? 6 })}</Button>}
          </div>}
        {price && !event.my_code && <CommunitySeatCard kind="event" target={id} signedIn={signedIn} />}
        <CalendarButtons event={event} />
      </>}
      <Polls eventId={id} code={event.my_code} />
      <PhotoRoll eventId={id} code={event.my_code} canAdd={!!event.my_code} />
    </article>
    {event.team_registration && <TeamRsvpSheet event={event} open={teamOpen} price={price ?? null} onClose={() => setTeamOpen(false)} onDone={r => { setTeamOpen(false); setTeamResult(r); void queryClient.invalidateQueries({ queryKey: ['public-event', id] }); window.scrollTo({ top: 0 }); }} />}
    <RsvpSheet event={event} intent={intent} onClose={() => setIntent(null)} onDone={r => { void recordReferral(id, r.code); void recordInvite(r.code); setIntent(null); setResult(r); void queryClient.invalidateQueries({ queryKey: ['public-event', id] }); window.scrollTo({ top: 0 }); }} />
  </>;
}

function ConfirmationLoader({ code, fallbackStatus }: { code: string; fallbackStatus: RsvpResult['status'] }) {
  const { data } = useQuery(rsvpByCodeQuery(code));
  if (!data) return null;
  return <article className="guest-body"><Confirmation event={data.event} code={code} status={data.status ?? fallbackStatus} /></article>;
}
