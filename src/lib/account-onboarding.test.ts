import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

const maybeSingle = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }) },
}));

import { markProfileOnboarded, profileQuery } from './account';

describe('Onboarding completion cache', () => {
  it('replaces a stale pre-confirmation profile with the fresh confirmed row', async () => {
    const confirmed = { id: 'u1', onboarded: false, adult_confirmed_at: '2026-10-25T17:00:00Z' };
    maybeSingle.mockResolvedValue({ data: confirmed, error: null });
    const client = new QueryClient();
    // Stale row from before the 18+ confirmation: no adult_confirmed_at.
    client.setQueryData(profileQuery('u1').queryKey, { id: 'u1', onboarded: false, adult_confirmed_at: null });
    await markProfileOnboarded(client, 'u1');
    expect(client.getQueryData(profileQuery('u1').queryKey)).toEqual({ ...confirmed, onboarded: true });
  });

  it('keeps the original confirmation timestamp on repeat finishes (idempotent)', async () => {
    const confirmed = { id: 'u2', onboarded: true, adult_confirmed_at: '2026-10-20T09:00:00Z' };
    maybeSingle.mockResolvedValue({ data: confirmed, error: null });
    const client = new QueryClient();
    await markProfileOnboarded(client, 'u2');
    const cached = client.getQueryData<{ adult_confirmed_at: string }>(profileQuery('u2').queryKey);
    expect(cached?.adult_confirmed_at).toBe('2026-10-20T09:00:00Z');
  });
});
