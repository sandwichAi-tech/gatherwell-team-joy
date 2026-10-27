import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type TeamState = { team_id: string; name: string; slug: string; owner: boolean; role: string; status: string; access: boolean; requested_at: string | null; joined_at: string | null };
export type ManagedMember = { user_id: string; name: string | null; slug: string | null; role: string; status: string; requested_at: string | null; joined_at?: string | null; decided_at?: string | null };
export const splitMyTeams = (rows: TeamState[]) => ({ lead: rows.filter(t => t.owner), belong: rows.filter(t => !t.owner) });
export const privateTeamLink = (team: TeamState) => team.access && team.status === 'approved' ? { team: team.team_id } : null;
export const myTeamStatesQuery = (userId: string) => queryOptions({ queryKey: ['my-team-states', userId], staleTime: 0, gcTime: 0, refetchInterval: 10_000, queryFn: async () => {
  const { data, error } = await supabase.rpc('my_team_states'); if (error) throw error; return data as unknown as TeamState[];
} });
export const managementQuery = (teamId: string, userId: string) => queryOptions({ queryKey: ['team-management', teamId, userId], staleTime: 0, gcTime: 0, retry: false, refetchInterval: 10_000, queryFn: async () => {
  const { data, error } = await supabase.rpc('team_member_management', { _team: teamId }); if (error) throw error; return data as unknown as { members: ManagedMember[]; requests: ManagedMember[] };
} });