import { createFileRoute, redirect } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { normalizeProfileSlug } from '@/lib/host-slug';
import { pageQuery } from '@/components/follow';
import { prefetchPublic } from '@/lib/guest';
import i18n from '@/lib/i18n';
import { publicShareImage } from '@/lib/public-media.functions';
import { GuestShell } from '@/components/guest-shell';
import { FollowPage } from '@/components/follow';
import { RetryState } from '@/components/launch-states';
import { SITE_URL } from '@/lib/seo';

export const Route = createFileRoute('/h/$slug')({
  loader: async ({ context, params }) => {
    // Old custom URLs keep working: resolve aliases to the canonical slug and redirect.
    const requested = normalizeProfileSlug(params.slug);
    if (requested && requested !== params.slug) {
      throw redirect({ to: '/h/$slug', params: { slug: requested }, replace: true });
    }
    const { data: canonical } = await supabase.rpc('resolve_host_slug', { _slug: params.slug });
    if (canonical && canonical !== params.slug) {
      throw redirect({ to: '/h/$slug', params: { slug: canonical }, replace: true });
    }
    await prefetchPublic(context.queryClient, pageQuery('host', params.slug));
    const d = context.queryClient.getQueryData(pageQuery('host', params.slug).queryKey) as { name?: string; org?: string | null; bio?: string | null; links?: { url: string }[]; coverSrc?: import('@/lib/media-renditions').MediaSrc } | undefined;
    const image = (d?.coverSrc ? (typeof d.coverSrc === 'string' ? d.coverSrc : d.coverSrc.src) : null) ?? await publicShareImage({ data: { slot: 'og_share_image' } }).catch(() => null);
    return { name: d?.name ?? null, org: d?.org ?? null, bio: d?.bio ?? null, links: d?.links ?? [], image };
  },
  head: ({ loaderData, params }) => {
    const title = loaderData?.name ? `${loaderData.name} · ${i18n.t('brand')}` : `${i18n.t('follow.meta.hostTitle')} · ${i18n.t('brand')}`;
    const description = loaderData?.bio ?? i18n.t('follow.meta.host');
    // ProfilePage wrapping Person/Organization JSON-LD from real public fields only — no ratings, no fabricated counts.
    const profileUrl = `${SITE_URL}/h/${params.slug}`;
    const jsonLd = loaderData?.name ? {
      '@context': 'https://schema.org',
      '@type': 'ProfilePage',
      url: profileUrl,
      mainEntity: {
        '@type': loaderData.org ? 'Organization' : 'Person',
        name: loaderData.org ?? loaderData.name,
        ...(loaderData.org ? { founder: { '@type': 'Person', name: loaderData.name } } : {}),
        ...(loaderData.bio ? { description: loaderData.bio } : {}),
        url: profileUrl,
        ...(loaderData.links?.length ? { sameAs: loaderData.links.map(l => l.url) } : {}),
      },
    } : null;
    return {
      meta: [{ title }, { name: 'description', content: description }, { property: 'og:title', content: title }, { property: 'og:description', content: description }, { property: 'og:type', content: 'profile' }, { property: 'og:url', content: profileUrl }, { name: 'twitter:card', content: loaderData?.image ? 'summary_large_image' : 'summary' }, ...(loaderData?.image ? [{ property: 'og:image', content: loaderData.image }, { name: 'twitter:image', content: loaderData.image }] : [])],
      links: [{ rel: 'canonical', href: profileUrl }],
      ...(jsonLd ? { scripts: [{ type: 'application/ld+json', children: JSON.stringify(jsonLd) }] } : {}),
    };
  },
  errorComponent: ({ reset }) => <GuestShell><RetryState retry={reset} /></GuestShell>,
  component: function Page() { const { slug } = Route.useParams(); return <GuestShell><FollowPage kind="host" slug={slug} /></GuestShell>; },
});
