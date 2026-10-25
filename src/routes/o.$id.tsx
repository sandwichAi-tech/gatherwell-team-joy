import { createFileRoute } from '@tanstack/react-router';
import { PublicOfferPage } from '@/components/public-offer';
import { publicOfferQuery } from '@/lib/content';
import { isUuid, prefetchPublic } from '@/lib/guest';
import i18n from '@/lib/i18n';
import { publicIndexing } from '@/lib/seo';

export const Route = createFileRoute('/o/$id')({
  loader: async ({ params, context }) => {
    if (!isUuid(params.id)) return null;
    await prefetchPublic(context.queryClient, publicOfferQuery(params.id));
    return null;
  },
  head: ({ params }) => {
    const brand = i18n.t('brand');
    const title = `${i18n.t('content.metaFallback')} · ${brand}`;
    const indexing = publicIndexing(`/o/${params.id}`);
    return {
      meta: [
        { title },
        { name: 'description', content: i18n.t('content.metaFallbackText') },
        { property: 'og:title', content: title },
        { property: 'og:description', content: i18n.t('content.metaFallbackText') },
        { property: 'og:type', content: 'website' },
        { name: 'twitter:card', content: 'summary' },
        ...indexing.meta,
      ],
      links: indexing.links,
    };
  },
  component: function PublicOfferRoute() {
    const { id } = Route.useParams();
    return <PublicOfferPage id={id} />;
  },
});
