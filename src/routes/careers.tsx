import { createFileRoute, notFound } from '@tanstack/react-router';
import { featureFlagsQuery } from '@/lib/landing';
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
  // Launch mode: off = the normal 404 (feature_marketing_extra).
  loader: async ({ context }) => { const flags = await context.queryClient.ensureQueryData(featureFlagsQuery()); if (!flags['feature_marketing_extra']?.enabled) throw notFound(); },
  component: CareersPage,
  errorComponent: ({ reset }) => <RetryState retry={reset} />,
});
