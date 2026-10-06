import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type ProfileStats = { hosted: number; attended: number; streak: number; badges: number };

const weekKey = (d: Date) => { const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7)); return x.getTime(); };
const WEEK = 7 * 864e5;

/** Consecutive weeks with a check-in, ending this week or last week. */
export function streakOf(dates: string[]) {
  const weeks = new Set(dates.map(d => weekKey(new Date(d))));
  let cur = weekKey(new Date());
  if (!weeks.has(cur)) cur -= WEEK;
  let n = 0; while (weeks.has(cur)) { n++; cur -= WEEK; }
  return n;
}

/** Activity-only profile stats. Rows the viewer can't read simply count as zero. */
export const profileStatsQuery = (userId: string, teamId?: string | null) => queryOptions({
  queryKey: ['profile-stats', userId, teamId ?? null],
  queryFn: async (): Promise<ProfileStats> => {
    const now = new Date().toISOString();
    const [hosted, checks, badges] = await Promise.all([
      supabase.from('events').select('id', { count: 'exact', head: true }).eq('host_id', userId).eq('status', 'published').lt('starts_at', now),
      supabase.from('rsvps').select('checked_in_at').eq('user_id', userId).not('checked_in_at', 'is', null).limit(1000),
      teamId ? supabase.from('user_badges').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('team_id', teamId) : supabase.from('user_badges').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    ]);
    const dates = (checks.data ?? []).map(r => r.checked_in_at!).filter(Boolean);
    return { hosted: hosted.count ?? 0, attended: dates.length, streak: streakOf(dates), badges: badges.count ?? 0 };
  },
  staleTime: 60_000,
});

export type RecentBadge = { id: string; icon: string; name_en: string; name_es: string; tier: string };
export const recentBadgesQuery = (userId: string, teamId?: string | null) => queryOptions({
  queryKey: ['recent-badges', userId, teamId ?? null],
  queryFn: async (): Promise<RecentBadge[]> => {
    let q = supabase.from('user_badges').select('id, awarded_at, badge:badges(icon, name_en, name_es, tier)').eq('user_id', userId).order('awarded_at', { ascending: false }).limit(6);
    if (teamId) q = q.eq('team_id', teamId);
    const { data } = await q;
    return (data ?? []).flatMap(r => r.badge ? [{ id: r.id, ...(r.badge as { icon: string; name_en: string; name_es: string; tier: string }) }] : []);
  },
  staleTime: 60_000,
});

export type MyGathering = { id: string; title: string; starts_at: string; location_name: string | null; status: string; hosting: boolean };
export const myGatheringsQuery = (userId: string) => queryOptions({
  queryKey: ['my-gatherings', userId],
  queryFn: async (): Promise<MyGathering[]> => {
    const [hosted, going] = await Promise.all([
      supabase.from('events').select('id, title, starts_at, location_name, status').eq('host_id', userId).neq('status', 'cancelled').order('starts_at', { ascending: false }).limit(100),
      supabase.from('rsvps').select('event:events(id, title, starts_at, location_name, status)').eq('user_id', userId).in('status', ['going', 'waitlist']).limit(100),
    ]);
    if (hosted.error) throw hosted.error;
    const map = new Map<string, MyGathering>();
    for (const r of going.data ?? []) { const e = r.event as Omit<MyGathering, 'hosting'> | null; if (e) map.set(e.id, { ...e, hosting: false }); }
    for (const e of hosted.data ?? []) map.set(e.id, { ...e, hosting: true });
    return [...map.values()].sort((a, b) => b.starts_at.localeCompare(a.starts_at));
  },
});

export type MyChallenge = { id: string; title_en: string; title_es: string; starts_on: string; ends_on: string };
export const myChallengesQuery = (userId: string) => queryOptions({
  queryKey: ['my-challenges', userId],
  queryFn: async (): Promise<MyChallenge[]> => {
    const { data, error } = await supabase.from('challenge_members').select('challenge:challenges(id, title_en, title_es, starts_on, ends_on)').eq('user_id', userId).limit(100);
    if (error) throw error;
    return (data ?? []).flatMap(r => r.challenge ? [r.challenge as MyChallenge] : []).sort((a, b) => b.starts_on.localeCompare(a.starts_on));
  },
});
