import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

type Ctx = { supabase: { rpc: (fn: 'has_role', args: { _user_id: string; _role: 'admin' }) => PromiseLike<{ data: boolean | null; error?: unknown }> }; userId: string };

/** Admin role re-checked on every call; returns the privileged client only after that. */
async function assertAdmin(context: Ctx) {
  const { data, error } = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'admin' });
  if (error || data !== true) throw new Error('forbidden');
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  return supabaseAdmin;
}
type Ops = typeof import('./qa-lab.server');
const ops = (): Promise<Ops> => import('./qa-lab.server');

/** QA Lab overview: personas (no passwords), counts and suppressed test messages. */
export const getQaLab = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const db = await assertAdmin(context); const { countAll } = await ops();
  const [{ data: reg }, counts, { data: msgs }] = await Promise.all([
    db.from('qa_test_accounts').select('persona, label, email, phone, user_id, created_at').order('created_at'),
    countAll(db),
    db.from('notification_outbox').select('id, channel, template, recipient, created_at').eq('error', 'test_account').order('created_at', { ascending: false }).limit(50),
  ]);
  return { accounts: (reg ?? []).map(r => ({ ...r, hasAccount: !!r.user_id })), counts, suppressed: msgs ?? [] };
});
export type QaCounts = Awaited<ReturnType<Ops['countAll']>>;

/** Creates the ten personas once. Existing personas are left untouched. */
export const seedQaAccounts = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const db = await assertAdmin(context); return (await ops()).seedQa(db, context.userId);
});

/** Owner/admin-only, on demand: one persona's password. Never logged. */
export const revealQaPassword = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ persona: z.string().regex(/^p\d{1,2}$/) }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await assertAdmin(context);
    const { data: row } = await db.from('qa_test_accounts').select('password').eq('persona', data.persona).maybeSingle();
    await (await ops()).audit(db, context.userId, 'qa_reveal_password', { persona: data.persona });
    return { password: row?.password ?? null };
  });

/** Removes every QA-owned row, file and account (including P10's admin role); reports counts before and after. */
export const deleteQaData = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const db = await assertAdmin(context); return (await ops()).deleteQa(db, context.userId);
});
