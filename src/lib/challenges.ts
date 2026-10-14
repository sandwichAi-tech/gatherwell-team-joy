import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

export type Challenge = Database['public']['Tables']['challenges']['Row'];
export type Phase = 'active' | 'upcoming' | 'past';
export const STARTERS = ['consistency', 'walk', 'hydration', 'morning'] as const;
export type Starter = typeof STARTERS[number];
export const STARTER_DAYS: Record<Starter, number> = { consistency: 21, walk: 14, hydration: 7, morning: 21 };

export const userTz = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
/** YYYY-MM-DD in the member's time zone. */
export const localDate = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: userTz(), year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
export const localHour = () => Number(new Intl.DateTimeFormat('en-US', { timeZone: userTz(), hour: 'numeric', hourCycle: 'h23' }).format(new Date()));
export const addDays = (iso: string, n: number) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const daysBetween = (a: string, b: string) => Math.round((new Date(`${b}T12:00:00Z`).getTime() - new Date(`${a}T12:00:00Z`).getTime()) / 86_400_000);
export const lengthOf = (c: Pick<Challenge, 'starts_on' | 'ends_on'>) => daysBetween(c.starts_on, c.ends_on) + 1;
export const phaseOf = (c: Challenge, today = localDate()): Phase => (today < c.starts_on ? 'upcoming' : today > c.ends_on ? 'past' : 'active');
export const dayNumber = (c: Challenge, today = localDate()) => Math.min(lengthOf(c), Math.max(1, daysBetween(c.starts_on, today) + 1));
export const pick = (lang: string | undefined, en?: string | null, es?: string | null) => (lang === 'es' ? es || en : en || es) || '';
export const titleOf = (c: Pick<Challenge, 'title_en' | 'title_es'>, lang?: string) => pick(lang, c.title_en, c.title_es);

/** Challenges for the active team and its parent teams, with joined counts and the caller's membership. */
export const challengesQuery = (userId: string, teamIds: string[]) => queryOptions({
  queryKey: ['challenges', userId, teamIds.join(',')],
  enabled: teamIds.length > 0,
  queryFn: async () => {
    const { data, error } = await supabase.from('challenges').select('*').in('team_id', teamIds).order('starts_on', { ascending: false });
    if (error) throw error;
    const list = data ?? [];
    const ids = list.map(c => c.id);
    const [{ data: counts }, { data: mine }] = await Promise.all([
      ids.length ? supabase.rpc('challenge_counts', { _ids: ids }) : Promise.resolve({ data: [] as { challenge_id: string; members: number }[] }),
      supabase.from('challenge_members').select('challenge_id').eq('user_id', userId),
    ]);
    const countMap = new Map((counts ?? []).map(r => [r.challenge_id, r.members]));
    const joined = new Set((mine ?? []).map(r => r.challenge_id));
    return list.map(c => ({ ...c, members: countMap.get(c.id) ?? 0, joined: joined.has(c.id) }));
  },
});
export type ChallengeItem = Challenge & { members: number; joined: boolean };

export const myCheckinsQuery = (userId: string, challengeId: string) => queryOptions({
  queryKey: ['challenge-checkins', userId, challengeId],
  queryFn: async () => {
    const { data, error } = await supabase.from('challenge_checkins').select('checkin_date, note, photo_path, created_at').eq('challenge_id', challengeId).eq('user_id', userId).order('checkin_date');
    if (error) throw error;
    return data ?? [];
  },
});

export const leaderboardQuery = (challengeId: string) => queryOptions({
  queryKey: ['challenge-board', challengeId],
  refetchInterval: 20_000,
  queryFn: async () => {
    const { data, error } = await supabase.rpc('challenge_leaderboard', { _c: challengeId, _tz: userTz() });
    if (error) throw error;
    return data ?? [];
  },
});

/** Current streak ends at the latest check-in when that is today or yesterday; best is the longest run. */
export function streaksOf(dates: string[], today = localDate()) {
  const sorted = [...new Set(dates)].sort();
  let best = 0, run = 0, prev: string | null = null;
  for (const d of sorted) { run = prev && daysBetween(prev, d) === 1 ? run + 1 : 1; best = Math.max(best, run); prev = d; }
  const current = prev && daysBetween(prev, today) <= 1 ? run : 0;
  return { current, best, total: sorted.length };
}

export async function challengePhotoUrls(paths: string[]) {
  if (!paths.length) return [];
  const { data } = await supabase.storage.from('challenge-photos').createSignedUrls(paths, 3600);
  return (data ?? []).map(r => r.signedUrl).filter((u): u is string => !!u);
}

export function rpcErrorKey(error: unknown) {
  const m = typeof error === 'object' && error && 'message' in error ? String((error as { message: unknown }).message) : '';
  if (m.includes('payouts_required')) return 'billing.payoutsRequired';
  for (const k of ['not_joined', 'date_closed', 'out_of_range', 'invalid_message', 'not_allowed']) if (m.includes(k)) return `challenges.err.${k}`;
  return 'profile.saveError';
}
