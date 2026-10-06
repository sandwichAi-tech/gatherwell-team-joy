import { createFileRoute } from '@tanstack/react-router';
import i18n from '@/lib/i18n';
import { GuestShell } from '@/components/guest-shell';
import { FollowPage } from '@/components/follow';
import { RetryState } from '@/components/launch-states';

export const Route = createFileRoute('/h/$slug')({
  head: () => {
    const title = `${i18n.t('follow.meta.hostTitle')} · ${i18n.t('brand')}`;
    const description = i18n.t('follow.meta.host');
    return { meta: [{ title }, { name: 'description', content: description }, { property: 'og:title', content: title }, { property: 'og:description', content: description }, { property: 'og:type', content: 'profile' }, { name: 'twitter:card', content: 'summary' }] };
  },
  errorComponent: ({ reset }) => <GuestShell><RetryState retry={reset} /></GuestShell>,
  component: function Page() { const { slug } = Route.useParams(); return <GuestShell><FollowPage kind="host" slug={slug} /></GuestShell>; },
});
