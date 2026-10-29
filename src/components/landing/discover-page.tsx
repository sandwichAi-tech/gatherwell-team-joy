import { displayTitleCase, eventPhotoSlot } from '@/lib/event-presentation';
import { usePublicSession } from '@/hooks/use-public-session';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
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
import type { MediaSrc } from '@/lib/media-renditions';
import { BrandImage } from '@/components/brand-image';
import { coverStyleAt, clampFocal } from '@/lib/cover';
import { publicCovers } from '@/lib/discover-media.functions';
import {
  fetchCatalogPage, fetchCoachesPage, coverRefsFor, fallbackCoverStyle,
  hasActiveFilters, activeFilterCount, hostInviteUrl,
  CATALOG_PAGE_SIZE, COACH_PAGE_SIZE,
  type DiscoverFilters, type DiscoverKind, type DiscoverSort, type CatalogItem, type CoachItem,
} from '@/lib/discovery';
import { toast } from 'sonner';

export type DiscoverTab = 'events' | 'resources' | 'coaches';

export type DiscoverSearch = {
  tab?: DiscoverTab | undefined;
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
const TAB_KINDS: Record<DiscoverTab, DiscoverKind[] | undefined> = {
  events: ['event'],
  resources: ['course', 'download', 'membership'],
  coaches: undefined,
};

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

function focalPoint(focal: string | null): { x: number; y: number } {
  const [a, b] = clampFocal(focal).split(' ');
  return { x: Number((a ?? '50%').replace('%', '')) / 100, y: Number((b ?? '50%').replace('%', '')) / 100 };
}

/** Uploaded cover when one signed, otherwise a deterministic branded gradient with the first letter — never a broken image. */
function CardMedia({ title, alt, style, focal, url, category, event = false, className = '' }: {
  title: string; alt: string | null; style: number; focal: string | null; url: MediaSrc; category?: string | null; event?: boolean; className?: string;
}) {
  const label = alt?.trim() || title;
  if (url) return <BrandImage src={url} alt={label} aspect={16 / 9} focal={focalPoint(focal)} sizes="(min-width: 1024px) 360px, 90vw" className={`catalog-card-media ${className}`.trim()} />;
  if (event) return <BrandImage slot={eventPhotoSlot(category)} fallbackSlot="hero_card_1" alt={label} aspect={16 / 9} sizes="(min-width: 1024px) 360px, 90vw" className={`catalog-card-media ${className}`.trim()} />;
  return <span className={`catalog-card-media catalog-card-fallback ${className}`.trim()} style={{ backgroundImage: coverStyleAt(style) }} role="img" aria-label={label}>
    <span className="catalog-card-letter" aria-hidden="true">{(title.trim()[0] ?? 'Z').toUpperCase()}</span>
  </span>;
}

function CatalogCard({ item, lang, coverUrl }: { item: CatalogItem; lang: string; coverUrl: MediaSrc }) {
  const { t } = useTranslation();
  const when = item.starts_at ? new Intl.DateTimeFormat(lang === 'es' ? 'es' : 'en', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: item.timezone || undefined }).format(new Date(item.starts_at)) : null;
  return <li className="gw-card catalog-card">
    <Link to={item.kind === 'event' ? '/e/$id' : '/o/$id'} params={{ id: item.id }} className="catalog-card-main">
      <CardMedia event={item.kind === 'event'} category={item.category} title={item.title} alt={item.cover_alt} style={fallbackCoverStyle(item.id, item.cover_style)} focal={item.cover_focal} url={coverUrl} />
      <span className="catalog-card-body">
        <span className="chip">{t(`discover.kind.${item.kind}`)}</span>
        <strong>{item.title}</strong>
        {item.summary && <small className="catalog-summary">{item.summary}</small>}
        <small className="catalog-meta">
          {when ? `${when} · ` : ''}{item.format === 'online' ? t('discover.online') : item.location_name ?? t('discover.online')}
          {item.distance_km != null ? ` · ${t('discover.kmAway', { km: Math.round(item.distance_km) })}` : ''}
        </small>
        <small className="catalog-meta">{item.price_cents ? t('discover.paid') : t('discover.free')}{item.host_name ? ` · ${displayTitleCase(item.host_name)}` : ''}</small>
      </span>
    </Link>
    <SaveButton kind={item.kind === 'event' ? 'event' : 'offer'} targetId={item.id} />
  </li>;
}

function CoachCard({ coach, coverUrl, avatarUrl }: { coach: CoachItem; coverUrl: MediaSrc; avatarUrl: MediaSrc }) {
  const { t } = useTranslation();
  const name = displayTitleCase(coach.name?.trim()) || coach.slug;
  return <li className="gw-card catalog-card coach-card">
    <Link to="/h/$slug" params={{ slug: coach.slug }} className="catalog-card-main">
      <CardMedia title={name} alt={null} style={fallbackCoverStyle(coach.id, null)} focal={null} url={coverUrl} />
      <span className="catalog-card-body">
        <span className="coach-card-id">
          {avatarUrl
            ? <BrandImage src={avatarUrl} alt="" aspect={1} sizes="44px" className="coach-card-avatar" />
            : <span className="coach-card-avatar coach-card-initial" aria-hidden="true">{name[0]?.toUpperCase()}</span>}
          <span className="coach-card-names">
            <strong>{name}</strong>
            {coach.org && <small className="catalog-meta">{coach.org}</small>}
          </span>
        </span>
        {coach.city && <small className="catalog-meta">{displayTitleCase(coach.city)}</small>}
        {coach.categories.length > 0 && <span className="chip-row coach-card-cats">{coach.categories.slice(0, 3).map(c => <span key={c} className="chip chip-static">{t(`landing.cat.${c}`, { defaultValue: c })}</span>)}</span>}
        {coach.bio && <small className="catalog-summary">{coach.bio}</small>}
        <small className="catalog-meta coach-card-counts">
          {coach.upcoming_count > 0 && <span>{t('discover.upcomingCount', { count: coach.upcoming_count })}</span>}
          {coach.upcoming_count > 0 && coach.offerings_count > 0 && <span aria-hidden="true"> · </span>}
          {coach.offerings_count > 0 && <span>{t('discover.offeringsCount', { count: coach.offerings_count })}</span>}
          {coach.upcoming_count === 0 && coach.offerings_count === 0 && <span>{t('discover.newCoach')}</span>}
        </small>
      </span>
    </Link>
  </li>;
}

export function DiscoverPage({ search }: { search: DiscoverSearch }) {
  const { t, i18n } = useTranslation();
  const signedIn = usePublicSession();
  const navigate = useNavigate({ from: '/discover' });
  const lang = i18n.resolvedLanguage === 'es' ? 'es' : 'en';
  const tab: DiscoverTab = search.tab ?? 'events';
  const [near, setNear] = useState<Coords | null>(null);
  const spaces = useQuery({ ...publicLocationsQuery(), enabled: search.space === 1 && tab === 'events' });
  const filters = useMemo(() => searchToFilters(search, near), [search, near]);
  // Tabs set the base kind set; explicit kind chips refine within the tab.
  const effectiveFilters = useMemo<DiscoverFilters>(() => ({ ...filters, kinds: filters.kinds ?? TAB_KINDS[tab] }), [filters, tab]);

  const catalog = useInfiniteQuery({
    queryKey: ['discover-catalog', effectiveFilters],
    queryFn: ({ pageParam }) => fetchCatalogPage(effectiveFilters, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => last.length === CATALOG_PAGE_SIZE ? pages.length : undefined,
    staleTime: 60_000,
    enabled: tab !== 'coaches',
  });
  const coaches = useInfiniteQuery({
    queryKey: ['discover-coaches', filters.q ?? '', filters.cat ?? ''],
    queryFn: ({ pageParam }) => fetchCoachesPage(filters.q, filters.cat, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => last.length === COACH_PAGE_SIZE ? pages.length : undefined,
    staleTime: 60_000,
    enabled: tab === 'coaches',
  });

  const items = useMemo(() => catalog.data?.pages.flat() ?? [], [catalog.data]);
  const coachList = useMemo(() => coaches.data?.pages.flat() ?? [], [coaches.data]);

  // Batch-sign card images; the server re-validates that every ref is public.
  const refs = useMemo(() => coverRefsFor(items, coachList), [items, coachList]);
  const covers = useQuery({
    queryKey: ['public-covers', refs.map(r => `${r.kind}:${r.id}`).join('|')],
    queryFn: () => publicCovers({ data: { refs } }),
    enabled: refs.length > 0,
    staleTime: 50 * 60_000,
  });
  const coverMap = covers.data ?? {};
  const coverFor = (item: CatalogItem) => coverMap[`${item.kind === 'event' ? 'event' : 'offer'}:${item.id}`];

  const set = (patch: Partial<DiscoverSearch>) => void navigate({ search: (prev: DiscoverSearch) => ({ ...prev, ...patch }), replace: true });
  const setTab = (next: DiscoverTab) => void navigate({ search: (prev: DiscoverSearch) => ({ ...prev, tab: next === 'events' ? undefined : next, kind: undefined }), replace: true });
  const clearAll = () => void navigate({ search: tab === 'events' ? {} : { tab }, replace: true });
  // Same invite-a-host action as the homepage empty state: opaque token when signed in, plain origin otherwise.
  const shareInvite = async () => {
    const url = await hostInviteUrl(window.location.origin);
    try {
      if (navigator.share) { await navigator.share({ title: t('home.explore.inviteTitle'), text: t('home.explore.inviteText'), url }); return; }
      await navigator.clipboard.writeText(url); toast.success(t('home.explore.inviteCopied'));
    } catch { /* user dismissed share sheet */ }
  };
  const localCount = items.filter(d => d.kind === 'event' && d.format !== 'online').length;
  const onlineCount = items.length - localCount;
  const kinds = filters.kinds ?? [];

  const TABS: { id: DiscoverTab; label: string }[] = [
    { id: 'events', label: t('discover.tabEvents') },
    { id: 'resources', label: t('discover.tabResources') },
    { id: 'coaches', label: t('discover.tabCoaches') },
  ];

  return <LandingFrame>
    <main className="gw-discover">
      <section className="gw-container gw-discover-head">
        <span className="gw-label">{t('landing.discover.label')}</span>
        <h1 className="gw-display gw-h1">{t('landing.discover.title')}</h1>
        <p className="gw-lede">{t(signedIn === true ? 'landing.discover.signedInSub' : 'landing.discover.sub')}</p>
        <div className="gw-discover-ctas">
          {signedIn === false && <Link to="/login" className="gw-btn gw-btn-primary">{t('discover.joinCta')}</Link>}
          {signedIn === true && <Link to="/home" className="gw-btn gw-btn-primary">{t('landing.nav.goToApp')}</Link>}
          <Link to="/login" search={{ intent: 'host' }} className="gw-btn gw-btn-secondary">{t('discover.hostCta')}</Link>
        </div>
      </section>

      <nav className="gw-container gw-discover-tabs" aria-label={t('discover.tabsLabel')}>
        {TABS.map(tb => <button key={tb.id} type="button" className={`gw-discover-tab${tab === tb.id ? ' is-active' : ''}`} aria-pressed={tab === tb.id} onClick={() => setTab(tb.id)}>{tb.label}</button>)}
      </nav>

      <section className="gw-container gw-discover-filters" aria-label={t('discover.filters')}>
        <div className="catalog-search">
          <GwIcon name="Search" size={18} />
          <input type="search" className="catalog-search-input" defaultValue={search.q ?? ''} placeholder={tab === 'coaches' ? t('discover.coachSearchPlaceholder') : t('discover.searchPlaceholder')} aria-label={tab === 'coaches' ? t('discover.coachSearchPlaceholder') : t('discover.searchPlaceholder')}
            onKeyDown={e => { if (e.key === 'Enter') set({ q: (e.target as HTMLInputElement).value || undefined }); }}
            onBlur={e => { if ((e.target.value || undefined) !== search.q) set({ q: e.target.value || undefined }); }} />
        </div>
        {tab !== 'coaches' && <div className="chip-row" role="group" aria-label={t('discover.typeLabel')}>
          {(tab === 'events' ? (['event'] as DiscoverKind[]) : (['course', 'download', 'membership'] as DiscoverKind[])).map(k => <button key={k} type="button" className={`chip${kinds.includes(k) ? ' selected' : ''}`} aria-pressed={kinds.includes(k)}
            onClick={() => set({ kind: kinds.includes(k) ? (kinds.filter(x => x !== k).join(',') || undefined) : [...kinds, k].join(',') })}>{t(`discover.kind.${k}`)}</button>)}
        </div>}
        <CategoryRow selected={search.cat ?? null} onSelect={c => set({ cat: c ?? undefined })} />
        {tab === 'events' ? (
          <div className="chip-row" role="group" aria-label={t('discover.formatLabel')}>
            {(['person', 'online', 'hybrid'] as const).map(f => <button key={f} type="button" className={`chip${search.format === f ? ' selected' : ''}`} aria-pressed={search.format === f} onClick={() => set({ format: search.format === f ? undefined : f })}>{t(`discover.format.${f}`)}</button>)}
            <button type="button" className={`chip${search.lang === 'es' ? ' selected' : ''}`} aria-pressed={search.lang === 'es'} onClick={() => set({ lang: search.lang === 'es' ? undefined : 'es' })}>{t('discover.spanish')}</button>
            <button type="button" className={`chip${search.access === 1 ? ' selected' : ''}`} aria-pressed={search.access === 1} onClick={() => set({ access: search.access === 1 ? undefined : 1 })}>{t('discover.accessible')}</button>
            <button type="button" className={`chip${search.minors === 1 ? ' selected' : ''}`} aria-pressed={search.minors === 1} onClick={() => set({ minors: search.minors === 1 ? undefined : 1 })}>{t('discover.family')}</button>
          </div>
        ) : null}
        {tab === 'events' ? (
          <div className="chip-row catalog-dates" role="group" aria-label={t('discover.datesLabel')}>
            <label className="catalog-date"><span>{t('discover.from')}</span><input type="date" value={search.from ?? ''} onChange={e => set({ from: e.target.value || undefined })} /></label>
            <label className="catalog-date"><span>{t('discover.to')}</span><input type="date" value={search.to ?? ''} onChange={e => set({ to: e.target.value || undefined })} /></label>
          </div>
        ) : null}
        {tab === 'events' ? (
          <LocationFilter near={near} onNear={c => { setNear(c); if (c) set({ lat: c.lat, lng: c.lng, r: search.r ?? 50 }); else set({ lat: undefined, lng: undefined, place: undefined }); }} autoAsk={search.near === 1} />
        ) : null}
        {tab === 'events' && filters.near ? (
          <div className="chip-row" role="group" aria-label={t('discover.radiusLabel')}>
            {[25, 50, 100].map(r => <button key={r} type="button" className={`chip${(search.r ?? 50) === r ? ' selected' : ''}`} aria-pressed={(search.r ?? 50) === r} onClick={() => set({ r })}>{t('discover.km', { km: r })}</button>)}
          </div>
        ) : null}
        {tab !== 'coaches' && <div className="chip-row" role="group" aria-label={t('discover.sortLabel')}>
          <button type="button" className={`chip${search.free === 1 ? ' selected' : ''}`} aria-pressed={search.free === 1} onClick={() => set({ free: search.free === 1 ? undefined : 1 })}>{t('discover.free')}</button>
          <button type="button" className={`chip${search.free === 0 ? ' selected' : ''}`} aria-pressed={search.free === 0} onClick={() => set({ free: search.free === 0 ? undefined : 0 })}>{t('discover.paid')}</button>
          {(['soonest', 'newest', 'relevant'] as const).map(s => <button key={s} type="button" className={`chip${(search.sort ?? 'soonest') === s ? ' selected' : ''}`} aria-pressed={(search.sort ?? 'soonest') === s} onClick={() => set({ sort: s })}>{t(`discover.sort.${s}`)}</button>)}
          {tab === 'events' && <button type="button" className={`chip gw-space-chip${search.space === 1 ? ' selected' : ''}`} aria-pressed={search.space === 1} onClick={() => set({ space: search.space === 1 ? undefined : 1 })}>{t('locations.hasSpace')}</button>}
        </div>}
        {hasActiveFilters(filters) && <div className="chip-row">
          <span className="gw-fine" role="status">{t('discover.activeFilters', { count: activeFilterCount(filters) })}</span>
          <button type="button" className="chip" onClick={clearAll}>{t('discover.clearAll')}</button>
        </div>}
      </section>

      {tab === 'events' && search.space === 1 && <section className="gw-container gw-section-tight" aria-label={t('locations.spacesTitle')}>
        <h2 className="gw-h3">{t('locations.spacesTitle')}</h2>
        {spaces.isLoading ? <ListSkeleton rows={2} /> : spaces.isError ? <RetryState retry={() => void spaces.refetch()} /> : spaces.data?.length
          ? <div className="loc-card-list">{spaces.data.map(l => <LocationCard key={l.id} l={l} />)}</div> : <div className="gw-empty"><p>{t('locations.noSpaces')}</p></div>}
      </section>}

      {tab !== 'coaches' && search.space !== 1 && <section className="gw-container gw-section-tight" aria-live="polite">
        <h2 className="gw-h3 gw-discover-section-title">{tab === 'events' ? t('discover.eventsTitle') : t('discover.resourcesTitle')}</h2>
        {catalog.isLoading && <ListSkeleton />}
        {catalog.error && <RetryState retry={() => void catalog.refetch()} />}
        {!catalog.isLoading && !catalog.error && <p className="gw-fine" role="status">{t('discover.count', { count: items.length })}</p>}
        {!catalog.isLoading && !catalog.error && items.length > 0 && <>
          <ul className="gw-grid catalog-grid">{items.map(item => <CatalogCard key={`${item.kind}:${item.id}`} item={item} lang={lang} coverUrl={coverFor(item)} />)}</ul>
          {catalog.hasNextPage && <div className="gw-discover-more">
            <button type="button" className="gw-btn gw-btn-secondary" disabled={catalog.isFetchingNextPage} onClick={() => void catalog.fetchNextPage()}>{catalog.isFetchingNextPage ? t('discover.loadingMore') : t('discover.loadMore')}</button>
          </div>}
        </>}
        {!catalog.isLoading && !catalog.error && items.length === 0 && <div className="gw-empty">
          <p><strong>{filters.near ? t('discover.emptyLocal') : t('discover.empty')}</strong></p>
          <div className="gw-empty-actions">
            {hasActiveFilters(filters) && <button type="button" className="gw-btn gw-btn-secondary" onClick={clearAll}>{t('discover.clearAll')}</button>}
            <Link to="/login" search={{ intent: 'host' }} className="gw-btn gw-btn-primary">{t('discover.createInArea')}</Link>
            <Link to="/alerts" className="gw-btn gw-btn-secondary">{t('discover.notifyMe')}</Link>
            <button type="button" className="gw-btn gw-btn-secondary" onClick={() => void shareInvite()}>{t('discover.inviteHost')}</button>
          </div>
        </div>}
        {!catalog.isLoading && !catalog.error && filters.near && localCount === 0 && onlineCount > 0 && <p className="gw-fine">{t('discover.onlineInstead')}</p>}
      </section>}

      {tab === 'coaches' && <section className="gw-container gw-section-tight" aria-live="polite">
        <h2 className="gw-h3 gw-discover-section-title">{t('discover.coachesTitle')}</h2>
        <p className="gw-fine">{t('discover.coachesSub')}</p>
        {coaches.isLoading && <ListSkeleton />}
        {coaches.error && <RetryState retry={() => void coaches.refetch()} />}
        {!coaches.isLoading && !coaches.error && <p className="gw-fine" role="status">{t('discover.coachCount', { count: coachList.length })}</p>}
        {!coaches.isLoading && !coaches.error && coachList.length > 0 && <>
          <ul className="gw-grid catalog-grid">{coachList.map(c => <CoachCard key={c.id} coach={c} coverUrl={coverMap[`host:${c.id}`]} avatarUrl={coverMap[`host:${c.id}:avatar`]} />)}</ul>
          {coaches.hasNextPage && <div className="gw-discover-more">
            <button type="button" className="gw-btn gw-btn-secondary" disabled={coaches.isFetchingNextPage} onClick={() => void coaches.fetchNextPage()}>{coaches.isFetchingNextPage ? t('discover.loadingMore') : t('discover.loadMore')}</button>
          </div>}
        </>}
        {!coaches.isLoading && !coaches.error && coachList.length === 0 && <div className="gw-empty">
          <p><strong>{t('discover.coachEmpty')}</strong></p>
          <div className="gw-empty-actions">
            {hasActiveFilters(filters) && <button type="button" className="gw-btn gw-btn-secondary" onClick={clearAll}>{t('discover.clearAll')}</button>}
            <Link to="/login" search={{ intent: 'host' }} className="gw-btn gw-btn-primary">{t('discover.coachEmptyCta')}</Link>
            <button type="button" className="gw-btn gw-btn-secondary" onClick={() => void shareInvite()}>{t('discover.inviteHost')}</button>
          </div>
        </div>}
      </section>}
    </main>
  </LandingFrame>;
}

export { isCategory };
