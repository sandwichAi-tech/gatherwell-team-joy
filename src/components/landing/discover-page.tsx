import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { GatheringCard, type Coords } from '@/components/landing/gathering-card';
import { LandingFrame } from '@/components/landing/landing-chrome';
import { CategoryRow } from '@/components/landing/landing-page';
import { LocationFilter, sortForFeed } from '@/components/landing/location-filter';
import { distanceKm, inNextDays, isThisWeekend, isToday, publicGatheringsQuery, type Category } from '@/lib/landing';
import { ListSkeleton, RetryState } from '@/components/launch-states';

export type DiscoverSearch = { cat?: Category | undefined; when?: 'today' | 'weekend' | 'week' | undefined; near?: 1 | undefined };

export function DiscoverPage({ search }: { search: DiscoverSearch }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate({ from: '/discover' });
  const lang = i18n.resolvedLanguage === 'es' ? 'es' : 'en';
  const { data = [], isLoading, error, refetch } = useQuery(publicGatheringsQuery(lang));
  const [near, setNear] = useState<Coords | null>(null);
  const when = search.when;
  const set = (patch: Partial<DiscoverSearch>) => void navigate({ search: prev => ({ ...prev, ...patch }), replace: true });

  const filtered = data.filter(g => (!search.cat || g.category === search.cat)
    && (when === 'today' ? isToday(g.startsAt) : when === 'weekend' ? isThisWeekend(g.startsAt) : when === 'week' ? inNextDays(g.startsAt, 7) : inNextDays(g.startsAt, 14)));
  const list = near ? sortForFeed(filtered, near, distanceKm) : [...filtered].sort((a, b) => Number(!!b.featured) - Number(!!a.featured) || a.startsAt.getTime() - b.startsAt.getTime());

  return <LandingFrame>
    <main className="gw-discover">
      <section className="gw-container gw-discover-head">
        <span className="gw-label">{t('landing.discover.label')}</span>
        <h1 className="gw-display gw-h1">{t('landing.discover.title')}</h1>
        <p className="gw-lede">{t('landing.discover.sub')}</p>
      </section>
      <CategoryRow selected={search.cat ?? null} onSelect={c => set({ cat: c ?? undefined })} />
      <section className="gw-container gw-discover-filters">
        <div className="segmented gw-date-chips" role="group" aria-label={t('landing.discover.dateLabel')}>
          {(['today', 'weekend', 'week'] as const).map(w => <button key={w} type="button" aria-pressed={when === w} className={when === w ? 'selected' : ''} onClick={() => set({ when: when === w ? undefined : w })}>{t(`landing.discover.${w}`)}</button>)}
        </div>
        <LocationFilter near={near} onNear={setNear} autoAsk={search.near === 1} />
      </section>
      <section className="gw-container gw-section-tight">
        {isLoading && <ListSkeleton />}{error && <RetryState retry={() => void refetch()} />}
        {!isLoading && <p className="gw-fine" role="status">{t('landing.discover.count', { count: list.length })}</p>}
        {list.length ? <div className="gw-grid">{list.map(g => <GatheringCard key={g.id} g={g} near={near} showRsvp />)}</div>
          : !isLoading && <div className="gw-empty"><p>{search.cat ? t('landing.feed.emptyCat') : t('landing.feed.empty')}</p></div>}
        {list.some(g => g.isSample) && <p className="gw-fine">{t('landing.feed.sampleNote')}</p>}
      </section>
    </main>
  </LandingFrame>;
}
