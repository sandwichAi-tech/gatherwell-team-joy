import { useMemo, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { LandingFrame } from '@/components/landing/landing-chrome';
import { CategoryRow } from '@/components/landing/landing-page';
import { LocationFilter } from '@/components/landing/location-filter';
import type { Coords } from '@/components/landing/gathering-card';
import { isCategory, type Category } from '@/lib/landing';
import { ListSkeleton, RetryState } from '@/components/launch-states';
import { LocationCard, publicLocationsQuery } from '@/components/locations';
import { SaveButton } from '@/components/save-button';
import { GwIcon } from '@/components/gw-icon';
import { discoverCatalogQuery, hasActiveFilters, activeFilterCount, hostInviteUrl, type DiscoverFilters, type DiscoverKind, type DiscoverSort, type CatalogItem } from '@/lib/discovery';
import { toast } from 'sonner';

export type DiscoverSearch = {
  q?: string | undefined;
  kind?: string | undefined;       // comma list of DiscoverKind
  cat?: Category | undefined;
  from?: string | undefined;
  to?: string | undefined;
  format?: 'person' | 'online' | 'hybrid' | undefined;
  free?: 1 | 0 | undefined;
  lang?: string | undefined;
  access?: 1 | undefined;
  minors?: 1 | undefined;
  near?: 1 | undefined;            // ask for browser location (explicit action)
  lat?: number | undefined;
  lng?: number | undefined;
  r?: number | undefined;          // radius km
  place?: string | undefined;      // coarse label for the near point
  sort?: DiscoverSort | undefined;
  space?: 1 | undefined;           // legacy: venues with space
};

const KINDS: DiscoverKind[] = ['event', 'course', 'download', 'membership'];

export function searchToFilters(s: DiscoverSearch, near: Coords | null): DiscoverFilters {
  const kinds = s.kind?.split(',').filter((k): k is DiscoverKind => (KINDS as string[]).includes(k));
  const nearFilter = s.lat != null && s.lng != null
    ? { lat: s.lat, lng: s.lng, radiusKm: s.r ?? 50, label: s.place ?? '' }
    : near ? { lat: near.lat, lng: near.lng, radiusKm: s.r ?? 50, label: s.place ?? '' } : undefined;
  return {
    q: s.q || undefined,
    kinds: kinds?.length ? kinds : undefined,
    cat: s.cat,
    from: s.from,
    to: s.to,
    format: s.format,
    free: s.free === 1 ? true : s.free === 0 ? false : undefined,
    lang: s.lang || undefined,
    accessible: s.access === 1 ? true : undefined,
    minors: s.minors === 1 ? true : undefined,
    near: nearFilter,
    sort: s.sort ?? 'soonest',
  };
}

function CatalogCard({ item, lang }: { item: CatalogItem; lang: string }) {
  const { t } = useTranslation();
  const when = item.starts_at ? new Intl.DateTimeFormat(lang === 'es' ? 'es' : 'en', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: item.timezone || undefined }).format(new Date(item.starts_at)) : null;
  return <li className="gw-card catalog-card">
    <Link to={item.kind === 'event' ? '/e/$id' : '/o/$id'} params={{ id: item.id }} className="catalog-card-main">
      <span className="chip">{t(`discover.kind.${item.kind}`)}</span>
      <strong>{item.title}</strong>
      {item.summary && <small className="catalog-summary">{item.summary}</small>}
      <small className="catalog-meta">
        {when ? `${when} · ` : ''}{item.format === 'online' ? t('discover.online') : item.location_name ?? t('discover.online')}
        {item.distance_km != null ? ` · ${t('discover.kmAway', { km: Math.round(item.distance_km) })}` : ''}
      </small>
      <small className="catalog-meta">{item.price_cents ? t('discover.paid') : t('discover.free')}{item.host_name ? ` · ${item.host_name}` : ''}</small>
    </Link>
    <SaveButton kind={item.kind === 'event' ? 'event' : 'offer'} targetId={item.id} />
  </li>;
}

export function DiscoverPage({ search }: { search: DiscoverSearch }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate({ from: '/discover' });
  const lang = i18n.resolvedLanguage === 'es' ? 'es' : 'en';
  const [near, setNear] = useState<Coords | null>(null);
  const spaces = useQuery({ ...publicLocationsQuery(), enabled: search.space === 1 });
  const filters = useMemo(() => searchToFilters(search, near), [search, near]);
  const { data = [], isLoading, error, refetch } = useQuery(discoverCatalogQuery(filters));
  const set = (patch: Partial<DiscoverSearch>) => void navigate({ search: (prev: DiscoverSearch) => ({ ...prev, ...patch }), replace: true });
  const clearAll = () => void navigate({ search: {}, replace: true });
  // Same invite-a-host action as the homepage empty state: opaque token when signed in, plain origin otherwise.
  const shareInvite = async () => {
    const url = await hostInviteUrl(window.location.origin);
    try {
      if (navigator.share) { await navigator.share({ title: t('home.explore.inviteTitle'), text: t('home.explore.inviteText'), url }); return; }
      await navigator.clipboard.writeText(url); toast.success(t('home.explore.inviteCopied'));
    } catch { /* user dismissed share sheet */ }
  };
  const localCount = data.filter(d => d.kind === 'event' && d.format !== 'online').length;
  const onlineCount = data.length - localCount;
  const kinds = filters.kinds ?? [];

  return <LandingFrame>
    <main className="gw-discover">
      <section className="gw-container gw-discover-head">
        <span className="gw-label">{t('landing.discover.label')}</span>
        <h1 className="gw-display gw-h1">{t('landing.discover.title')}</h1>
        <p className="gw-lede">{t('landing.discover.sub')}</p>
      </section>

      <section className="gw-container gw-discover-filters" aria-label={t('discover.filters')}>
        <div className="catalog-search">
          <GwIcon name="Search" size={18} />
          <input type="search" className="catalog-search-input" defaultValue={search.q ?? ''} placeholder={t('discover.searchPlaceholder')} aria-label={t('discover.searchPlaceholder')}
            onKeyDown={e => { if (e.key === 'Enter') set({ q: (e.target as HTMLInputElement).value || undefined }); }}
            onBlur={e => { if ((e.target.value || undefined) !== search.q) set({ q: e.target.value || undefined }); }} />
        </div>
        <div className="chip-row" role="group" aria-label={t('discover.typeLabel')}>
          {KINDS.map(k => <button key={k} type="button" className={`chip${kinds.includes(k) ? ' selected' : ''}`} aria-pressed={kinds.includes(k)}
            onClick={() => set({ kind: kinds.includes(k) ? (kinds.filter(x => x !== k).join(',') || undefined) : [...kinds, k].join(',') })}>{t(`discover.kind.${k}`)}</button>)}
        </div>
        <CategoryRow selected={search.cat ?? null} onSelect={c => set({ cat: c ?? undefined })} />
        <div className="chip-row" role="group" aria-label={t('discover.formatLabel')}>
          {(['person', 'online', 'hybrid'] as const).map(f => <button key={f} type="button" className={`chip${search.format === f ? ' selected' : ''}`} aria-pressed={search.format === f} onClick={() => set({ format: search.format === f ? undefined : f })}>{t(`discover.format.${f}`)}</button>)}
          <button type="button" className={`chip${search.free === 1 ? ' selected' : ''}`} aria-pressed={search.free === 1} onClick={() => set({ free: search.free === 1 ? undefined : 1 })}>{t('discover.free')}</button>
          <button type="button" className={`chip${search.free === 0 ? ' selected' : ''}`} aria-pressed={search.free === 0} onClick={() => set({ free: search.free === 0 ? undefined : 0 })}>{t('discover.paid')}</button>
          <button type="button" className={`chip${search.lang === 'es' ? ' selected' : ''}`} aria-pressed={search.lang === 'es'} onClick={() => set({ lang: search.lang === 'es' ? undefined : 'es' })}>{t('discover.spanish')}</button>
          <button type="button" className={`chip${search.access === 1 ? ' selected' : ''}`} aria-pressed={search.access === 1} onClick={() => set({ access: search.access === 1 ? undefined : 1 })}>{t('discover.accessible')}</button>
          <button type="button" className={`chip${search.minors === 1 ? ' selected' : ''}`} aria-pressed={search.minors === 1} onClick={() => set({ minors: search.minors === 1 ? undefined : 1 })}>{t('discover.family')}</button>
        </div>
        <div className="chip-row catalog-dates" role="group" aria-label={t('discover.datesLabel')}>
          <label className="catalog-date"><span>{t('discover.from')}</span><input type="date" value={search.from ?? ''} onChange={e => set({ from: e.target.value || undefined })} /></label>
          <label className="catalog-date"><span>{t('discover.to')}</span><input type="date" value={search.to ?? ''} onChange={e => set({ to: e.target.value || undefined })} /></label>
        </div>
        <LocationFilter near={near} onNear={c => { setNear(c); if (c) set({ lat: c.lat, lng: c.lng, r: search.r ?? 50 }); else set({ lat: undefined, lng: undefined, place: undefined }); }} autoAsk={search.near === 1} />
        {filters.near && <div className="chip-row" role="group" aria-label={t('discover.radiusLabel')}>
          {[25, 50, 100].map(r => <button key={r} type="button" className={`chip${(search.r ?? 50) === r ? ' selected' : ''}`} aria-pressed={(search.r ?? 50) === r} onClick={() => set({ r })}>{t('discover.km', { km: r })}</button>)}
        </div>}
        <div className="chip-row" role="group" aria-label={t('discover.sortLabel')}>
          {(['soonest', 'newest', 'relevant'] as const).map(s => <button key={s} type="button" className={`chip${(search.sort ?? 'soonest') === s ? ' selected' : ''}`} aria-pressed={(search.sort ?? 'soonest') === s} onClick={() => set({ sort: s })}>{t(`discover.sort.${s}`)}</button>)}
          <button type="button" className={`chip gw-space-chip${search.space === 1 ? ' selected' : ''}`} aria-pressed={search.space === 1} onClick={() => set({ space: search.space === 1 ? undefined : 1 })}>{t('locations.hasSpace')}</button>
        </div>
        {hasActiveFilters(filters) && <div className="chip-row">
          <span className="gw-fine" role="status">{t('discover.activeFilters', { count: activeFilterCount(filters) })}</span>
          <button type="button" className="chip" onClick={clearAll}>{t('discover.clearAll')}</button>
        </div>}
      </section>

      {search.space === 1 && <section className="gw-container gw-section-tight" aria-label={t('locations.spacesTitle')}>
        <h2 className="gw-h3">{t('locations.spacesTitle')}</h2>
        {spaces.isLoading ? <ListSkeleton rows={2} /> : spaces.isError ? <RetryState retry={() => void spaces.refetch()} /> : spaces.data?.length
          ? <div className="loc-card-list">{spaces.data.map(l => <LocationCard key={l.id} l={l} />)}</div> : <div className="gw-empty"><p>{t('locations.noSpaces')}</p></div>}
      </section>}

      {search.space !== 1 && <section className="gw-container gw-section-tight" aria-live="polite">
        {isLoading && <ListSkeleton />}
        {error && <RetryState retry={() => void refetch()} />}
        {!isLoading && !error && <p className="gw-fine" role="status">{t('discover.count', { count: data.length })}</p>}
        {!isLoading && !error && data.length > 0 && <ul className="gw-grid catalog-grid">{data.map(item => <CatalogCard key={`${item.kind}:${item.id}`} item={item} lang={lang} />)}</ul>}
        {!isLoading && !error && data.length === 0 && <div className="gw-empty">
          <p><strong>{filters.near ? t('discover.emptyLocal') : t('discover.empty')}</strong></p>
          <div className="gw-empty-actions">
            {hasActiveFilters(filters) && <button type="button" className="gw-btn gw-btn-secondary" onClick={clearAll}>{t('discover.clearAll')}</button>}
            <Link to="/alerts" className="gw-btn gw-btn-secondary">{t('discover.notifyMe')}</Link>
            <button type="button" className="gw-btn gw-btn-secondary" onClick={() => void shareInvite()}>{t('discover.inviteHost')}</button>
          </div>
        </div>}
        {!isLoading && !error && filters.near && localCount === 0 && onlineCount > 0 && <p className="gw-fine">{t('discover.onlineInstead')}</p>}
      </section>}
    </main>
  </LandingFrame>;
}

export { isCategory };
