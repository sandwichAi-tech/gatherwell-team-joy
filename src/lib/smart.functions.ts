import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

const lang = z.enum(['en', 'es']);
type Sb = { rpc: (fn: any, args?: any) => any };

async function underLimit(sb: Sb) {
  const { data } = await sb.rpc('ai_usage_status');
  const u = data as { used: number; limit: number } | null;
  return !u || u.used < u.limit;
}
async function record(sb: Sb, feature: string, input: number, output: number) {
  await sb.rpc('record_ai_usage', { _feature: feature, _input: input, _output: output });
}

/** Host-only: prepare follow-ups for one past gathering right away (the scheduler does this at 8:00 the next morning). */
export const prepareFollowupsNow = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ eventId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: ev } = await context.supabase.from('events').select('host_id, starts_at').eq('id', data.eventId).maybeSingle();
    const coPrep = ev && ev.host_id !== context.userId ? (await context.supabase.rpc('is_event_cohost' as never, { _event: data.eventId } as never)).data : false;
    if (!ev || (ev.host_id !== context.userId && !coPrep)) return { ok: false, error: 'not_allowed' as const };
    if (new Date(ev.starts_at).getTime() > Date.now()) return { ok: false, error: 'not_finished' as const };
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { draftFollowupsForEvent } = await import('@/lib/ai/followups.server');
    const r = await draftFollowupsForEvent(supabaseAdmin, data.eventId);
    return { ok: true, created: r.created };
  });

/** Send one follow-up through the outbox (email/text, opt-in only) or record a WhatsApp send. */
export const sendFollowup = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ draftId: z.string().uuid(), channel: z.enum(['email', 'sms', 'whatsapp']), message: z.string().trim().min(1).max(1000) }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: draft } = await sb.from('followup_drafts').select('id, host_id, event_id, rsvp_id, team_id, language, status').eq('id', data.draftId).maybeSingle();
    const coSend = draft && draft.host_id !== context.userId ? (await sb.rpc('is_event_cohost' as never, { _event: draft.event_id } as never)).data : false;
    if (!draft || (draft.host_id !== context.userId && !coSend)) return { ok: false, error: 'not_allowed' };
    if (draft.status === 'sent') return { ok: true };
    const { hasClaim } = await import('@/lib/ai/smart.server');
    if (hasClaim(data.message)) return { ok: false, error: 'claim_blocked' };
    if (data.channel !== 'whatsapp') {
      const { data: r } = await sb.from('rsvps').select('guest_email, guest_phone, email_opt_in, sms_opt_in').eq('id', draft.rsvp_id).maybeSingle();
      const to = data.channel === 'email' ? (r?.email_opt_in ? r.guest_email : null) : (r?.sms_opt_in ? r.guest_phone : null);
      if (!to) return { ok: false, error: 'no_opt_in' };
      const [{ data: ev }, { data: me }] = await Promise.all([
        sb.from('events').select('title').eq('id', draft.event_id).maybeSingle(),
        sb.from('profiles').select('full_name').eq('id', context.userId).maybeSingle(),
      ]);
      const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
      const { error } = await supabaseAdmin.rpc('enqueue_message', {
        _channel: data.channel, _recipient: to, _language: draft.language, _template: 'host_followup', _kind: 'transactional',
        _payload: { body: data.message, host: (me?.full_name ?? '').split(/\s+/)[0] ?? '', title: ev?.title ?? '', event_id: draft.event_id },
        _event: draft.event_id, _rsvp: draft.rsvp_id, _team: draft.team_id,
      });
      if (error) { console.error('[followups] enqueue failed', error.message); return { ok: false, error: 'failed' }; }
    }
    const { error } = await sb.from('followup_drafts').update({ message: data.message, status: 'sent', channel: data.channel, sent_at: new Date().toISOString() }).eq('id', draft.id);
    if (error) return { ok: false, error: error.message.includes('claim') ? 'claim_blocked' : 'failed' };
    return { ok: true };
  });

/** Suggested wording when the claim check flags text. */
export const suggestRewrite = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ text: z.string().min(1).max(4000), lang }).parse(d))
  .handler(async ({ data, context }) => {
    const { keywordRewrite, claudeRewrite, hasClaim } = await import('@/lib/ai/smart.server');
    const key = process.env['ANTHROPIC_API_KEY'];
    if (key && await underLimit(context.supabase)) {
      try {
        const r = await claudeRewrite(key, data.text, data.lang);
        await record(context.supabase, 'claims_rewrite', r.input, r.output);
        if (r.text && !hasClaim(r.text)) return { text: r.text, preview: false };
      } catch (e) { console.error('[claims] rewrite failed', e); }
    }
    return { text: keywordRewrite(data.text, data.lang), preview: !key };
  });

/** Leader-only: summary, 5 key points and 3 action items in both languages. Saved separately after editing. */
export const summarizeLesson = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ lessonId: z.string().uuid(), notes: z.string().max(30000) }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: lesson } = await sb.from('lessons').select('title_en, notes_en, notes_es, track_id, tracks(team_id)').eq('id', data.lessonId).maybeSingle();
    const teamId = (lesson as unknown as { tracks: { team_id: string } | null } | null)?.tracks?.team_id;
    if (!lesson || !teamId) return { ok: false as const, error: 'not_found' };
    const { data: isLeader } = await sb.rpc('is_team_member', { _team_id: teamId, _roles: ['leader'] });
    if (!isLeader) return { ok: false as const, error: 'not_leader' };
    const source = data.notes.trim() || [lesson.notes_en, lesson.notes_es].filter(Boolean).join('\n\n');
    const { sampleSummary, claudeSummary } = await import('@/lib/ai/smart.server');
    const key = process.env['ANTHROPIC_API_KEY'];
    if (key) {
      if (!await underLimit(sb)) return { ok: false as const, error: 'limit' };
      try {
        const r = await claudeSummary(key, source || lesson.title_en, lesson.title_en);
        await record(sb, 'lesson_summary', r.input, r.output);
        if (r.summary) return { ok: true as const, teamId, summary: r.summary, preview: false };
      } catch (e) { console.error('[summary] failed', e); return { ok: false as const, error: 'failed' }; }
    }
    return { ok: true as const, teamId, summary: sampleSummary(source, lesson.title_en), preview: true };
  });

/** Today's calm brief: gatherings today, follow-ups waiting, a lesson, a teammate to celebrate, one next step. */
export const getDailyBrief = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ lang, today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), tz: z.string().max(64), name: z.string().max(80) }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase; const uid = context.userId; const es = data.lang === 'es';
    const { data: saved } = await sb.from('daily_briefs').select('lines, preview, dismissed, language, created_at').eq('user_id', uid).eq('day', data.today).maybeSingle();
    if (saved && (saved.dismissed || (!saved.preview && saved.language === data.lang && Date.now() - new Date(saved.created_at).getTime() < 2 * 36e5))) return { lines: saved.dismissed ? [] : saved.lines as { key: string; text: string; link: string | null }[], preview: saved.preview, dismissed: saved.dismissed };

    const { data: prof } = await sb.from('profiles').select('active_team_id').eq('id', uid).maybeSingle();
    const team = prof?.active_team_id;
    const fmtTime = (iso: string) => new Intl.DateTimeFormat(es ? 'es-MX' : 'en-US', { hour: 'numeric', minute: '2-digit', timeZone: data.tz || 'America/Los_Angeles' }).format(new Date(iso));
    const dayOf = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: data.tz || 'America/Los_Angeles' }).format(new Date(iso));
    const lines: { key: string; text: string; link: string | null }[] = [];

    if (team) {
      const from = new Date(Date.now() - 36e5 * 14).toISOString(); const to = new Date(Date.now() + 36e5 * 38).toISOString();
      const { data: evs } = await sb.from('events').select('id, title, starts_at').eq('team_id', team).neq('status', 'cancelled').neq('visibility', 'draft').gte('starts_at', from).lte('starts_at', to).order('starts_at').limit(5);
      const today = (evs ?? []).filter(e => dayOf(e.starts_at) === data.today);
      if (today.length) lines.push({ key: 'today', text: es ? `Hoy: ${today[0]!.title} a las ${fmtTime(today[0]!.starts_at)}${today.length > 1 ? ` y ${today.length - 1} más` : ''}.` : `Today: ${today[0]!.title} at ${fmtTime(today[0]!.starts_at)}${today.length > 1 ? ` and ${today.length - 1} more` : ''}.`, link: `/event/${today[0]!.id}` });
    }
    const { count: waiting } = await sb.from('followup_drafts').select('id', { count: 'exact', head: true }).eq('host_id', uid).in('status', ['draft', 'approved']);
    if (waiting) lines.push({ key: 'followups', text: es ? `${waiting} ${waiting === 1 ? 'seguimiento listo' : 'seguimientos listos'} para revisar.` : `${waiting} follow-up${waiting === 1 ? '' : 's'} ready to review.`, link: '/followups' });
    {
      const { data: hits } = await sb.from('event_plan_waitlist').select('event_id, events!inner(host_id, starts_at, status)').eq('events.host_id', uid).eq('events.status', 'published').gte('events.starts_at', new Date().toISOString());
      const ids = (hits ?? []).map(h => h.event_id);
      if (ids.length) {
        const { count } = await sb.from('rsvps').select('id', { count: 'exact', head: true }).in('event_id', ids).eq('status', 'waitlist');
        const n = count ?? 0;
        if (n) lines.unshift({ key: 'plan_waitlist', text: es ? `${n} ${n === 1 ? 'persona está esperando' : 'personas están esperando'}. Mejora tu plan para darles la bienvenida.` : `${n} ${n === 1 ? 'guest is' : 'guests are'} waiting. Upgrade to welcome them.`, link: '/plan' });
      }
    }
    if (team) {
      const { data: tracks } = await sb.from('tracks').select('id, is_start_here, sort_order, lessons(id, title_en, title_es, sort_order)').eq('team_id', team).eq('is_published', true).order('is_start_here', { ascending: false }).order('sort_order').limit(6);
      const { data: done } = await sb.from('lesson_progress').select('lesson_id').eq('user_id', uid);
      const doneSet = new Set((done ?? []).map(d => d.lesson_id));
      const lesson = (tracks ?? []).flatMap(t => [...((t as any).lessons ?? [])].sort((a: any, b: any) => a.sort_order - b.sort_order)).find((l: any) => !doneSet.has(l.id)) as { id: string; title_en: string; title_es: string | null } | undefined;
      if (lesson && lines.length < 4) lines.push({ key: 'lesson', text: es ? `Una lección para hoy: ${lesson.title_es || lesson.title_en}.` : `One lesson to watch: ${lesson.title_en}.`, link: `/learn/lesson/${lesson.id}` });
      const { data: act } = await sb.from('activity').select('actor_id, type').eq('team_id', team).neq('actor_id', uid).gte('created_at', new Date(Date.now() - 7 * 864e5).toISOString()).order('created_at', { ascending: false }).limit(20);
      const pick = (act ?? []).find(a => a.actor_id && /badge|check|host|challenge|lesson|milestone/.test(a.type)) ?? (act ?? []).find(a => a.actor_id);
      if (pick?.actor_id && lines.length < 4) {
        const { data: p } = await sb.from('profiles').select('full_name').eq('id', pick.actor_id).maybeSingle();
        const n = (p?.full_name ?? '').split(/\s+/)[0];
        if (n) lines.push({ key: 'celebrate', text: es ? `Celebra a ${n}: estuvo muy activa esta semana.` : `Celebrate ${n}: they showed up this week.`, link: '/team' });
      }
    }
    const step = waiting ? (es ? 'Siguiente paso: envía tus seguimientos mientras la reunión está fresca.' : 'Next step: send your follow-ups while the gathering is fresh.')
      : lines.some(l => l.key === 'today') ? (es ? 'Siguiente paso: comparte el enlace una vez más antes de empezar.' : 'Next step: share the link one more time before you start.')
      : (es ? 'Siguiente paso: invita a una persona a tu próxima reunión.' : 'Next step: invite one person to your next gathering.');
    lines.push({ key: 'step', text: step, link: waiting ? '/followups' : '/events' });
    let out = lines.slice(-4).length === lines.length ? lines : [...lines.slice(0, 3), lines[lines.length - 1]!];
    let preview = true;
    const key = process.env['ANTHROPIC_API_KEY'];
    if (key && await underLimit(sb)) {
      try {
        const { claudeBrief } = await import('@/lib/ai/smart.server');
        const r = await claudeBrief(key, out, data.lang, data.name);
        out = r.lines; preview = false;
        await record(sb, 'daily_brief', r.input, r.output);
      } catch (e) { console.error('[brief] failed', e); }
    }
    await sb.from('daily_briefs').upsert({ user_id: uid, day: data.today, language: data.lang, lines: out, preview, dismissed: false, created_at: new Date().toISOString() });
    return { lines: out, preview, dismissed: false };
  });
