import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const JOIN_CODE_KEY = 'gatherwell-join-code';

export type Workspace = { teamId: string; name: string; plan: string; joinCode: string; role: string; ownerId: string } | null;

export async function getUserId() {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export const profileQuery = (userId: string) => queryOptions({
  queryKey: ['profile', userId],
  queryFn: async () => {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (error) throw error;
    return data;
  },
});

export const workspaceQuery = (userId: string) => queryOptions({
  queryKey: ['workspace', userId],
  queryFn: async (): Promise<Workspace> => {
    const { data, error } = await supabase
      .from('team_members')
      .select('role, joined_at, teams(id, name, plan, join_code, owner_id)')
      .eq('user_id', userId)
      .order('joined_at', { ascending: true });
    if (error) throw error;
    const rows = (data ?? []).filter(row => row.teams);
    const pick = rows.find(row => row.role === 'leader') ?? rows[0];
    if (!pick || !pick.teams) return null;
    const team = pick.teams as { id: string; name: string; plan: string; join_code: string; owner_id: string };
    return { teamId: team.id, name: team.name, plan: team.plan, joinCode: team.join_code, role: pick.role, ownerId: team.owner_id };
  },
});

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

export async function uploadMedia(userId: string, file: File, kind: 'avatar' | 'cover') {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const path = `${userId}/${kind}-${Date.now()}.${ext}`;
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
