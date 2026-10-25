import { createFileRoute } from '@tanstack/react-router';
import { StudiosPage } from '@/components/landing/studios-page';
import { RetryState } from '@/components/launch-states';
import i18n from '@/lib/i18n';
import { publicIndexing } from '@/lib/seo';

export const Route = createFileRoute('/studios')({
  head: () => {
    const indexing = publicIndexing('/studios');
    return { meta: [{ title: i18n.t('marketing.studios.meta') }, { name: 'description', content: i18n.t('marketing.studios.metaDesc') }, { property: 'og:title', content: i18n.t('marketing.studios.meta') }, { property: 'og:description', content: i18n.t('marketing.studios.metaDesc') }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, ...indexing.meta], links: indexing.links };
  },
  component: StudiosPage,
  errorComponent: ({ reset }) => <RetryState retry={reset} />,
});
