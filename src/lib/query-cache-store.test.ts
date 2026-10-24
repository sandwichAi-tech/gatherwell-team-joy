import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { createQueryCacheRevisionStore } from './query-cache-store';

describe('query cache revision store', () => {
  it('notifies subscribers with a new cached revision and unsubscribes cleanly', () => {
    const queryClient = new QueryClient();
    const store = createQueryCacheRevisionStore(queryClient);
    const onStoreChange = vi.fn();
    const unsubscribe = store.subscribe(onStoreChange);

    expect(store.getSnapshot()).toBe(0);
    queryClient.setQueryData(['qa'], true);
    expect(onStoreChange).toHaveBeenCalledOnce();
    expect(store.getSnapshot()).toBe(1);

    unsubscribe();
    queryClient.setQueryData(['qa'], false);
    expect(onStoreChange).toHaveBeenCalledOnce();
    expect(store.getSnapshot()).toBe(1);
  });
});
