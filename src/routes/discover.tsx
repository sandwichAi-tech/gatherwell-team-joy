import { createFileRoute } from '@tanstack/react-router';
import { DiscoverPage, type DiscoverSearch } from '@/components/landing/discover-page';
import { isCategory } from '@/lib/landing';
import i18n from '@/lib/i18n';
import { publicShareImage } from '@/lib/public-media.functions';
import { RetryState } from '@/components/launch-states';

export const Route = createFileRoute('/discover')({
  loader: () => publicShareImage({ data: { slot: 'og_share_image' } }).catch(() => null),
  validateSearch: (s: Record<string, unknown>): DiscoverSearch => ({
    ...(isCategory(s['cat']) ? { cat: s['cat'] } : {}),
    ...(s['when'] === 'today' || s['when'] === 'weekend' || s['when'] === 'week' ? { when: s['when'] } : {}),
    ...(s['near'] === 1 || s['near'] === '1' ? { near: 1 as const } : {}),
  }),
  head: ({ loaderData }) => {
    const title = i18n.t('landing.meta.discoverTitle');
    const description = i18n.t('landing.meta.discover');
    return { meta: [{ title }, { name: 'description', content: description }, { property: 'og:title', content: title }, { property: 'og:description', content: description }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' }, ...(loaderData ? [{ property: 'og:image', content: loaderData }, { name: 'twitter:image', content: loaderData }] : [])] };
  },
  component: function Discover() { return <DiscoverPage search={Route.useSearch()} />; },
  errorComponent: ({ reset }) => <RetryState retry={reset} />,
  notFoundComponent: () => <DiscoverPage search={{}} />,
});
