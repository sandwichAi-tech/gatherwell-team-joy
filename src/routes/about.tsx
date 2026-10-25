import { createFileRoute } from '@tanstack/react-router';
import { AboutPage } from '@/components/landing/about-pages';
import { RetryState } from '@/components/launch-states';
import i18n from '@/lib/i18n';
import { publicIndexing } from '@/lib/seo';

export const Route = createFileRoute('/about')({
  head: () => {
    const indexing = publicIndexing('/about');
    const title = `${i18n.t('marketing.about.metaTitle')} · ${i18n.t('brand')}`;
    const description = i18n.t('marketing.about.metaDesc');
    return { meta: [{ title }, { name: 'description', content: description }, { property: 'og:title', content: title }, { property: 'og:description', content: description }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, ...indexing.meta], links: indexing.links };
  },
  component: AboutPage,
  errorComponent: ({ reset }) => <RetryState retry={reset} />,
});
