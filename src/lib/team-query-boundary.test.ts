import { describe, expect, it, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
const auth = vi.hoisted(() => ({ id: 'ZZ-TEST-A' }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { getUser: async () => ({ data: { user: auth.id ? { id: auth.id } : null }, error: null }) } } }));
import { teamCallerQuery } from './team-query-boundary';
describe('Teams caller response boundaries', () => {
  beforeEach(() => { auth.id = 'ZZ-TEST-A'; });
  it('rejects an RPC response received after account switching, before cache insertion', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await expect(client.fetchQuery({ queryKey: ['my-team-states', 'ZZ-TEST-A'], queryFn: ({ signal }) => teamCallerQuery('ZZ-TEST-A', signal, async () => { auth.id = 'ZZ-TEST-B'; return ['private A']; }) })).rejects.toThrow('identity_changed');
    expect(client.getQueryData(['my-team-states', 'ZZ-TEST-A'])).toBeUndefined();
  });
  it('signed-out and mismatched users cannot start private reads', async () => {
    const read = vi.fn(); auth.id = '';
    await expect(teamCallerQuery('ZZ-TEST-A', new AbortController().signal, read)).rejects.toThrow('identity_changed');
    expect(read).not.toHaveBeenCalled();
  });
  it('rejects aborted late responses', async () => {
    const controller = new AbortController();
    await expect(teamCallerQuery('ZZ-TEST-A', controller.signal, async () => { controller.abort(); return 'private'; })).rejects.toThrow('Aborted');
  });
  it('allows the same authenticated caller', async () => {
    await expect(teamCallerQuery('ZZ-TEST-A', new AbortController().signal, async () => ['Team A'])).resolves.toEqual(['Team A']);
  });
});