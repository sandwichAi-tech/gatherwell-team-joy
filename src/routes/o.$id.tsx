import { createFileRoute } from '@tanstack/react-router';
import { PublicOfferPage } from '@/components/public-offer';
import { publicOfferQuery } from '@/lib/content';
import { isUuid, prefetchPublic } from '@/lib/guest';
import { offerTitle } from '@/lib/offers';
import i18n from '@/lib/i18n';

export const Route = createFileRoute('/o/$id')({
  loader: async ({ params, context }) => {
    if (!isUuid(params.id)) return null;
    await prefetchPublic(context.queryClient, publicOfferQuery(params.id));
    return null;
  },
  head: ({ params }) => {
    const brand = i18n.t('brand');
    const cached = isUuid(params.id) ? (publicOfferQuery(params.id) && null) : null;
    void cached;
    const title = `${i18n.t('content.metaFallback')} · ${brand}`;
    return {
      meta: [
        { title },
        { name: 'description', content: i18n.t('content.metaFallbackText') },
        { property: 'og:title', content: title },
        { property: 'og:description', content: i18n.t('content.metaFallbackText') },
        { property: 'og:type', content: 'website' },
        { name: 'twitter:card', content: 'summary' },
      ],
    };
  },
  component: function PublicOfferRoute() {
    const { id } = Route.useParams();
    return <PublicOfferPage id={id} />;
  },
});

void offerTitle;
