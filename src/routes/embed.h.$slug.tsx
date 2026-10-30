import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { pageQuery } from '@/components/follow';
import { HostChallengeCards, type HostChallenge } from '@/components/host-challenges';
import { prefetchPublic, formatWhen } from '@/lib/guest';
import { applySavedLanguage } from '@/lib/i18n';
import { displayTitleCase } from '@/lib/event-presentation';
import { publicCardRoute } from '@/lib/public-cards';
import { pick } from '@/lib/learn';

type EmbedHost = { name: string | null; org: string | null; city: string | null; bio: string | null; upcoming: { id: string; title: string; starts_at: string; timezone: string; location_name: string | null; online: boolean }[]; offerings: { id: string; entity?: string; title_en?: string; title_es?: string; title?: string }[]; challenges?: HostChallenge[] };

/** Public-only, read-only coach page for third-party iframes. Every action opens ZoheeWell in a new tab, so sign-in and payment never run inside the frame. */
export const Route = createFileRoute('/embed/h/$slug')({
  loader: ({ context, params }) => prefetchPublic(context.queryClient, pageQuery('host', params.slug)),
  head: () => ({ meta: [{ title: 'ZoheeWell coach page' }, { name: 'description', content: 'Embedded ZoheeWell coach page with public events, challenges and resources.' }, { name: 'robots', content: 'noindex' }, { property: 'og:title', content: 'ZoheeWell coach page' }, { property: 'og:description', content: 'Public events, challenges and resources from this coach.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] }),
  component: EmbedPage,
});

function EmbedPage() {
  const { slug } = Route.useParams(); const { t, i18n } = useTranslation(); const lang = i18n.resolvedLanguage === 'es' ? 'es' : 'en';
  useEffect(() => { applySavedLanguage(); }, []);
  const q = useQuery(pageQuery('host', slug)); const d = q.data as EmbedHost | null | undefined;
  const page = `/h/${slug}`;
  if (q.isPending) return <main className="embed-page"><p role="status">{t('common.loading')}</p></main>;
  if (!d) return <main className="embed-page"><h1>{t('follow.notFoundTitle')}</h1><a className="embed-open" href="/discover" target="_blank" rel="noopener">{t('embed.openZoheeWell')}</a></main>;
  const name = displayTitleCase(d.name) ?? '';
  return <main className="embed-page">
    <header className="embed-head"><h1>{name}</h1>{d.org && <p>{d.org}</p>}{d.city && <p className="follow-meta">{displayTitleCase(d.city)}</p>}{d.bio && <p className="follow-bio">{d.bio}</p>}</header>
    <HostChallengeCards items={d.challenges ?? []} external />
    <section className="follow-upcoming"><h2>{t('follow.upcoming')}</h2>
      {d.upcoming.length ? <ul className="follow-list">{d.upcoming.map(e => <li key={e.id}><a className="follow-event" href={`/e/${e.id}`} target="_blank" rel="noopener"><span><strong>{e.title}</strong><small>{formatWhen(e.starts_at, lang, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: e.timezone || undefined })}</small><small>{e.location_name ?? (e.online ? t('follow.online') : '')}</small></span></a></li>)}</ul> : <p className="field-hint">{t('follow.noUpcoming', { name })}</p>}
    </section>
    {d.offerings.length > 0 && <section className="follow-upcoming"><h2>{t('follow.offerings')}</h2><ul className="follow-list">{d.offerings.map(o => { const r = publicCardRoute(o as never); const href = r.kind ? `/resource/${r.kind}/${r.id}` : `/o/${r.id}`; return <li key={o.id}><a className="follow-event" href={href} target="_blank" rel="noopener"><strong>{pick(lang, o.title_en ?? o.title ?? '', o.title_es ?? '') || t('resources.untitled')}</strong></a></li>; })}</ul></section>}
    <a className="embed-open" href={page} target="_blank" rel="noopener">{t('embed.openZoheeWell')}</a>
    <p className="field-hint">{t('embed.newTabNote')}</p>
  </main>;
}
