import { createFileRoute } from '@tanstack/react-router';
import { DiscoverPage, searchToFilters, type DiscoverSearch } from '@/components/landing/discover-page';
import { isCategory } from '@/lib/landing';
import { hasActiveFilters } from '@/lib/discovery';
import i18n from '@/lib/i18n';
import { publicShareImage } from '@/lib/public-media.functions';
import { RetryState } from '@/components/launch-states';

const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
const one = (v: unknown) => (v === 1 || v === '1' ? (1 as const) : undefined);

export const Route = createFileRoute('/discover')({
  // Catalog is fetched client-side; SSR shell stays fast and crawlers get the head tags.
  validateSearch: (s: Record<string, unknown>): DiscoverSearch => ({
    ...(str(s['q']) ? { q: str(s['q']) } : {}),
    ...(str(s['kind']) ? { kind: str(s['kind']) } : {}),
    ...(isCategory(s['cat']) ? { cat: s['cat'] } : {}),
    ...(str(s['from']) ? { from: str(s['from']) } : {}),
    ...(str(s['to']) ? { to: str(s['to']) } : {}),
    ...(s['format'] === 'person' || s['format'] === 'online' || s['format'] === 'hybrid' ? { format: s['format'] } : {}),
    ...(s['free'] === 1 || s['free'] === '1' ? { free: 1 as const } : s['free'] === 0 || s['free'] === '0' ? { free: 0 as const } : {}),
    ...(str(s['lang']) ? { lang: str(s['lang']) } : {}),
    ...(one(s['access']) ? { access: 1 as const } : {}),
    ...(one(s['minors']) ? { minors: 1 as const } : {}),
    ...(one(s['near']) ? { near: 1 as const } : {}),
    ...(typeof s['lat'] === 'number' ? { lat: s['lat'] } : {}),
    ...(typeof s['lng'] === 'number' ? { lng: s['lng'] } : {}),
    ...(typeof s['r'] === 'number' ? { r: s['r'] } : {}),
    ...(str(s['place']) ? { place: str(s['place']) } : {}),
    ...(s['sort'] === 'newest' || s['sort'] === 'relevant' ? { sort: s['sort'] } : {}),
    ...(one(s['space']) ? { space: 1 as const } : {}),
  }),
  head: ({ matches, loaderData }) => {
    const title = i18n.t('landing.meta.discoverTitle');
    const description = i18n.t('landing.meta.discover');
    // Filtered permutations are not indexed; only the clean catalog is.
    const search = (matches.at(-1)?.search ?? {}) as DiscoverSearch;
    const filtered = hasActiveFilters(searchToFilters(search, null)) || !!search.sort;
    return {
      meta: [
        { title }, { name: 'description', content: description },
        { property: 'og:title', content: title }, { property: 'og:description', content: description },
        { property: 'og:type', content: 'website' }, { property: 'og:url', content: 'https://zoheewell.com/discover' },
        { name: 'twitter:card', content: 'summary_large_image' },
        ...(filtered ? [{ name: 'robots', content: 'noindex, follow' }] : []),
        ...(loaderData ? [{ property: 'og:image', content: loaderData }, { name: 'twitter:image', content: loaderData }] : []),
      ],
      links: [{ rel: 'canonical', href: 'https://zoheewell.com/discover' }],
    };
  },
  loader: ({ context: _context }) => publicShareImage({ data: { slot: 'og_share_image' } }).catch(() => null),
  component: function Discover() { return <DiscoverPage search={Route.useSearch()} />; },
  errorComponent: ({ reset }) => <RetryState retry={reset} />,
  notFoundComponent: () => <DiscoverPage search={{}} />,
});
