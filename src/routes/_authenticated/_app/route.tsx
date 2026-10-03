import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { GatherwellShell } from '@/components/gatherwell-shell';
import { JOIN_CODE_KEY, profileQuery } from '@/lib/account';

export const Route = createFileRoute('/_authenticated/_app')({
  beforeLoad: async ({ context }) => {
    const profile = await context.queryClient.ensureQueryData(profileQuery(context.user.id));
    if (!profile?.onboarded || localStorage.getItem(JOIN_CODE_KEY)) throw redirect({ to: '/onboarding' });
  },
  component: AppLayout,
});

function AppLayout() {
  const { user } = Route.useRouteContext();
  return <GatherwellShell userId={user.id}><Outlet /></GatherwellShell>;
}
