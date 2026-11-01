// Server-only QA Lab operations (service-role client passed in after the caller's admin check).
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { QA_PERSONAS, qaEmail, qaName, qaPhone } from './qa-lab';

type Db = SupabaseClient<Database>;

const EMAIL_LIKE = 'zz-test+%@example.com';
const PHONES = QA_PERSONAS.map((_, i) => qaPhone(i));

export async function audit(db: Db, actor: string, action: string, after: unknown) {
  await db.from('admin_audit').insert({ actor_id: actor, action, target_type: 'qa_lab', target_id: null, before: null, after: after as never, note: null });
}

function randomPassword() {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return `Zz-${btoa(String.fromCharCode(...bytes)).replace(/[^A-Za-z0-9]/g, '').slice(0, 20)}9!`;
}

/** Everything the QA kit owns: test-flagged profiles plus registry rows. */
export async function testScope(db: Db) {
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

export async function countAll(db: Db) {
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


export async function seedQa(db: Db, actor: string) {
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
  await audit(db, actor, 'qa_seed', { created, errors: errors.length });
  return { created, errors };
}

export async function deleteQa(db: Db, actor: string) {
  const before = await countAll(db);
  const s = await testScope(db);
  const errors: string[] = [];
  const run = async (label: string, q: PromiseLike<{ error: { message: string } | null }>) => { const { error } = await q; if (error) errors.push(`${label}: ${error.message}`); };
  await run('outbox', db.from('notification_outbox').delete().or(`user_id.in.(${s.userIds.join(',')}),recipient.ilike.${EMAIL_LIKE},recipient.in.(${PHONES.join(',')})`));
  await run('rsvps', db.from('rsvps').delete().or(`user_id.in.(${s.userIds.join(',')}),guest_email.ilike.${EMAIL_LIKE},event_id.in.(${s.eventIds.join(',')})`));
  await run('events', db.from('events').delete().in('host_id', s.userIds));
  await run('challenges', db.from('challenges').delete().in('created_by', s.userIds));
  await run('offers', db.from('offers').delete().in('host_id', s.userIds));
  await run('tracks', db.from('tracks').delete().in('host_id', s.userIds));
  await run('teams', db.from('teams').delete().in('owner_id', s.userIds));
  // After teams: removing a team's last leader directly is refused by design.
  await run('team_members', db.from('team_members').delete().or(`user_id.in.(${s.userIds.join(',')}),team_id.in.(${s.teamIds.join(',')})`));
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
  await audit(db, actor, 'qa_delete_all', { before, after, errors: errors.length });
  return { before, after, errors, clean: Object.values(after).every(v => v === 0) };
}
