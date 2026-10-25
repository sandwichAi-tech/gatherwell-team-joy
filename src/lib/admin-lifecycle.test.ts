import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@tanstack/react-start', () => ({ createServerFn: () => {
  const b = { middleware: () => b, inputValidator: () => b, handler: (h: unknown) => h }; return b;
} }));
vi.mock('@/integrations/supabase/auth-middleware', () => ({ requireSupabaseAuth: {} }));
const db = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), auth: { admin: { getUserById: vi.fn(), updateUserById: vi.fn() } } }));
vi.mock('@/integrations/supabase/client.server', () => ({ supabaseAdmin: db }));
import { adminUserAction, replyAdminTicket, closeAdminTicket, getAdminOverview } from './admin.functions';
type Handler = (args: { data: Record<string, unknown>; context: { userId: string; supabase: { rpc: ReturnType<typeof vi.fn> } } }) => Promise<{ ok: boolean; error?: string }>;
const account = adminUserAction as unknown as Handler;
const reply = replyAdminTicket as unknown as Handler;
const close = closeAdminTicket as unknown as Handler;
const ctx = () => ({ userId: 'actor', supabase: { rpc: vi.fn().mockImplementation((fn: string) => Promise.resolve(fn === 'has_role' ? { data: true } : { error: null })) } });
beforeEach(() => {
  vi.clearAllMocks();
  db.from.mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }) });
  db.auth.admin.getUserById.mockResolvedValue({ data: { user: { id: 'target', email: 'fixture@example.test' } } });
  db.auth.admin.updateUserById.mockResolvedValue({ error: null });
  db.rpc.mockResolvedValue({ error: null });
});
describe('Account and Support lifecycle regressions', () => {
  it('denies non-admin reads before privileged access', async () => {
    const context = { userId: 'member', supabase: { rpc: vi.fn().mockResolvedValue({ data: false, error: null }) } };
    await expect((getAdminOverview as unknown as Handler)({ data: { period: 'week' }, context })).rejects.toThrow('forbidden');
    expect(db.from).not.toHaveBeenCalled(); expect(db.rpc).not.toHaveBeenCalled();
  });
  it('denies non-admin account changes before touching auth or audit', async () => {
    const context = { userId: 'member', supabase: { rpc: vi.fn().mockResolvedValue({ data: false, error: null }) } };
    await expect(account({ data: { userId: 'target', action: 'suspend', reason: 'Not allowed', origin: 'https://zoheewell.com' }, context })).rejects.toThrow('forbidden');
    expect(db.auth.admin.updateUserById).not.toHaveBeenCalled(); expect(db.rpc).not.toHaveBeenCalled();
  });
  const data = { userId: 'target', action: 'suspend', reason: 'Safety verification', origin: 'https://zoheewell.com' };
  it('rejects self-target before touching managed Auth', async () => {
    expect(await account({ data: { ...data, userId: 'actor' }, context: ctx() })).toEqual({ ok: false, error: 'self' });
    expect(db.auth.admin.getUserById).not.toHaveBeenCalled();
  });
  it('rejects missing restriction reason without changing Auth', async () => {
    expect(await account({ data: { ...data, reason: '' }, context: ctx() })).toEqual({ ok: false, error: 'reason_required' });
    expect(db.auth.admin.updateUserById).not.toHaveBeenCalled();
  });
  it('compensates Auth when atomic record/audit fails', async () => {
    db.rpc.mockResolvedValue({ error: { message: 'audit failure' } });
    expect(await account({ data, context: ctx() })).toEqual({ ok: false, error: 'failed' });
    expect(db.auth.admin.updateUserById.mock.calls).toEqual([['target', { ban_duration: '876000h' }], ['target', { ban_duration: 'none' }]]);
  });
  it('surfaces failed compensation instead of claiming success', async () => {
    db.rpc.mockResolvedValue({ error: {} });
    db.auth.admin.updateUserById.mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({ error: {} });
    expect(await account({ data, context: ctx() })).toEqual({ ok: false, error: 'reconciliation_required' });
  });
  it('does not record success when Auth refuses the change', async () => {
    db.auth.admin.updateUserById.mockResolvedValue({ error: {} });
    expect(await account({ data, context: ctx() })).toEqual({ ok: false, error: 'failed' });
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it('Support reply uses the audited transaction without a second audit write', async () => {
    const context = ctx();
    expect(await reply({ data: { ticketId: 'ticket', body: 'Reply' }, context })).toEqual({ ok: true });
    expect(context.supabase.rpc).toHaveBeenCalledWith('reply_support_ticket', { _ticket: 'ticket', _body: 'Reply' });
    expect(db.from).not.toHaveBeenCalled();
  });
  it('Support close uses its idempotent audited transaction', async () => {
    const context = ctx();
    expect(await close({ data: { ticketId: 'ticket' }, context })).toEqual({ ok: true });
    expect(context.supabase.rpc).toHaveBeenCalledWith('close_support_ticket', { _ticket: 'ticket' });
    expect(db.from).not.toHaveBeenCalled();
  });
});