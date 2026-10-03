import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const teamKey = (teamId: string) => ['team', teamId] as const;

export const teamDetailQuery = (teamId: string) => queryOptions({
  queryKey: [...teamKey(teamId), 'detail'],
  queryFn: async () => {
    const { data, error } = await supabase.from('teams').select('*').eq('id', teamId).single();
    if (error) throw error;
    return data;
  },
});

export type TreeNode = { id: string; name: string; parent_team_id: string | null; depth: number; leader_name: string | null; member_count: number; events_this_month: number };
export const teamTreeQuery = (teamId: string) => queryOptions({
  queryKey: [...teamKey(teamId), 'tree'],
  queryFn: async (): Promise<TreeNode[]> => {
    const { data, error } = await supabase.rpc('team_tree', { _root: teamId });
    if (error) throw error;
    return data ?? [];
  },
});

export type Member = { userId: string; role: string; customBadge: string | null; joinedAt: string; name: string | null };
export const rosterQuery = (teamId: string) => queryOptions({
  queryKey: [...teamKey(teamId), 'roster'],
  queryFn: async (): Promise<Member[]> => {
    const { data, error } = await supabase.from('team_members').select('user_id, role, custom_badge, joined_at').eq('team_id', teamId).order('joined_at');
    if (error) throw error;
    const names = await profileNames((data ?? []).map(row => row.user_id));
    const order = { leader: 0, host: 1, member: 2 } as Record<string, number>;
    return (data ?? []).map(row => ({ userId: row.user_id, role: row.role, customBadge: row.custom_badge, joinedAt: row.joined_at, name: names.get(row.user_id) ?? null }))
      .sort((a, b) => (order[a.role] ?? 3) - (order[b.role] ?? 3));
  },
});

async function profileNames(ids: (string | null)[]) {
  const unique = [...new Set(ids.filter((id): id is string => !!id))];
  const map = new Map<string, string | null>();
  if (!unique.length) return map;
  const { data } = await supabase.from('profiles').select('id, full_name').in('id', unique);
  (data ?? []).forEach(row => map.set(row.id, row.full_name));
  return map;
}

export type TeamEvent = { id: string; team_id: string; title: string; starts_at: string; location_name: string | null; online_url: string | null; status: string; visibility: string; capacity: number | null; going?: number };
const eventColumns = 'id, team_id, title, starts_at, location_name, online_url, status, visibility, capacity';

export const upcomingQuery = (teamId: string) => queryOptions({
  queryKey: [...teamKey(teamId), 'upcoming'],
  queryFn: async (): Promise<TeamEvent[]> => {
    const { data, error } = await supabase.from('events').select(eventColumns).eq('team_id', teamId).neq('status', 'cancelled')
      .gte('starts_at', new Date().toISOString()).order('starts_at').limit(3);
    if (error) throw error;
    return Promise.all((data ?? []).map(async event => {
      const { data: going } = await supabase.rpc('event_going_count', { _event_id: event.id });
      return { ...event, going: going ?? 0 };
    }));
  },
});

export const calendarQuery = (teamId: string, teamIds: string[]) => queryOptions({
  queryKey: [...teamKey(teamId), 'calendar', teamIds.join(',')],
  enabled: teamIds.length > 0,
  queryFn: async (): Promise<TeamEvent[]> => {
    const since = new Date(); since.setMonth(since.getMonth() - 2, 1);
    const { data, error } = await supabase.from('events').select(eventColumns).in('team_id', teamIds).neq('status', 'cancelled')
      .gte('starts_at', since.toISOString()).order('starts_at').limit(300);
    if (error) throw error;
    return data ?? [];
  },
});

export type Win = { id: string; type: string; created_at: string; actorId: string | null; actorName: string | null; payload: Record<string, unknown>; reactions: Record<'like' | 'celebrate' | 'heart', { count: number; mine: boolean }> };
export const winsQuery = (teamId: string, userId: string) => queryOptions({
  queryKey: [...teamKey(teamId), 'wins'],
  queryFn: async (): Promise<Win[]> => {
    const { data, error } = await supabase.from('activity').select('id, type, created_at, actor_id, payload').eq('team_id', teamId)
      .neq('type', 'rsvp_created').order('created_at', { ascending: false }).limit(30);
    if (error) throw error;
    const rows = data ?? [];
    const [names, reactions] = await Promise.all([
      profileNames(rows.map(row => row.actor_id)),
      rows.length ? supabase.from('activity_reactions').select('activity_id, user_id, kind').in('activity_id', rows.map(row => row.id)) : Promise.resolve({ data: [] as { activity_id: string; user_id: string; kind: string }[] }),
    ]);
    return rows.map(row => {
      const mine = (reactions.data ?? []).filter(r => r.activity_id === row.id);
      const tally = (kind: string) => ({ count: mine.filter(r => r.kind === kind).length, mine: mine.some(r => r.kind === kind && r.user_id === userId) });
      return { id: row.id, type: row.type, created_at: row.created_at, actorId: row.actor_id, actorName: row.actor_id ? names.get(row.actor_id) ?? null : null,
        payload: (row.payload ?? {}) as Record<string, unknown>, reactions: { like: tally('like'), celebrate: tally('celebrate'), heart: tally('heart') } };
    });
  },
});

export const announcementsQuery = (teamId: string) => queryOptions({
  queryKey: [...teamKey(teamId), 'announcements'],
  queryFn: async () => {
    const { data, error } = await supabase.from('announcements').select('*').eq('team_id', teamId).order('created_at', { ascending: false }).limit(10);
    if (error) throw error;
    return data ?? [];
  },
});

export function relativeTime(iso: string, lang: string) {
  const diff = (new Date(iso).getTime() - Date.now()) / 1000;
  const fmt = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
  const steps: [number, Intl.RelativeTimeFormatUnit][] = [[60, 'second'], [3600, 'minute'], [86400, 'hour'], [604800, 'day'], [2629800, 'week'], [31557600, 'month']];
  const abs = Math.abs(diff);
  if (abs < 60) return fmt.format(0, 'second');
  for (let i = 1; i < steps.length; i++) { const [limit, unit] = steps[i]!; if (abs < limit) return fmt.format(Math.round(diff / steps[i - 1]![0]), unit); }
  return fmt.format(Math.round(diff / 31557600), 'year');
}

export const TEAM_COLORS = ['#2F2340', '#7A5FA8', '#2E9E6B', '#B4693E', '#3E6A9E', '#9E4A73'] as const;
