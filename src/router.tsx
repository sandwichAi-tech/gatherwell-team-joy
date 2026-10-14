import { QueryClient, dehydrate, hydrate, type DehydratedState } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { ListSkeleton } from '@/components/launch-states';

export const getRouter = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultPendingMs: 200,
    defaultPendingComponent: ListSkeleton,
    // Public pages prefetch into the query cache on the server; ship that cache with the HTML.
    dehydrate: () => ({ queryState: JSON.stringify(dehydrate(queryClient)) }),
    hydrate: (d: { queryState: string }) => { hydrate(queryClient, JSON.parse(d.queryState) as DehydratedState); },
  });

  return router;
};
