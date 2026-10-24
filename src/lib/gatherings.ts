import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

export type Gathering = Database['public']['Tables']['events']['Row'] & { going?: number };
export type EventsTab = 'upcoming' | 'hosting' | 'past' | 'tickets';

/** Six refined default covers (plum → lavender family). Index is stored in events.cover_style. */
export const COVER_STYLES = [
  'linear-gradient(135deg, #2F2340 0%, #7A5FA8 100%)',
  'linear-gradient(160deg, #3B2A52 0%, #A48BC8 100%)',
  'linear-gradient(135deg, #2F2340 0%, #5B4580 55%, #F3C6A5 140%)',
  'radial-gradient(120% 120% at 0% 0%, #7A5FA8 0%, #2F2340 70%)',
  'linear-gradient(120deg, #4A3766 0%, #C9B8E3 100%)',
  'linear-gradient(200deg, #241A33 0%, #6D58A0 60%, #EFEBF6 130%)',
] as const;

const withGoing = async (rows: Gathering[]) => Promise.all(rows.map(async e => ({ ...e, going: (await supabase.rpc('event_going_count', { _event_id: e.id })).data ?? 0 })));

export const eventsTabQuery = (userId: string, teamIds: string[], tab: EventsTab) => queryOptions({
  queryKey: ['gatherings', userId, tab, teamIds.join(',')],
  queryFn: async (): Promise<Gathering[]> => {
    const now = new Date().toISOString();
    let q = supabase.from('events').select('*');
    if (tab === 'hosting') q = q.eq('host_id', userId).neq('status', 'archived').gte('starts_at', now).order('starts_at');
    else if (tab === 'upcoming') q = q.in('team_id', teamIds.length ? teamIds : ['00000000-0000-0000-0000-000000000000']).eq('status', 'published').gte('starts_at', now).order('starts_at');
    else q = q.in('team_id', teamIds.length ? teamIds : ['00000000-0000-0000-0000-000000000000']).neq('status', 'draft').neq('status', 'archived').lt('starts_at', now).order('starts_at', { ascending: false });
    const { data, error } = await q.limit(60);
    if (error) throw error;
    return withGoing(data ?? []);
  },
});

export const guestSummaryQuery = (eventId: string) => queryOptions({
  queryKey: ['event', eventId, 'guests'],
  queryFn: async () => {
    const { data, error } = await supabase.from('rsvps').select('status, plus_ones').eq('event_id', eventId);
    if (error) throw error;
    const sum = (s: string) => (data ?? []).filter(r => r.status === s).reduce((n, r) => n + 1 + (r.plus_ones ?? 0), 0);
    return { going: sum('going'), maybe: sum('maybe'), waitlist: sum('waitlist') };
  },
});

export const seriesQuery = (seriesId: string | null) => queryOptions({
  queryKey: ['series', seriesId],
  enabled: !!seriesId,
  queryFn: async () => {
    const { data, error } = await supabase.from('events').select('id, starts_at, status').eq('series_id', seriesId!).order('starts_at');
    if (error) throw error;
    return data ?? [];
  },
});

export function shareLink(e: Pick<Gathering, 'id' | 'visibility'> & { invite_token?: string | null }) {
  if (e.visibility === 'invite' && e.invite_token) return `${window.location.origin}/e/${e.id}?k=${e.invite_token}`;
  return `${window.location.origin}${e.visibility === 'public' ? '/e/' : '/event/'}${e.id}`;
}

export const isOnline = (e: Pick<Gathering, 'online_url' | 'location_name' | 'address'>) => !!e.online_url && !e.location_name && !e.address;
export const placeOf = (e: Pick<Gathering, 'online_url' | 'location_name' | 'address'>) => e.location_name || e.address || null;

/** Smart date presets, in the browser's local time. */
export function datePresets(now = new Date()) {
  const at = (d: Date, h: number) => { const x = new Date(d); x.setHours(h, 0, 0, 0); return x; };
  const tonight = at(now, 19);
  const tomorrow = at(new Date(now.getTime() + 86400000), 8);
  const sat = new Date(now); sat.setDate(now.getDate() + ((6 - now.getDay() + 7) % 7 || 7));
  const mon = new Date(now); mon.setDate(now.getDate() + ((1 - now.getDay() + 7) % 7 || 7));
  return [
    { key: 'tonight', date: tonight, show: tonight > now },
    { key: 'tomorrow', date: tomorrow, show: true },
    { key: 'saturday', date: at(sat, 8), show: true },
    { key: 'monday', date: at(mon, 19), show: true },
  ].filter(p => p.show);
}

export const toLocalInput = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function rpcError(t: (k: string) => string, error: unknown) {
  const m = typeof error === 'object' && error && 'message' in error ? String((error as { message: unknown }).message) : '';
  if (m.includes('payouts_required')) return t('billing.payoutsRequired');
  for (const key of ['invalid_title', 'date_required', 'invalid_url', 'invalid_capacity', 'invalid_duration', 'not_allowed', 'template_not_found', 'too_long']) if (m.includes(key)) return t(`gathering.errors.${key}`);
  return t('profile.saveError');
}

/** Host's most-used weekday + time (needs 2+ past gatherings, series counted once), as the next upcoming date. */
export function usualSlot(starts: { starts_at: string; series_id: string | null }[], now = new Date()): Date | null {
  const seen = new Set<string>(); const counts = new Map<string, number>();
  for (const e of starts) {
    if (e.series_id) { if (seen.has(e.series_id)) continue; seen.add(e.series_id); }
    const d = new Date(e.starts_at); const k = `${d.getDay()}-${d.getHours()}-${d.getMinutes()}`;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  let best: string | null = null; let n = 1;
  for (const [k, c] of counts) if (c > n) { best = k; n = c; }
  if (!best) return null;
  const [day, h, m] = best.split('-').map(Number) as [number, number, number];
  const d = new Date(now); d.setHours(h, m, 0, 0); d.setDate(d.getDate() + ((day - d.getDay() + 7) % 7));
  if (d <= now) d.setDate(d.getDate() + 7);
  return d;
}

export const REPEATS = ['none', 'daily', 'weekdays', 'weekly', 'biweekly', 'monthly', 'custom'] as const;
export type Repeat = typeof REPEATS[number];
export type MonthlyMode = 'date' | 'nth' | 'last';
export type RepeatRule = { kind: Repeat; monthly: MonthlyMode; days: number[]; endMode: 'count' | 'until'; count: number; until: string };

/** Expands a repeat rule into concrete start dates (local time kept), capped at 52. */
export function expandRepeat(start: Date, r: RepeatRule): Date[] {
  if (r.kind === 'none') return [start];
  const max = r.endMode === 'count' ? Math.max(1, Math.min(52, r.count)) : 52;
  const until = r.endMode === 'until' && r.until ? new Date(`${r.until}T23:59:59`) : null;
  const out: Date[] = []; const ok = (d: Date) => !until || d <= until;
  const push = (d: Date) => { if (out.length < max && ok(d)) out.push(d); };
  const at = (base: Date) => { const d = new Date(base); d.setHours(start.getHours(), start.getMinutes(), 0, 0); return d; };
  if (r.kind === 'monthly') {
    const nth = Math.floor((start.getDate() - 1) / 7); const wd = start.getDay();
    for (let i = 0; i < 400 && out.length < max; i++) {
      const y = start.getFullYear(), m = start.getMonth() + i; let d: Date | null = null;
      if (r.monthly === 'date') { const c = new Date(y, m, start.getDate()); if (c.getDate() === start.getDate()) d = c; }
      else if (r.monthly === 'nth') { const f = new Date(y, m, 1); const day = 1 + ((wd - f.getDay() + 7) % 7) + nth * 7; const c = new Date(y, m, day); if (c.getMonth() === ((m % 12) + 12) % 12) d = c; }
      else { const l = new Date(y, m + 1, 0); d = new Date(y, m, l.getDate() - ((l.getDay() - wd + 7) % 7)); }
      if (d) { const x = at(d); if (x >= start || i === 0) { if (!ok(x)) break; push(x); } }
    }
    return out.length ? out : [start];
  }
  if (r.kind === 'weekly' || r.kind === 'biweekly') {
    const step = r.kind === 'weekly' ? 7 : 14;
    for (let i = 0; out.length < max; i++) { const d = new Date(start); d.setDate(d.getDate() + i * step); if (!ok(d)) break; push(d); }
    return out;
  }
  const days = r.kind === 'daily' ? [0, 1, 2, 3, 4, 5, 6] : r.kind === 'weekdays' ? [1, 2, 3, 4, 5] : (r.days.length ? r.days : [start.getDay()]);
  for (let i = 0; i < 400 && out.length < max; i++) {
    const d = new Date(start); d.setDate(d.getDate() + i); if (!ok(d)) break;
    if (days.includes(d.getDay())) push(d);
  }
  return out.length ? out : [start];
}
