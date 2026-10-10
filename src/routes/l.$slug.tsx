import { createFileRoute } from '@tanstack/react-router';
import i18n from '@/lib/i18n';
import { GuestShell } from '@/components/guest-shell';
import { LocationPublicPage } from '@/components/locations';
import { RetryState } from '@/components/launch-states';

export const Route = createFileRoute('/l/$slug')({
  head: () => {
    const title = `${i18n.t('locations.metaTitle')} · ${i18n.t('brand')}`;
    const description = i18n.t('locations.metaDescription');
    return { meta: [{ title }, { name: 'description', content: description }, { property: 'og:title', content: title }, { property: 'og:description', content: description }, { property: 'og:type', content: 'place' }, { name: 'twitter:card', content: 'summary' }] };
  },
  errorComponent: ({ reset }) => <GuestShell><RetryState retry={reset} /></GuestShell>,
  component: function Page() { const { slug } = Route.useParams(); return <GuestShell><LocationPublicPage slug={slug} /></GuestShell>; },
});
