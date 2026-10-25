import { createFileRoute } from '@tanstack/react-router';
import { publicLocationQuery } from '@/components/locations';
import { prefetchPublic } from '@/lib/guest';
import i18n from '@/lib/i18n';
import { publicShareImage } from '@/lib/public-media.functions';
import { publicLocationPhotos } from '@/lib/locations.functions';
import { GuestShell } from '@/components/guest-shell';
import { LocationPublicPage } from '@/components/locations';
import { RetryState } from '@/components/launch-states';

export const Route = createFileRoute('/l/$slug')({
  loader: async ({ context, params }) => {
    await prefetchPublic(context.queryClient, publicLocationQuery(params.slug));
    const d = context.queryClient.getQueryData(publicLocationQuery(params.slug).queryKey) as { name?: string } | undefined;
    const photos = await publicLocationPhotos({ data: { slug: params.slug } }).catch(() => [] as string[]);
    const image = photos[0] ?? await publicShareImage({ data: { slot: 'og_share_image' } }).catch(() => null);
    return { name: d?.name ?? null, image };
  },
  head: ({ loaderData, params }) => {
    const title = loaderData?.name ? `${loaderData.name} · ${i18n.t('brand')}` : `${i18n.t('locations.metaTitle')} · ${i18n.t('brand')}`;
    const description = i18n.t('locations.metaDescription');
    const indexing = publicIndexing(`/l/${params.slug}`);
    return { meta: [{ title }, { name: 'description', content: description }, { property: 'og:title', content: title }, { property: 'og:description', content: description }, { property: 'og:type', content: 'place' }, { name: 'twitter:card', content: loaderData?.image ? 'summary_large_image' : 'summary' }, ...indexing.meta, ...(loaderData?.image ? [{ property: 'og:image', content: loaderData.image }, { name: 'twitter:image', content: loaderData.image }] : [])], links: indexing.links };
  },
  errorComponent: ({ reset }) => <GuestShell><RetryState retry={reset} /></GuestShell>,
  component: function Page() { const { slug } = Route.useParams(); return <GuestShell><LocationPublicPage slug={slug} /></GuestShell>; },
});
