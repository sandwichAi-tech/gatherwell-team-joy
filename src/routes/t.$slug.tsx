import { createFileRoute } from '@tanstack/react-router';
import { pageQuery } from '@/components/follow';
import { prefetchPublic } from '@/lib/guest';
import i18n from '@/lib/i18n';
import { publicShareImage } from '@/lib/public-media.functions';
import { GuestShell } from '@/components/guest-shell';
import { FollowPage } from '@/components/follow';
import { RetryState } from '@/components/launch-states';
import { publicIndexing } from '@/lib/seo';

export const Route = createFileRoute('/t/$slug')({
  loader: async ({ context, params }) => {
    await prefetchPublic(context.queryClient, pageQuery('team', params.slug));
    const d = context.queryClient.getQueryData(pageQuery('team', params.slug).queryKey) as { name?: string } | undefined;
    const image = await publicShareImage({ data: { slot: 'og_share_image' } }).catch(() => null);
    return { name: d?.name ?? null, image };
  },
  head: ({ loaderData, params }) => {
    const title = loaderData?.name ? `${loaderData.name} · ${i18n.t('brand')}` : `${i18n.t('follow.meta.teamTitle')} · ${i18n.t('brand')}`;
    const description = i18n.t('follow.meta.team');
    const indexing = publicIndexing(`/t/${params.slug}`);
    return { meta: [{ title }, { name: 'description', content: description }, { property: 'og:title', content: title }, { property: 'og:description', content: description }, { property: 'og:type', content: 'profile' }, { name: 'twitter:card', content: loaderData?.image ? 'summary_large_image' : 'summary' }, ...indexing.meta, ...(loaderData?.image ? [{ property: 'og:image', content: loaderData.image }, { name: 'twitter:image', content: loaderData.image }] : [])], links: indexing.links };
  },
  errorComponent: ({ reset }) => <GuestShell><RetryState retry={reset} /></GuestShell>,
  component: function Page() { const { slug } = Route.useParams(); return <GuestShell><FollowPage kind="team" slug={slug} /></GuestShell>; },
});
