import { createFileRoute } from '@tanstack/react-router';
import { HostsPage } from '@/components/landing/marketing-pages';
import { RetryState } from '@/components/launch-states';
import i18n from '@/lib/i18n';
import { publicIndexing } from '@/lib/seo';

export const Route = createFileRoute('/hosts')({
  head: () => {
    const indexing = publicIndexing('/hosts');
    return { meta: [{ title: i18n.t('marketing.hostsMeta') }, { name: 'description', content: i18n.t('marketing.hostsSub') }, { property: 'og:title', content: i18n.t('marketing.hostsMeta') }, { property: 'og:description', content: i18n.t('marketing.hostsSub') }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, ...indexing.meta], links: indexing.links };
  },
  component: HostsPage,
  errorComponent: ({ reset }) => <RetryState retry={reset} />,
});
