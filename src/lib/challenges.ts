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
export const localDate = (d = new Date(), timezone = userTz()) => new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
export const localHour = (timezone = userTz()) => Number(new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', hourCycle: 'h23' }).format(new Date()));
export const addDays = (iso: string, n: number) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const daysBetween = (a: string, b: string) => Math.round((new Date(`${b}T12:00:00Z`).getTime() - new Date(`${a}T12:00:00Z`).getTime()) / 86_400_000);
export const lengthOf = (c: Pick<Challenge, 'starts_on' | 'ends_on'>) => daysBetween(c.starts_on, c.ends_on) + 1;
export const phaseOf = (c: Challenge, today = localDate(new Date(), c.timezone ?? 'UTC')): Phase => (today < c.starts_on ? 'upcoming' : today > c.ends_on ? 'past' : 'active');
export const dayNumber = (c: Challenge, today = localDate(new Date(), c.timezone ?? 'UTC')) => Math.min(lengthOf(c), Math.max(1, daysBetween(c.starts_on, today) + 1));
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

export const leaderboardQuery = (challengeId: string, userId: string) => queryOptions({
  queryKey: ['challenge-board', challengeId, userId],
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
  for (const k of ['checkout_setup_required', 'access_revoked', 'challenge_full', 'addon_sold_out', 'note_required', 'invalid_price', 'invalid_rules', 'invalid_activities', 'invalid_messages', 'invalid_addons', 'not_joined', 'date_closed', 'out_of_range', 'invalid_message', 'not_allowed']) if (m.includes(k)) return `challenges.err.${k}`;
  return 'profile.saveError';
}

/* ---------- Dynamic challenge models, activities and messages ---------- */

export const CHALLENGE_MODELS = ['streak', 'goal', 'points'] as const;
export type ChallengeModel = (typeof CHALLENGE_MODELS)[number];
export const modelOf = (c: { model?: string | null }): ChallengeModel =>
  (CHALLENGE_MODELS as readonly string[]).includes(c.model ?? '') ? (c.model as ChallengeModel) : 'streak';

/** Goal model: progress toward a target number of check-ins. */
export function goalProgress(target: number | null | undefined, total: number) {
  const t = target && target > 0 ? target : 0;
  return { target: t, done: Math.min(total, t || total), pct: t ? Math.min(1, total / t) : 0, complete: t > 0 && total >= t };
}

export type ChallengeActivity = {
  id?: string; title_en: string; title_es: string; instructions_en?: string | null; instructions_es?: string | null;
  day_offset: number | null; sort_order: number; requires_checkin: boolean; requires_note: boolean;
  due_hour: number | null; link_url: string | null; resource_kind: string | null; resource_id: string | null; file_path: string | null;
};

/** Activities a participant sees on a given challenge day: day-specific first, then throughout. */
export function activitiesForDay(acts: ChallengeActivity[], day: number) {
  return acts
    .filter(a => a.day_offset == null || a.day_offset === day)
    .sort((a, b) => (a.day_offset == null ? 1 : 0) - (b.day_offset == null ? 1 : 0) || a.sort_order - b.sort_order);
}

export const MESSAGE_KINDS = ['welcome', 'start_reminder', 'daily_prompt', 'checkin_reminder', 'announcement', 'completion'] as const;
export type ChallengeMessageKind = (typeof MESSAGE_KINDS)[number];

export type ChallengeMessage = {
  id?: string; kind: ChallengeMessageKind; send_offset_days: number; send_hour: number;
  title_en: string; title_es: string; body_en: string; body_es: string;
  channel: string; enabled: boolean; paused: boolean; sort_order: number;
};

/**
 * When a message goes out, as a YYYY-MM-DD challenge-local date.
 * welcome is relative to the join date, completion to the end date, everything else to the start date.
 */
export function messageSendDate(kind: ChallengeMessageKind, offset: number, startsOn: string, endsOn: string, joinDate?: string): string {
  if (kind === 'welcome') return addDays(joinDate ?? startsOn, offset);
  if (kind === 'completion') return addDays(endsOn, offset);
  return addDays(startsOn, offset);
}

/** Lifecycle label: draft overrides the date-based phase. */
export const lifecycleOf = (c: { status?: string | null }, phase: Phase): 'draft' | Phase =>
  c.status === 'draft' ? 'draft' : phase;

/** Validation issues for the builder; only fields relevant to the chosen model are checked. */
export function challengeIssues(f: {
  title_en: string; title_es: string; starts_on: string; ends_on: string;
  model: ChallengeModel; goal_target: string; capacity: string;
}, today: string): string[] {
  const out: string[] = [];
  if (!f.title_en.trim() && !f.title_es.trim()) out.push('title');
  if (!f.starts_on) out.push('start');
  if (!f.ends_on || f.ends_on < f.starts_on) out.push('end');
  if (f.model === 'goal' && (!Number(f.goal_target) || Number(f.goal_target) < 1)) out.push('goal');
  if (f.capacity && Number(f.capacity) < 1) out.push('capacity');
  return out;
}

/** A message row is sendable configuration only when it has text in at least one language. */
export const messageHasContent = (m: Pick<ChallengeMessage, 'title_en' | 'title_es' | 'body_en' | 'body_es'>) =>
  !!(m.title_en.trim() || m.title_es.trim() || m.body_en.trim() || m.body_es.trim());
