import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { ListSkeleton } from '@/components/launch-states';
import { safeReturnPath } from '@/lib/return-to';

export const Route = createFileRoute('/_authenticated')({
  ssr: false,
  pendingComponent: ListSkeleton,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: '/login', search: safeReturnPath(location.href) ? { next: location.href } : {} });
    return { user: data.user };
  },
  component: () => <Outlet />,
});
