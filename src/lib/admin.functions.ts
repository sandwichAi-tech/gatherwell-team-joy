import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

type Ctx = { supabase: { rpc: (fn: 'has_role', args: { _user_id: string; _role: 'admin' }) => PromiseLike<{ data: boolean | null }> }; userId: string };

/** Every admin function starts here: the caller's own session must hold the admin role. */
async function assertAdmin(context: Ctx) {
  const { data } = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'admin' });
  if (!data) throw new Error('forbidden');
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  return supabaseAdmin;
}

type Admin = Awaited<ReturnType<typeof assertAdmin>>;
async function audit(db: Admin, actor: string, action: string, targetType: string, targetId: string | null, before: unknown, after: unknown, note?: string | null) {
  await db.from('admin_audit').insert({ actor_id: actor, action, target_type: targetType, target_id: targetId, before: (before ?? null) as never, after: (after ?? null) as never, note: note || null });
}

const uuid = z.string().uuid();
const note = z.string().trim().max(500).optional();

/** Used by the /admin page to decide between the console and the polite "not available" page. */
export const getAdminAccess = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data } = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'admin' });
  return { admin: !!data };
});

export const getAdminOverview = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ period: z.enum(['week', 'month', 'all']) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const since = data.period === 'all' ? new Date(0) : new Date(Date.now() - (data.period === 'week' ? 7 : 30) * 864e5);
    const { data: o, error } = await context.supabase.rpc('admin_overview', { _since: since.toISOString() });
    if (error) throw new Error(error.message);
    const r = o as Record<string, unknown> & { paid: Record<string, number>; licenses: Record<string, number> };
    const connected = !!process.env['STRIPE_SECRET_KEY'];
    let mrr: number | null = null;
    if (connected) {
      const { PLAN_PRICES, LICENSE_PRICES } = await import('./billing/stripe.server');
      const p = r.paid ?? {}; const l = r.licenses ?? {};
      mrr = (p['growth_month'] ?? 0) * PLAN_PRICES.growth.month + Math.round((p['growth_year'] ?? 0) * PLAN_PRICES.growth.year / 12)
        + (p['pro_month'] ?? 0) * PLAN_PRICES.pro.month + Math.round((p['pro_year'] ?? 0) * PLAN_PRICES.pro.year / 12)
        + (l['team25'] ?? 0) * LICENSE_PRICES.team25.cents + (l['team100'] ?? 0) * LICENSE_PRICES.team100.cents;
    }
    return { ...r, mrr_cents: mrr, stripe_connected: connected } as unknown as AdminOverview;
  });

export type AdminOverview = {
  signups: number; active_teams: number; gatherings: number; rsvps: number; checkins: number; ai_requests: number; ai_cost_cents: number;
  messages: Record<string, number>; plans: { free: number; growth: number; pro: number; team: number };
  weeks: { week: string; signups: number; checkins: number }[]; mrr_cents: number | null; stripe_connected: boolean;
};

export const listAdminTeams = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ q: z.string().max(100) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: rows, error } = await context.supabase.rpc('admin_teams', { _q: data.q });
    if (error) throw new Error(error.message);
    return rows as unknown as { id: string; name: string; leader_name: string | null; members: number; subteams: number; plan: string; licensed: boolean; last_activity: string | null; suspended: string | null; parent_team_id: string | null }[];
  });

export const getAdminTeam = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: r, error } = await context.supabase.rpc('admin_team_detail', { _id: data.id });
    if (error) throw new Error(error.message);
    return r as unknown as AdminTeamDetail;
  });

export type AdminTeamDetail = {
  team: { id: string; name: string; owner_id: string; leader_name: string | null; plan: { plan: string; source: string }; billing: { plan: string; status: string; renews_at: string | null } | null; license: { tier: string; seats: number; status: string; is_preview: boolean } | null; suspension: { reason: string; created_at: string } | null } | null;
  members: { user_id: string; name: string | null; role: string; joined_at: string }[];
  gatherings: { id: string; title: string; starts_at: string; status: string }[];
  templates: { id: string; title: string; is_published: boolean; launches_count: number }[];
  activity: { type: string; created_at: string }[];
};

export const adminTeamAction = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    teamId: uuid, action: z.enum(['plan', 'extend', 'license', 'suspend', 'restore']),
    plan: z.enum(['free', 'growth', 'pro']).optional(), until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    tier: z.enum(['team25', 'team100']).optional(), reason: note,
  }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await assertAdmin(context);
    const { data: team } = await db.from('teams').select('id, owner_id, name').eq('id', data.teamId).maybeSingle();
    if (!team) return { ok: false as const, error: 'not_found' };
    if (data.action === 'plan' || data.action === 'extend') {
      const { data: before } = await db.from('billing_accounts').select('plan, status, renews_at').eq('user_id', team.owner_id).maybeSingle();
      const plan = data.plan ?? 'growth';
      if (data.action === 'extend' && (!data.until || new Date(`${data.until}T23:59:59Z`) <= new Date())) return { ok: false as const, error: 'bad_date' };
      const after = data.action === 'plan'
        ? { plan, status: 'active', renews_at: null }
        : { plan: plan === 'free' ? 'growth' : plan, status: 'trialing', renews_at: new Date(`${data.until}T23:59:59Z`).toISOString() };
      const { error } = await db.from('billing_accounts').upsert({ user_id: team.owner_id, ...after }, { onConflict: 'user_id' });
      if (error) return { ok: false as const, error: 'failed' };
      await audit(db, context.userId, data.action === 'plan' ? 'team.change_plan' : 'team.extend_free', 'team', team.id, before, after, data.reason);
    } else if (data.action === 'license') {
      const { data: before } = await db.from('team_licenses').select('tier, seats, status, is_preview').eq('team_id', team.id).maybeSingle();
      const { error } = await context.supabase.rpc('admin_grant_preview_license', { _team: team.id, _tier: data.tier ?? 'team25' });
      if (error) return { ok: false as const, error: 'failed' };
      const { data: after } = await db.from('team_licenses').select('tier, seats, status, is_preview').eq('team_id', team.id).maybeSingle();
      await audit(db, context.userId, 'team.grant_license', 'team', team.id, before, after, data.reason);
    } else if (data.action === 'suspend') {
      if (!data.reason) return { ok: false as const, error: 'reason_required' };
      await db.from('team_suspensions').upsert({ team_id: team.id, reason: data.reason, suspended_by: context.userId });
      await audit(db, context.userId, 'team.suspend', 'team', team.id, null, { reason: data.reason }, data.reason);
    } else {
      const { data: before } = await db.from('team_suspensions').select('reason, created_at').eq('team_id', team.id).maybeSingle();
      await db.from('team_suspensions').delete().eq('team_id', team.id);
      await audit(db, context.userId, 'team.restore', 'team', team.id, before, null, data.reason);
    }
    return { ok: true as const };
  });

export const listAdminUsers = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ q: z.string().max(100) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: rows, error } = await context.supabase.rpc('admin_users', { _q: data.q });
    if (error) throw new Error(error.message);
    return rows as unknown as { id: string; email: string; full_name: string | null; created_at: string; last_sign_in_at: string | null; plan: string; suspended: string | null }[];
  });

export const getAdminUser = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: r, error } = await context.supabase.rpc('admin_user_detail', { _id: data.id });
    if (error) throw new Error(error.message);
    return r as unknown as { id: string; email: string; full_name: string | null; created_at: string; last_sign_in_at: string | null; plan: { plan: string; source: string }; is_admin: boolean; suspension: { reason: string; created_at: string } | null; teams: { team_id: string; name: string; role: string }[] } | null;
  });

export const adminUserAction = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: uuid, action: z.enum(['resend', 'suspend', 'restore', 'delete']), reason: note, origin: z.string().url() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await assertAdmin(context);
    if (data.userId === context.userId && data.action !== 'resend') return { ok: false as const, error: 'self' };
    const { data: u } = await db.auth.admin.getUserById(data.userId);
    const email = u?.user?.email;
    if (!u?.user) return { ok: false as const, error: 'not_found' };
    if (data.action === 'resend') {
      if (!email) return { ok: false as const, error: 'no_email' };
      const { createClient } = await import('@supabase/supabase-js');
      const key = process.env['SUPABASE_PUBLISHABLE_KEY']!;
      const pub = createClient(process.env['SUPABASE_URL']!, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => { const h = new Headers(init?.headers); if (key.startsWith('sb_') && h.get('Authorization') === `Bearer ${key}`) h.delete('Authorization'); h.set('apikey', key); return fetch(input, { ...init, headers: h }); } } });
      const { error } = await pub.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: `${new URL(data.origin).origin}/home` } });
      if (error) return { ok: false as const, error: 'failed' };
      await audit(db, context.userId, 'user.resend_link', 'user', data.userId, null, { email }, data.reason);
    } else if (data.action === 'suspend') {
      if (!data.reason) return { ok: false as const, error: 'reason_required' };
      const { error } = await db.auth.admin.updateUserById(data.userId, { ban_duration: '876000h' });
      if (error) return { ok: false as const, error: 'failed' };
      await db.from('user_suspensions').upsert({ user_id: data.userId, reason: data.reason, suspended_by: context.userId });
      await audit(db, context.userId, 'user.suspend', 'user', data.userId, null, { reason: data.reason }, data.reason);
    } else if (data.action === 'restore') {
      const { error } = await db.auth.admin.updateUserById(data.userId, { ban_duration: 'none' });
      if (error) return { ok: false as const, error: 'failed' };
      const { data: before } = await db.from('user_suspensions').select('reason, created_at').eq('user_id', data.userId).maybeSingle();
      await db.from('user_suspensions').delete().eq('user_id', data.userId);
      await audit(db, context.userId, 'user.restore', 'user', data.userId, before, null, data.reason);
    } else {
      if (!data.reason) return { ok: false as const, error: 'reason_required' };
      const { data: sole } = await db.from('teams').select('id, name').eq('owner_id', data.userId);
      if (sole?.length) return { ok: false as const, error: 'owns_team' };
      const { data: prof } = await db.from('profiles').select('full_name, created_at').eq('id', data.userId).maybeSingle();
      const { error } = await db.auth.admin.deleteUser(data.userId);
      if (error) return { ok: false as const, error: 'failed' };
      await audit(db, context.userId, 'user.delete', 'user', data.userId, { email, ...prof }, null, data.reason);
    }
    return { ok: true as const };
  });

export type AdminReport = {
  id: string; target_type: 'event' | 'shoutout' | 'photo' | 'activity' | 'announcement' | 'comment'; target_id: string; reason: string; note: string | null; source: string; status: string;
  resolution_note: string | null; created_at: string; team_name: string | null; author_name: string | null; open_count: number;
  preview: { title?: string; text?: string | null; text_es?: string | null; photo?: string | null } | null; photo_url?: string | null;
};

export const listReports = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ status: z.enum(['open', 'closed']) }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await assertAdmin(context);
    const { data: rows, error } = await context.supabase.rpc('admin_reports', { _status: data.status });
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as unknown as AdminReport[];
    for (const r of list) {
      const path = r.preview?.photo; if (!path) continue;
      const bucket = r.target_type === 'photo' ? 'event-photos' : 'media';
      const { data: s } = await db.storage.from(bucket).createSignedUrl(path, 3600);
      r.photo_url = s?.signedUrl ?? null;
    }
    return list;
  });

export const moderateReport = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ reportId: uuid, action: z.enum(['approve', 'remove', 'edit']), note, text: z.string().trim().max(2000).optional(), textEs: z.string().trim().max(2000).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await assertAdmin(context);
    const { data: rep } = await db.from('reports').select('*').eq('id', data.reportId).maybeSingle();
    if (!rep) return { ok: false as const, error: 'not_found' };
    const id = rep.target_id; let before: unknown = null; let after: unknown = null;
    if (data.action === 'remove') {
      if (rep.target_type === 'event') { const { data: e } = await db.from('events').select('status').eq('id', id).maybeSingle(); before = e; await db.from('events').update({ status: 'draft' }).eq('id', id); after = { status: 'draft' }; }
      else if (rep.target_type === 'shoutout') {
        const { data: s } = await db.from('shoutouts').select('message, hidden, activity_id').eq('id', id).maybeSingle(); before = s;
        await db.from('shoutouts').update({ hidden: true }).eq('id', id);
        if (s?.activity_id) { await db.from('activity_reactions').delete().eq('activity_id', s.activity_id); await db.from('activity').delete().eq('id', s.activity_id); }
        after = { hidden: true };
      } else if (rep.target_type === 'comment') { before = { hidden: false }; await db.from('comments').update({ hidden: true }).eq('id', id); after = { hidden: true };
      } else if (rep.target_type === 'photo') { before = { hidden: false }; await db.from('event_photos').update({ hidden: true }).eq('id', id); after = { hidden: true }; }
      else if (rep.target_type === 'activity') { const { data: a } = await db.from('activity').select('type, payload').eq('id', id).maybeSingle(); before = a; await db.from('activity_reactions').delete().eq('activity_id', id); await db.from('activity').delete().eq('id', id); }
      else { const { data: a } = await db.from('announcements').select('body').eq('id', id).maybeSingle(); before = a; await db.from('announcements').delete().eq('id', id); }
    } else if (data.action === 'edit') {
      if (!data.text && !data.textEs) return { ok: false as const, error: 'text_required' };
      if (rep.target_type === 'event') {
        const { data: e } = await db.from('events').select('description_en, description_es').eq('id', id).maybeSingle(); before = e;
        after = { description_en: data.text || null, description_es: data.textEs || null };
        await db.from('events').update(after as never).eq('id', id);
      } else if (rep.target_type === 'shoutout') {
        const { data: s } = await db.from('shoutouts').select('message, activity_id').eq('id', id).maybeSingle(); before = { message: s?.message };
        await db.from('shoutouts').update({ message: data.text! }).eq('id', id); after = { message: data.text };
        if (s?.activity_id) { const { data: a } = await db.from('activity').select('payload').eq('id', s.activity_id).maybeSingle(); if (a) await db.from('activity').update({ payload: { ...(a.payload as object), body: data.text } }).eq('id', s.activity_id); }
      } else if (rep.target_type === 'announcement') {
        const { data: a } = await db.from('announcements').select('body').eq('id', id).maybeSingle(); before = a;
        await db.from('announcements').update({ body: data.text! }).eq('id', id); after = { body: data.text };
      } else if (rep.target_type === 'activity') {
        const { data: a } = await db.from('activity').select('payload').eq('id', id).maybeSingle(); before = a;
        const payload = { ...(a?.payload as object), body: data.text }; await db.from('activity').update({ payload }).eq('id', id); after = { payload };
      } else return { ok: false as const, error: 'not_editable' };
    }
    const status = data.action === 'approve' ? 'approved' : data.action === 'remove' ? 'removed' : 'edited';
    await db.from('reports').update({ status, resolution_note: data.note || null, resolved_by: context.userId, resolved_at: new Date().toISOString() }).eq('target_id', id).eq('status', 'open');
    await audit(db, context.userId, `moderation.${data.action}`, rep.target_type, id, before, after, data.note);
    return { ok: true as const };
  });

// ===== Global library =====
const kind = z.enum(['template', 'recipe', 'badge', 'challenge_type']);
const TABLE = { template: 'templates', recipe: 'recipes', badge: 'badges', challenge_type: 'challenge_types' } as const;

export const getLibrary = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const db = await assertAdmin(context);
  const [t, r, b, c] = await Promise.all([
    db.from('templates').select('id, title, description_en, description_es, default_duration_minutes, default_capacity, checklist, is_published, sort_order, launches_count').is('team_id', null).order('sort_order').order('created_at'),
    db.from('recipes').select('id, title_en, title_es, prep_minutes, tags, ingredients, steps, is_published, sort_order').is('team_id', null).is('private_owner', null).order('sort_order').order('created_at'),
    db.from('badges').select('id, code, name_en, name_es, description_en, description_es, icon, tier, sort_order').is('team_id', null).order('sort_order'),
    db.from('challenge_types').select('*').order('sort_order').order('created_at'),
  ]);
  return { templates: t.data ?? [], recipes: r.data ?? [], badges: b.data ?? [], challengeTypes: c.data ?? [] };
});

const lines = z.array(z.string().trim().min(1).max(300)).max(30);
const fieldsBy = {
  template: z.object({ title: z.string().trim().min(1).max(120), description_en: z.string().max(1000).nullable(), description_es: z.string().max(1000).nullable(), default_duration_minutes: z.number().int().min(15).max(600), default_capacity: z.number().int().min(1).max(10000).nullable(), checklist: lines }),
  recipe: z.object({ title_en: z.string().trim().min(1).max(120), title_es: z.string().trim().min(1).max(120), prep_minutes: z.number().int().min(0).max(600).nullable(), tags: z.array(z.string().max(40)).max(10), ingredients: z.object({ en: lines, es: lines }), steps: z.object({ en: lines, es: lines }) }),
  badge: z.object({ name_en: z.string().trim().min(1).max(80), name_es: z.string().trim().min(1).max(80), description_en: z.string().max(300).nullable(), description_es: z.string().max(300).nullable(), icon: z.string().max(40), tier: z.enum(['bronze', 'silver', 'gold']) }),
  challenge_type: z.object({ title_en: z.string().trim().min(1).max(120), title_es: z.string().trim().min(1).max(120), description_en: z.string().max(1000).nullable(), description_es: z.string().max(1000).nullable(), daily_prompt_en: z.string().max(300).nullable(), daily_prompt_es: z.string().max(300).nullable(), duration_days: z.number().int().min(3).max(90) }),
};

export const saveLibraryItem = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ kind, id: uuid.optional(), fields: z.record(z.string(), z.unknown()) }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await assertAdmin(context);
    const parsed = fieldsBy[data.kind].safeParse(data.fields);
    if (!parsed.success) return { ok: false as const, error: 'invalid' };
    const fields = parsed.data as Record<string, unknown>;
    const all = Object.values(fields).map(v => JSON.stringify(v)).join(' ');
    const { data: claim } = await db.rpc('has_blocked_claim', { _text: all });
    if (claim) return { ok: false as const, error: 'claim' };
    const table = TABLE[data.kind];
    let before: unknown = null; let id = data.id;
    if (id) {
      const { data: b } = await db.from(table).select('*').eq('id', id).maybeSingle(); before = b;
      const { error } = await db.from(table).update(fields as never).eq('id', id);
      if (error) return { ok: false as const, error: 'failed' };
    } else {
      const extra = data.kind === 'badge' ? { code: `global_${Date.now().toString(36)}`, is_custom: false, sort_order: 900 } : data.kind === 'template' ? { visibility_default: 'public', is_published: false, sort_order: 900 } : data.kind === 'recipe' ? { cover_style: 0, is_published: false, sort_order: 900 } : { is_published: false, sort_order: 900 };
      const { data: row, error } = await db.from(table).insert({ ...fields, ...extra } as never).select('id').single();
      if (error || !row) return { ok: false as const, error: 'failed' };
      id = (row as { id: string }).id;
    }
    await audit(db, context.userId, `library.${data.id ? 'edit' : 'create'}`, data.kind, id!, before, fields);
    return { ok: true as const, id };
  });

export const setLibraryPublished = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ kind: z.enum(['template', 'recipe', 'challenge_type']), id: uuid, published: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await assertAdmin(context);
    await db.from(TABLE[data.kind]).update({ is_published: data.published } as never).eq('id', data.id);
    await audit(db, context.userId, data.published ? 'library.publish' : 'library.unpublish', data.kind, data.id, { is_published: !data.published }, { is_published: data.published });
    return { ok: true as const };
  });

export const reorderLibrary = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ kind, ids: z.array(uuid).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await assertAdmin(context);
    for (let i = 0; i < data.ids.length; i++) await db.from(TABLE[data.kind]).update({ sort_order: (i + 1) * 10 } as never).eq('id', data.ids[i]!);
    await audit(db, context.userId, 'library.reorder', data.kind, null, null, { order: data.ids });
    return { ok: true as const };
  });

// ===== Broadcasts =====
export const getBroadcasts = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await assertAdmin(context);
  const { data, error } = await context.supabase.rpc('admin_broadcasts');
  if (error) throw new Error(error.message);
  return { list: data as unknown as { id: string; audience: string; title_en: string; title_es: string; is_test: boolean; recipients: number; active: boolean; created_at: string; counts: Record<string, number>; seen: number }[], emailConnected: !!process.env['RESEND_API_KEY'] };
});

export const sendBroadcast = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ audience: z.enum(['leaders', 'members']), test: z.boolean(),
    title_en: z.string().trim().min(1).max(120), title_es: z.string().trim().min(1).max(120), body_en: z.string().trim().min(1).max(2000), body_es: z.string().trim().min(1).max(2000) }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await assertAdmin(context);
    const { data: claim } = await db.rpc('has_blocked_claim', { _text: `${data.title_en} ${data.title_es} ${data.body_en} ${data.body_es}` });
    if (claim) return { ok: false as const, error: 'claim' };
    const { test, ...rest } = data;
    const { data: row, error } = await db.from('broadcasts').insert({ ...rest, is_test: test, created_by: context.userId }).select('id').single();
    if (error || !row) return { ok: false as const, error: 'failed' };
    const { data: n } = await db.rpc('queue_broadcast', { _id: row.id });
    await audit(db, context.userId, test ? 'broadcast.test' : 'broadcast.send', 'broadcast', row.id, null, { ...rest, recipients: n ?? 0 });
    return { ok: true as const, recipients: (n as number | null) ?? 0 };
  });

export const endBroadcast = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await assertAdmin(context);
    await db.from('broadcasts').update({ active: false }).eq('id', data.id);
    await audit(db, context.userId, 'broadcast.end', 'broadcast', data.id, { active: true }, { active: false });
    return { ok: true as const };
  });

// ===== Flags and audit =====
export const getFlags = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const db = await assertAdmin(context);
  const { data } = await db.from('feature_flags').select('*').order('key');
  return data ?? [];
});

export const setFlag = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ key: z.string().max(60), enabled: z.boolean(), value: z.string().max(60).nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await assertAdmin(context);
    const { data: before } = await db.from('feature_flags').select('enabled, value').eq('key', data.key).maybeSingle();
    if (!before) return { ok: false as const, error: 'not_found' };
    await db.from('feature_flags').update({ enabled: data.enabled, value: data.value, updated_at: new Date().toISOString() }).eq('key', data.key);
    await audit(db, context.userId, 'flag.update', 'flag', data.key, before, { enabled: data.enabled, value: data.value });
    return { ok: true as const };
  });

export const getAudit = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ q: z.string().max(100), area: z.enum(['all', 'team', 'user', 'moderation', 'library', 'broadcast', 'flag']) }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await assertAdmin(context);
    let q = db.from('admin_audit').select('*').order('created_at', { ascending: false }).limit(200);
    if (data.area !== 'all') q = q.like('action', `${data.area === 'moderation' ? 'moderation' : data.area}.%`);
    const term = data.q.trim().replace(/[%,()]/g, '');
    if (term) q = q.or(`action.ilike.%${term}%,target_id.ilike.%${term}%,note.ilike.%${term}%`);
    const { data: rows } = await q;
    const ids = [...new Set((rows ?? []).map(r => r.actor_id).filter(Boolean))] as string[];
    const { data: people } = ids.length ? await db.from('profiles').select('id, full_name').in('id', ids) : { data: [] };
    const names = Object.fromEntries((people ?? []).map(p => [p.id, p.full_name]));
    return (rows ?? []).map(r => ({ ...r, actor_name: r.actor_id ? names[r.actor_id] ?? null : null }));
  });
