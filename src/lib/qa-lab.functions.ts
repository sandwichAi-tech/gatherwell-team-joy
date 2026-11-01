import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { QA_PERSONAS, qaEmail, qaName, qaPhone } from './qa-lab';

type Ctx = { supabase: { rpc: (fn: 'has_role', args: { _user_id: string; _role: 'admin' }) => PromiseLike<{ data: boolean | null; error?: unknown }> }; userId: string };

/** Admin role re-checked on every call; returns the privileged client only after that. */
async function assertAdmin(context: Ctx) {
  const { data, error } = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'admin' });
  if (error || data !== true) throw new Error('forbidden');
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  return supabaseAdmin;
}
type Db = Awaited<ReturnType<typeof assertAdmin>>;

const EMAIL_LIKE = 'zz-test+%@example.com';
const PHONES = QA_PERSONAS.map((_, i) => qaPhone(i));

async function audit(db: Db, actor: string, action: string, after: unknown) {
  await db.from('admin_audit').insert({ actor_id: actor, action, target_type: 'qa_lab', target_id: null, before: null, after: after as never, note: null });
}

function randomPassword() {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return `Zz-${btoa(String.fromCharCode(...bytes)).replace(/[^A-Za-z0-9]/g, '').slice(0, 20)}9!`;
}

/** Everything the QA kit owns: test-flagged profiles plus registry rows. */
async function testScope(db: Db) {
  const [{ data: profs }, { data: reg }] = await Promise.all([
    db.from('profiles').select('id').eq('is_test', true),
    db.from('qa_test_accounts').select('user_id'),
  ]);
  const ids = [...new Set([...(profs ?? []).map(p => p.id), ...(reg ?? []).map(r => r.user_id).filter((x): x is string => !!x)])];
  const none = ['00000000-0000-0000-0000-000000000000'];
  const userIds = ids.length ? ids : none;
  const { data: evs } = await db.from('events').select('id').in('host_id', userIds);
  const { data: tms } = await db.from('teams').select('id').in('owner_id', userIds);
  return { ids, userIds, eventIds: (evs ?? []).map(e => e.id).concat(none), teamIds: (tms ?? []).map(t => t.id).concat(none) };
}

async function countAll(db: Db) {
  const s = await testScope(db);
  const c = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;
  const outboxOr = `user_id.in.(${s.userIds.join(',')}),recipient.ilike.${EMAIL_LIKE},recipient.in.(${PHONES.join(',')})`;
  const rsvpOr = `user_id.in.(${s.userIds.join(',')}),guest_email.ilike.${EMAIL_LIKE},event_id.in.(${s.eventIds.join(',')})`;
  let files = 0;
  const { data: buckets } = await db.storage.listBuckets();
  for (const b of buckets ?? []) for (const id of s.ids) { const { data } = await db.storage.from(b.id).list(id, { limit: 1000 }); files += (data ?? []).length; }
  return {
    accounts: s.ids.length,
    registry: await c(db.from('qa_test_accounts').select('persona', { count: 'exact', head: true })),
    events: await c(db.from('events').select('id', { count: 'exact', head: true }).in('host_id', s.userIds)),
    rsvps: await c(db.from('rsvps').select('id', { count: 'exact', head: true }).or(rsvpOr)),
    teams: await c(db.from('teams').select('id', { count: 'exact', head: true }).in('owner_id', s.userIds)),
    teamMembers: await c(db.from('team_members').select('user_id', { count: 'exact', head: true }).or(`user_id.in.(${s.userIds.join(',')}),team_id.in.(${s.teamIds.join(',')})`)),
    resources: (await c(db.from('offers').select('id', { count: 'exact', head: true }).in('host_id', s.userIds))) + (await c(db.from('tracks').select('id', { count: 'exact', head: true }).in('host_id', s.userIds))) + (await c(db.from('challenges').select('id', { count: 'exact', head: true }).in('created_by', s.userIds))),
    messages: await c(db.from('notification_outbox').select('id', { count: 'exact', head: true }).or(outboxOr)),
    files,
    adminRoles: await c(db.from('user_roles').select('user_id', { count: 'exact', head: true }).in('user_id', s.userIds)),
  };
}
export type QaCounts = Awaited<ReturnType<typeof countAll>>;

/** QA Lab overview: personas (no passwords), counts and suppressed test messages. */
export const getQaLab = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const db = await assertAdmin(context);
  const [{ data: reg }, counts, { data: msgs }] = await Promise.all([
    db.from('qa_test_accounts').select('persona, label, email, phone, user_id, created_at').order('created_at'),
    countAll(db),
    db.from('notification_outbox').select('id, channel, template, recipient, created_at').eq('error', 'test_account').order('created_at', { ascending: false }).limit(50),
  ]);
  return { accounts: (reg ?? []).map(r => ({ ...r, hasAccount: !!r.user_id })), counts, suppressed: msgs ?? [] };
});

/** Creates the ten personas once. Existing personas are left untouched. */
export const seedQaAccounts = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const db = await assertAdmin(context);
  const { data: existing } = await db.from('qa_test_accounts').select('persona');
  const have = new Set((existing ?? []).map(e => e.persona));
  const created: string[] = []; const errors: string[] = [];
  for (const [i, p] of QA_PERSONAS.entries()) {
    if (have.has(p.key)) continue;
    const email = qaEmail(p.slug); const name = qaName(p.label); const phone = qaPhone(i);
    let userId: string | null = null; let password: string | null = null;
    if (p.account) {
      password = randomPassword();
      const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name, language: p.lang } });
      if (error || !data.user) { errors.push(`${p.key}: ${error?.message ?? 'create_failed'}`); continue; }
      userId = data.user.id;
      const { error: pe } = await db.from('profiles').update({ is_test: true, full_name: name, phone, city: 'Testville', language: p.lang, host_public: false }).eq('id', userId);
      if (pe) errors.push(`${p.key}: profile ${pe.message}`);
      if (p.key === 'p10') { const { error: re } = await db.from('user_roles').insert({ user_id: userId, role: 'admin' }); if (re) errors.push(`p10: role ${re.message}`); }
    }
    const { error: ie } = await db.from('qa_test_accounts').insert({ persona: p.key, label: name, user_id: userId, email, phone, password });
    if (ie) errors.push(`${p.key}: registry ${ie.message}`); else created.push(p.key);
  }
  await audit(db, context.userId, 'qa_seed', { created, errors: errors.length });
  return { created, errors };
});

/** Owner/admin-only, on demand: one persona's password. Never logged. */
export const revealQaPassword = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ persona: z.string().regex(/^p\d{1,2}$/) }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await assertAdmin(context);
    const { data: row } = await db.from('qa_test_accounts').select('password').eq('persona', data.persona).maybeSingle();
    await audit(db, context.userId, 'qa_reveal_password', { persona: data.persona });
    return { password: row?.password ?? null };
  });

/** Removes every QA-owned row, file and account (including P10's admin role); reports counts before and after. */
export const deleteQaData = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const db = await assertAdmin(context);
  const before = await countAll(db);
  const s = await testScope(db);
  const errors: string[] = [];
  const run = async (label: string, q: PromiseLike<{ error: { message: string } | null }>) => { const { error } = await q; if (error) errors.push(`${label}: ${error.message}`); };
  await run('outbox', db.from('notification_outbox').delete().or(`user_id.in.(${s.userIds.join(',')}),recipient.ilike.${EMAIL_LIKE},recipient.in.(${PHONES.join(',')})`));
  await run('rsvps', db.from('rsvps').delete().or(`user_id.in.(${s.userIds.join(',')}),guest_email.ilike.${EMAIL_LIKE},event_id.in.(${s.eventIds.join(',')})`));
  await run('team_members', db.from('team_members').delete().or(`user_id.in.(${s.userIds.join(',')}),team_id.in.(${s.teamIds.join(',')})`));
  await run('events', db.from('events').delete().in('host_id', s.userIds));
  await run('challenges', db.from('challenges').delete().in('created_by', s.userIds));
  await run('offers', db.from('offers').delete().in('host_id', s.userIds));
  await run('tracks', db.from('tracks').delete().in('host_id', s.userIds));
  await run('teams', db.from('teams').delete().in('owner_id', s.userIds));
  const { data: buckets } = await db.storage.listBuckets();
  for (const b of buckets ?? []) for (const id of s.ids) {
    const { data } = await db.storage.from(b.id).list(id, { limit: 1000 });
    if (data?.length) { const { error } = await db.storage.from(b.id).remove(data.map(f => `${id}/${f.name}`)); if (error) errors.push(`files ${b.id}: ${error.message}`); }
  }
  await run('user_roles', db.from('user_roles').delete().in('user_id', s.userIds));
  for (const id of s.ids) { const { error } = await db.auth.admin.deleteUser(id); if (error) errors.push(`account: ${error.message}`); }
  await run('profiles', db.from('profiles').delete().in('id', s.userIds));
  await run('registry', db.from('qa_test_accounts').delete().neq('persona', ''));
  const after = await countAll(db);
  await audit(db, context.userId, 'qa_delete_all', { before, after, errors: errors.length });
  return { before, after, errors, clean: Object.values(after).every(v => v === 0) };
});
