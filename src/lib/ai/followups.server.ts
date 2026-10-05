// Builds follow-up drafts for a finished gathering. Uses the admin client; callers verify access first.
import { claudeFollowups, hasClaim, sampleFollowup, type FollowCtx, type FollowGuest, type Lang } from './smart.server';

type Admin = Awaited<typeof import('@/integrations/supabase/client.server')>['supabaseAdmin'];

function whenText(iso: string, tz: string | null, lang: Lang) {
  return new Intl.DateTimeFormat(lang === 'es' ? 'es-MX' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: tz || 'America/Los_Angeles' }).format(new Date(iso));
}

export async function draftFollowupsForEvent(admin: Admin, eventId: string) {
  const { data: ev } = await admin.from('events').select('id, title, team_id, host_id, template_id, series_id, starts_at, timezone').eq('id', eventId).maybeSingle();
  if (!ev) return { created: 0 };
  const { count: existing } = await admin.from('followup_drafts').select('id', { count: 'exact', head: true }).eq('event_id', eventId);
  if (existing) return { created: 0 };

  const [{ data: host }, { data: tpl }, { data: rsvps }] = await Promise.all([
    admin.from('profiles').select('full_name').eq('id', ev.host_id).maybeSingle(),
    ev.template_id ? admin.from('templates').select('followup_script_en, followup_script_es').eq('id', ev.template_id).maybeSingle() : Promise.resolve({ data: null }),
    admin.from('rsvps').select('id, user_id, guest_name, guest_email, guest_phone, language, status, checked_in_at').eq('event_id', eventId),
  ]);
  const list = (rsvps ?? []).filter(r => r.checked_in_at || r.status === 'going');
  if (!list.length) return { created: 0 };

  // Next gathering: same series first, otherwise the host's next one on this team
  let next = null as { title: string; starts_at: string; timezone: string | null } | null;
  const nowIso = new Date().toISOString();
  if (ev.series_id) next = (await admin.from('events').select('title, starts_at, timezone').eq('series_id', ev.series_id).neq('status', 'cancelled').gt('starts_at', nowIso).order('starts_at').limit(1).maybeSingle()).data;
  if (!next) next = (await admin.from('events').select('title, starts_at, timezone').eq('team_id', ev.team_id).eq('host_id', ev.host_id).neq('status', 'cancelled').neq('visibility', 'draft').gt('starts_at', nowIso).order('starts_at').limit(1).maybeSingle()).data;

  // First time = no earlier check-in at this team's gatherings by the same person
  const { data: teamEvents } = await admin.from('events').select('id').eq('team_id', ev.team_id).lt('starts_at', ev.starts_at);
  const priorIds = (teamEvents ?? []).map(e => e.id);
  const { data: prior } = priorIds.length ? await admin.from('rsvps').select('user_id, guest_email, guest_phone').in('event_id', priorIds).not('checked_in_at', 'is', null) : { data: [] as { user_id: string | null; guest_email: string | null; guest_phone: string | null }[] };
  const seen = (r: { user_id: string | null; guest_email: string | null; guest_phone: string | null }) => (prior ?? []).some(p =>
    (r.user_id && p.user_id === r.user_id) || (r.guest_email && p.guest_email?.toLowerCase() === r.guest_email.toLowerCase()) || (r.guest_phone && p.guest_phone === r.guest_phone));

  // Names for guests with accounts
  const ids = list.map(r => r.user_id).filter(Boolean) as string[];
  const { data: people } = ids.length ? await admin.from('profiles').select('id, full_name').in('id', ids) : { data: [] as { id: string; full_name: string | null }[] };

  const guests: FollowGuest[] = list.map(r => ({
    rsvp_id: r.id,
    name: r.guest_name || people?.find(p => p.id === r.user_id)?.full_name || '',
    lang: r.language === 'es' ? 'es' : 'en',
    kind: !r.checked_in_at ? 'no_show' : seen(r) ? 'returning' : 'first_time',
  }));
  const ctx: FollowCtx = {
    host: (host?.full_name ?? '').split(/\s+/)[0] || 'Your host', title: ev.title,
    nextTitle: next?.title ?? null,
    nextWhen: next ? { en: whenText(next.starts_at, next.timezone, 'en'), es: whenText(next.starts_at, next.timezone, 'es') } : null,
    script: { en: tpl?.followup_script_en ?? null, es: tpl?.followup_script_es ?? null },
  };

  const key = process.env['ANTHROPIC_API_KEY'];
  let messages = new Map<string, string>(); let preview = !key;
  if (key) {
    try {
      const r = await claudeFollowups(key, guests, ctx);
      messages = r.messages;
      await admin.from('ai_usage').insert({ user_id: ev.host_id, feature: 'followups', input_tokens: r.input, output_tokens: r.output });
    } catch (e) { console.error('[followups] claude failed, using preview text', e); preview = true; }
  }
  const rows = guests.map(g => {
    let msg = messages.get(g.rsvp_id) ?? '';
    if (!msg || hasClaim(msg) || msg.length > 1000) msg = sampleFollowup(g, ctx);
    return { event_id: ev.id, rsvp_id: g.rsvp_id, team_id: ev.team_id, host_id: ev.host_id, guest_name: g.name, language: g.lang, kind: g.kind, message: msg, preview };
  });
  const { error } = await admin.from('followup_drafts').upsert(rows, { onConflict: 'rsvp_id', ignoreDuplicates: true });
  if (error) throw new Error(error.message);
  return { created: rows.length };
}
