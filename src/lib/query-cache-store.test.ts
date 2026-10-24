import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { createQueryCacheRevisionStore } from './query-cache-store';

describe('query cache revision store', () => {
  it('notifies subscribers after the current render stack and unsubscribes cleanly', async () => {
    const queryClient = new QueryClient();
    const store = createQueryCacheRevisionStore(queryClient);
    const onStoreChange = vi.fn();
    const unsubscribe = store.subscribe(onStoreChange);

    expect(store.getSnapshot()).toBe(0);
    queryClient.setQueryData(['qa'], true);
    expect(onStoreChange).not.toHaveBeenCalled();
    await Promise.resolve();
    const callsAfterUpdate = onStoreChange.mock.calls.length;
    const revisionAfterUpdate = store.getSnapshot();
    expect(callsAfterUpdate).toBeGreaterThan(0);
    expect(revisionAfterUpdate).toBeGreaterThan(0);

    unsubscribe();
    queryClient.setQueryData(['qa'], false);
    await Promise.resolve();
    expect(onStoreChange).toHaveBeenCalledTimes(callsAfterUpdate);
    expect(store.getSnapshot()).toBe(revisionAfterUpdate);
  });
});
