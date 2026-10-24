import { createFileRoute } from '@tanstack/react-router';
import { TeamInvitePage } from '@/components/workspace-settings';
import { GuestShell } from '@/components/guest-shell';
import i18n from '@/lib/i18n';

export const Route = createFileRoute('/invite/team/$token')({
  head: () => ({ meta: [{ title: `${i18n.t('workspace.acceptTitle')} · ${i18n.t('brand')}` }, { name: 'robots', content: 'noindex,nofollow' }] }),
  component: function Page() { const { token } = Route.useParams(); return <GuestShell><TeamInvitePage token={token} /></GuestShell>; },
});
