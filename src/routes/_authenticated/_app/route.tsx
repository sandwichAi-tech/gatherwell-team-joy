import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { GatherwellShell } from '@/components/gatherwell-shell';
import { pendingInvite, profileQuery } from '@/lib/account';
import { guestEventRedirect } from '@/lib/event-invite';

export const Route = createFileRoute('/_authenticated/_app')({
  beforeLoad: async ({ context, location }) => {
    const profile = await context.queryClient.ensureQueryData(profileQuery(context.user.id));
    if (!profile?.onboarded || !profile.adult_confirmed_at || pendingInvite()) {
      // Event links go to event signup, never team onboarding (no team code for customers).
      const guest = guestEventRedirect(location.pathname, location.searchStr ?? '');
      if (guest) throw redirect({ href: guest });
      throw redirect({ to: '/onboarding' });
    }
  },
  component: AppLayout,
});

function AppLayout() {
  const { user } = Route.useRouteContext();
  return <GatherwellShell userId={user.id}><Outlet /></GatherwellShell>;
}
