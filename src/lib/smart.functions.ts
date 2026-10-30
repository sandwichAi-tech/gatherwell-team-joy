import { summarySource } from '@/lib/summary-source';
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { buildMorningBrief, type BriefEvent } from '@/lib/morning-brief';

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
  .inputValidator((d: unknown) => z.object({ lessonId: z.string().uuid(), notes: z.string().max(30000), useFile: z.boolean().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: lesson } = await sb.from('lessons').select('title_en, notes_en, notes_es, storage_path, track_id, tracks(team_id)').eq('id', data.lessonId).maybeSingle();
    const teamId = (lesson as unknown as { tracks: { team_id: string } | null } | null)?.tracks?.team_id;
    if (!lesson || !teamId) return { ok: false as const, error: 'not_found' };
    const { data: isLeader } = await sb.rpc('is_team_member', { _team_id: teamId, _roles: ['leader'] });
    if (!isLeader) return { ok: false as const, error: 'not_leader' };
    // Only real text is summarized: pasted notes or the lesson's own notes. Attached files are not read, and
    // the title alone is never enough, so nothing is invented when there is no source or no AI key.
    let fileText: string | null = null; let partial = false;
    if (data.useFile) {
      // The caller already passed the RLS read of this lesson and the leader check; the file is downloaded with their
      // own client (storage RLS applies) and never exposed through a public or signed URL.
      const path = (lesson as { storage_path?: string | null }).storage_path;
      if (!path || !/\.pdf$/i.test(path)) return { ok: false as const, error: 'file_unsupported' };
      const { data: blob, error: dl } = await sb.storage.from('learn-media').download(path);
      if (dl || !blob) return { ok: false as const, error: 'file_unreadable' };
      const { extractPdfText } = await import('@/lib/ai/pdf-text.server');
      const pdf = await extractPdfText(new Uint8Array(await blob.arrayBuffer()));
      if (!pdf.ok) return { ok: false as const, error: `file_${pdf.error}` };
      fileText = pdf.text; partial = pdf.truncated;
    }
    const picked = summarySource(fileText ?? data.notes, fileText ? [] : [lesson.notes_en, lesson.notes_es]);
    if (!picked.ok) return { ok: false as const, error: picked.error };
    const key = process.env['ANTHROPIC_API_KEY'];
    if (!key) return { ok: false as const, error: 'unavailable' };
    if (!await underLimit(sb)) return { ok: false as const, error: 'limit' };
    const { claudeSummary } = await import('@/lib/ai/smart.server');
    try {
      const r = await claudeSummary(key, picked.text, lesson.title_en);
      await record(sb, 'lesson_summary', r.input, r.output);
      if (r.summary) return { ok: true as const, teamId, summary: r.summary, preview: false, source: fileText ? 'file' as const : picked.from, partial };
      return { ok: false as const, error: 'failed' };
    } catch (e) { console.error('[summary] failed', e); return { ok: false as const, error: 'failed' }; }
  });

/** Personal, deterministic brief. All reads run as the caller; no AI or stored daily snapshots. */
export const getDailyBrief = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ lang, tz: z.string().min(1).max(64) }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase, uid = context.userId;
    try { new Intl.DateTimeFormat('en-US', { timeZone: data.tz }).format(); } catch { throw new Error('Invalid timezone'); }
    const now = new Date().toISOString();
    const from = new Date(Date.now() - 8 * 864e5).toISOString();
    const checked = <T,>(result: { data: T; error: { message: string } | null }): T => {
      if (result.error) throw new Error('Could not load your morning brief');
      return result.data;
    };
    const home = checked(await sb.rpc('personal_home')) as unknown as import('@/lib/personal-home').PersonalHome;
    const events: BriefEvent[] = home.mode === 'hosting' ? home.events.map(e => ({ id: e.id, host_id: uid, team_id: null, title: e.title, starts_at: e.starts_at, location_name: e.location_name, status: e.status, going: 0 })) : [];
    for (const event of events) event.going = Number(checked(await sb.rpc('event_going_count', { _event_id: event.id })) ?? 0);
    const attending = home.mode === 'attending' ? home.events.filter(e => e.registration_status === 'going').map(e => ({ event: { id: e.id, host_id: '', team_id: null, title: e.title, starts_at: e.starts_at, location_name: e.location_name, status: e.status, going: 0 }, code: null })) : [];
    const signups = events.length ? checked(await sb.from('rsvps').select('event_id,created_at').in('event_id', events.map(e => e.id)).eq('status', 'going').gte('created_at', from)) ?? [] : [];
    return { lines: buildMorningBrief({ userId: uid, now, timezone: data.tz, events, attending, signups, leaderTeams: [], teamName: '', hosts: [], resources: [] }) };
  });

/** Bilingual share caption (English then Spanish). Claude when the key exists, otherwise a warm preview caption. */
export const shareCaption = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ title: z.string().min(1).max(200), whenEn: z.string().max(120), whenEs: z.string().max(120), place: z.string().max(200), link: z.string().url().max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    const { claude, parseJson, hasClaim } = await import('@/lib/ai/smart.server');
    const sample = { en: `Join me for ${data.title}, ${data.whenEn}${data.place ? ` at ${data.place}` : ''}. Come as you are and bring a friend. Save your spot: ${data.link}`, es: `Acompáñame a ${data.title}, ${data.whenEs}${data.place ? ` en ${data.place}` : ''}. Ven tal como eres y trae a alguien. Aparta tu lugar: ${data.link}` };
    const key = process.env['ANTHROPIC_API_KEY'];
    if (key && await underLimit(context.supabase)) {
      try {
        const r = await claude(key, 'Write a short social caption inviting people to a community gathering. Return JSON {"en":"...","es":"..."}; es is natural Latin American Spanish. Max 240 characters each. Each must end with the link exactly as given.', JSON.stringify(data), 600);
        await record(context.supabase, 'share_caption', r.input, r.output);
        const j = parseJson<{ en: string; es: string }>(r.text);
        if (j?.en && j?.es && !hasClaim(j.en + j.es)) return { ...j, preview: false };
      } catch (e) { console.error('[caption] failed', e); }
    }
    return { ...sample, preview: !key };
  });
