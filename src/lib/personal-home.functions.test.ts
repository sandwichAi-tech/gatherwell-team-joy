import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ context: { userId: 'coach-a', supabase: { rpc: vi.fn() } } }));
vi.mock('@tanstack/react-start', () => ({ createServerFn: () => ({ middleware() { return this; }, handler: (fn: (value: unknown) => unknown) => () => fn({ context: state.context }) }) }));
vi.mock('@/integrations/supabase/auth-middleware', () => ({ requireSupabaseAuth: {} }));
import { getPersonalHome } from './personal-home.functions';
import { personalHomeKey } from './personal-home';
describe('authoritative personal Home boundary', () => {
  beforeEach(() => state.context.supabase.rpc.mockReset());
  it('calls only the identity-free authoritative Home RPC, not a public catalog', async () => {
    const home = { mode: 'hosting', events: [{ id: 'own' }], resources: [], coaches: [], drafts: 1 };
    state.context.supabase.rpc.mockResolvedValue({ data: home, error: null });
    expect(await getPersonalHome()).toEqual(home);
    expect(state.context.supabase.rpc).toHaveBeenCalledExactlyOnceWith('personal_home');
  });
  it('does not fallback to public content on a denied relationship read', async () => {
    state.context.supabase.rpc.mockResolvedValue({ data: null, error: { message: 'denied' } });
    await expect(getPersonalHome()).rejects.toThrow('personal_home_unavailable');
    expect(state.context.supabase.rpc).toHaveBeenCalledTimes(1);
  });
  it('keeps two account caches distinct', () => {
    expect(personalHomeKey('coach-a')).toEqual(['personal-home', 'coach-a']);
    expect(personalHomeKey('customer-b')).not.toEqual(personalHomeKey('coach-a'));
  });
});