import { describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => {
    const builder = {
      middleware: () => builder,
      inputValidator: () => builder,
      handler: (handler: unknown) => handler,
    };
    return builder;
  },
}));
vi.mock('@/integrations/supabase/auth-middleware', () => ({ requireSupabaseAuth: {} }));

import { getAdminAccess } from './admin.functions';

const check = getAdminAccess as unknown as (input: {
  context: { userId: string; supabase: { rpc: ReturnType<typeof vi.fn> } };
}) => Promise<{ admin: boolean }>;

describe('Admin sign-in access', () => {
  it('allows an existing server-validated administrator', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    expect(await check({ context: { userId: 'existing-admin', supabase: { rpc } } })).toEqual({ admin: true });
    expect(rpc).toHaveBeenCalledWith('has_role', { _user_id: 'existing-admin', _role: 'admin' });
  });

  it('denies a signed-in account without the admin role', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: false, error: null });
    expect(await check({ context: { userId: 'regular-user', supabase: { rpc } } })).toEqual({ admin: false });
  });
});