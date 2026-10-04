import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

export type Gathering = Database['public']['Tables']['events']['Row'] & { going?: number };
export type EventsTab = 'upcoming' | 'hosting' | 'past';

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
    if (tab === 'hosting') q = q.eq('host_id', userId).gte('starts_at', now).order('starts_at');
    else if (tab === 'upcoming') q = q.in('team_id', teamIds.length ? teamIds : ['00000000-0000-0000-0000-000000000000']).eq('status', 'published').gte('starts_at', now).order('starts_at');
    else q = q.in('team_id', teamIds.length ? teamIds : ['00000000-0000-0000-0000-000000000000']).neq('status', 'draft').lt('starts_at', now).order('starts_at', { ascending: false });
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

export function shareLink(e: Pick<Gathering, 'id' | 'visibility'>) {
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
  for (const key of ['invalid_title', 'date_required', 'invalid_url', 'invalid_capacity', 'invalid_duration', 'not_allowed', 'template_not_found', 'too_long']) if (m.includes(key)) return t(`gathering.errors.${key}`);
  return t('profile.saveError');
}
