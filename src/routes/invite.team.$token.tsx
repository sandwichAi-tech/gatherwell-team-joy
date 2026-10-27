import { createFileRoute } from '@tanstack/react-router';
import { TeamInvitePage } from '@/components/workspace-settings';
import { GuestShell } from '@/components/guest-shell';
import i18n from '@/lib/i18n';

export const Route = createFileRoute('/invite/team/$token')({
  head: () => { const title = `${i18n.t('teamMembership.request')} · ${i18n.t('brand')}`; const description = i18n.t('teamMembership.pendingHint'); return { meta: [{ title }, { name: 'description', content: description }, { property: 'og:title', content: title }, { property: 'og:description', content: description }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: 'robots', content: 'noindex,nofollow' }] }; },
  component: function Page() { const { token } = Route.useParams(); return <GuestShell><TeamInvitePage token={token} /></GuestShell>; },
});
