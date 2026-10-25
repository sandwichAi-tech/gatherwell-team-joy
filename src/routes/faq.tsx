import { createFileRoute } from '@tanstack/react-router';
import { FaqPage } from '@/components/landing/faq-page';
import { buildFaqJsonLd } from '@/lib/faq';
import en from '@/locales/en.json';

// The public FAQ server-renders in English, so the FAQPage schema is built from the
// English locale — it always matches the SSR'd content. This is the only FAQPage
// schema on the site (pricing/hosts FAQs carry none), so there is no duplication.
export const Route = createFileRoute('/faq')({
  head: () => ({
    meta: [
      { title: en.faqPage.meta.title },
      { name: 'description', content: en.faqPage.meta.description },
      { property: 'og:title', content: en.faqPage.meta.title },
      { property: 'og:description', content: en.faqPage.meta.description },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: 'https://zoheewell.com/faq' },
      { name: 'twitter:card', content: 'summary' },
    ],
    links: [{ rel: 'canonical', href: 'https://zoheewell.com/faq' }],
    scripts: [{ type: 'application/ld+json', children: JSON.stringify(buildFaqJsonLd(en)) }],
  }),
  component: FaqPage,
});
