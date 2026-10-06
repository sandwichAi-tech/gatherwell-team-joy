import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { ListSkeleton } from '@/components/launch-states';

export const Route = createFileRoute('/_authenticated')({
  ssr: false,
  pendingComponent: ListSkeleton,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: '/login' });
    return { user: data.user };
  },
  component: () => <Outlet />,
});
