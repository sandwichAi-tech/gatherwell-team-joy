import type { QueryClient } from '@tanstack/react-query';

/** External-store adapter for React Query cache updates; safe to subscribe during another component's render. */
export function createQueryCacheRevisionStore(queryClient: QueryClient) {
  let revision = 0;
  return {
    subscribe(onStoreChange: () => void) {
      return queryClient.getQueryCache().subscribe(() => {
        revision += 1;
        onStoreChange();
      });
    },
    getSnapshot() {
      return revision;
    },
  };
}
