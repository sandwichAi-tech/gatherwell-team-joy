import { createFileRoute } from '@tanstack/react-router';
import { DiscoverPage, type DiscoverSearch } from '@/components/landing/discover-page';
import { isCategory } from '@/lib/landing';
import i18n from '@/lib/i18n';

export const Route = createFileRoute('/discover')({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): DiscoverSearch => ({
    ...(isCategory(s['cat']) ? { cat: s['cat'] } : {}),
    ...(s['when'] === 'today' || s['when'] === 'weekend' || s['when'] === 'week' ? { when: s['when'] } : {}),
    ...(s['near'] === 1 || s['near'] === '1' ? { near: 1 as const } : {}),
  }),
  head: () => {
    const title = i18n.t('landing.meta.discoverTitle');
    const description = i18n.t('landing.meta.discover');
    return { meta: [{ title }, { name: 'description', content: description }, { property: 'og:title', content: title }, { property: 'og:description', content: description }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' }] };
  },
  component: function Discover() { return <DiscoverPage search={Route.useSearch()} />; },
});
