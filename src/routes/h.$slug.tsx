import { createFileRoute } from '@tanstack/react-router';
import { pageQuery } from '@/components/follow';
import { prefetchPublic } from '@/lib/guest';
import i18n from '@/lib/i18n';
import { publicShareImage } from '@/lib/public-media.functions';
import { GuestShell } from '@/components/guest-shell';
import { FollowPage } from '@/components/follow';
import { RetryState } from '@/components/launch-states';

export const Route = createFileRoute('/h/$slug')({
  loader: async ({ context, params }) => {
    await prefetchPublic(context.queryClient, pageQuery('host', params.slug));
    const d = context.queryClient.getQueryData(pageQuery('host', params.slug).queryKey) as { name?: string; coverSrc?: string | null } | undefined;
    const image = d?.coverSrc ?? await publicShareImage({ data: { slot: 'og_share_image' } }).catch(() => null);
    return { name: d?.name ?? null, image };
  },
  head: ({ loaderData }) => {
    const title = loaderData?.name ? `${loaderData.name} · ${i18n.t('brand')}` : `${i18n.t('follow.meta.hostTitle')} · ${i18n.t('brand')}`;
    const description = i18n.t('follow.meta.host');
    return { meta: [{ title }, { name: 'description', content: description }, { property: 'og:title', content: title }, { property: 'og:description', content: description }, { property: 'og:type', content: 'profile' }, { name: 'twitter:card', content: loaderData?.image ? 'summary_large_image' : 'summary' }, ...(loaderData?.image ? [{ property: 'og:image', content: loaderData.image }, { name: 'twitter:image', content: loaderData.image }] : [])] };
  },
  errorComponent: ({ reset }) => <GuestShell><RetryState retry={reset} /></GuestShell>,
  component: function Page() { const { slug } = Route.useParams(); return <GuestShell><FollowPage kind="host" slug={slug} /></GuestShell>; },
});
