import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const JOIN_CODE_KEY = 'gatherwell-join-code';

export type Workspace = TeamMembership | null;

export async function getUserId() {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export const profileQuery = (userId: string) => queryOptions({
  queryKey: ['profile', userId],
  queryFn: async () => {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (error) throw error;
    if (data) return data;
    const { data: created, error: insertError } = await supabase.from('profiles').insert({ id: userId }).select('*').single();
    if (insertError) throw insertError;
    return created;
  },
});

export type TeamMembership = { teamId: string; name: string; plan: string; joinCode: string; role: string; ownerId: string; customBadge: string | null; inherited?: boolean };

export const teamsQuery = (userId: string) => queryOptions({
  queryKey: ['teams', userId],
  queryFn: async (): Promise<TeamMembership[]> => {
    const { data, error } = await supabase
      .from('team_members')
      .select('role, custom_badge, joined_at, teams(id, name, plan, join_code, owner_id)')
      .eq('user_id', userId)
      .order('joined_at', { ascending: true });
    if (error) throw error;
    return (data ?? []).filter(row => row.teams).map(row => {
      const team = row.teams as { id: string; name: string; plan: string; join_code: string; owner_id: string };
      return { teamId: team.id, name: team.name, plan: team.plan, joinCode: team.join_code, role: row.role, ownerId: team.owner_id, customBadge: row.custom_badge };
    });
  },
});

/** The active team: the profile's saved choice when still a member, otherwise the first leader team, otherwise the first team. */
export const workspaceQuery = (userId: string) => queryOptions({
  queryKey: ['workspace', userId],
  queryFn: async ({ client }): Promise<Workspace> => {
    const [teams, profile] = await Promise.all([client.fetchQuery(teamsQuery(userId)), client.fetchQuery(profileQuery(userId))]);
    const saved = profile?.active_team_id;
    const member = teams.find(team => team.teamId === saved);
    if (member) return member;
    if (saved) {
      // Leaders of a parent team can open sub-teams they are not directly in; they act there as leader.
      const { data } = await supabase.from('teams').select('id, name, plan, join_code, owner_id').eq('id', saved).maybeSingle();
      if (data) return { teamId: data.id, name: data.name, plan: data.plan, joinCode: data.join_code, role: 'leader', ownerId: data.owner_id, customBadge: null, inherited: true };
    }
    return teams.find(team => team.role === 'leader') ?? teams[0] ?? null;
  },
});

export async function setActiveTeam(userId: string, teamId: string) {
  const { error } = await supabase.from('profiles').update({ active_team_id: teamId }).eq('id', userId);
  if (error) throw error;
}

export function initialsOf(name?: string | null) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '·';
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '')).toUpperCase();
}
export const firstName = (name?: string | null) => (name ?? '').trim().split(/\s+/)[0] ?? '';

export function joinLink(code: string) {
  return `${window.location.origin}/join/${code}`;
}

/** Accepts a bare code or a pasted invite link like https://…/join/ABC123 */
export function parseJoinCode(input: string) {
  const value = input.trim();
  const match = value.match(/\/join\/([A-Za-z0-9]+)/);
  return ((match ? match[1] : value) ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

export async function uploadMedia(userId: string, file: File, kind: 'avatar' | 'cover' | 'announcement', at?: string) {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const path = at ?? `${userId}/${kind}-${Date.now()}.${ext}`;
  const { data: room } = await supabase.rpc('storage_allows', { _bytes: file.size });
  if (room === false) throw new Error('storage_limit');
  const { error } = await supabase.storage.from('media').upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  return path;
}

export async function mediaUrl(path?: string | null) {
  if (!path) return null;
  if (/^https?:/.test(path)) return path;
  const { data } = await supabase.storage.from('media').createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}
