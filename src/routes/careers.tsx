import { createFileRoute } from '@tanstack/react-router';
import { CareersPage } from '@/components/landing/about-pages';
import { RetryState } from '@/components/launch-states';
import i18n from '@/lib/i18n';
import { publicIndexing } from '@/lib/seo';

export const Route = createFileRoute('/careers')({
  head: () => {
    const indexing = publicIndexing('/careers');
    const title = `${i18n.t('marketing.careers.metaTitle')} · ${i18n.t('brand')}`;
    const description = i18n.t('marketing.careers.metaDesc');
    return { meta: [{ title }, { name: 'description', content: description }, { property: 'og:title', content: title }, { property: 'og:description', content: description }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, ...indexing.meta], links: indexing.links };
  },
  component: CareersPage,
  errorComponent: ({ reset }) => <RetryState retry={reset} />,
});
