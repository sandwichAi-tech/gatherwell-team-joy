import { createFileRoute } from '@tanstack/react-router';
import { PricingPage } from '@/components/landing/marketing-pages';
import { RetryState } from '@/components/launch-states';
import i18n from '@/lib/i18n';
import { publicIndexing } from '@/lib/seo';

export const Route = createFileRoute('/pricing')({
  head: () => {
    const indexing = publicIndexing('/pricing');
    return { meta: [{ title: i18n.t('marketing.pricingMeta') }, { name: 'description', content: i18n.t('marketing.pricingSub') }, { property: 'og:title', content: i18n.t('marketing.pricingMeta') }, { property: 'og:description', content: i18n.t('marketing.pricingSub') }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, ...indexing.meta], links: indexing.links };
  },
  component: PricingPage,
  errorComponent: ({ reset }) => <RetryState retry={reset} />,
});
