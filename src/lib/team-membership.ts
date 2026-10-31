import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { teamCallerQuery } from './team-query-boundary';

export type TeamState = { team_id: string; name: string; slug: string; owner: boolean; role: string; status: string; access: boolean; requested_at: string | null; joined_at: string | null };
export type ManagedMember = { user_id: string; name: string | null; slug: string | null; role: string; status: string; requested_at: string | null; joined_at?: string | null; decided_at?: string | null };
export const splitMyTeams = (rows: TeamState[]) => ({ lead: rows.filter(t => t.owner), belong: rows.filter(t => !t.owner) });
export const privateTeamLink = (team: TeamState) => team.access && team.status === 'approved' ? { team: team.team_id } : null;
export const myTeamStatesQuery = (userId: string) => queryOptions({ queryKey: ['my-team-states', userId], staleTime: 0, gcTime: 0, refetchInterval: 3_000, queryFn: ({ signal }) => teamCallerQuery(userId, signal, async () => {
  const { data, error } = await supabase.rpc('my_team_states'); if (error) throw error; return data as unknown as TeamState[];
}) });
export const managementQuery = (teamId: string, userId: string) => queryOptions({ queryKey: ['team-management', teamId, userId], staleTime: 0, gcTime: 0, retry: false, refetchInterval: 3_000, queryFn: ({ signal }) => teamCallerQuery(userId, signal, async () => {
  const { data, error } = await supabase.rpc('team_member_management', { _team: teamId }); if (error) throw error; return data as unknown as { members: ManagedMember[]; requests: ManagedMember[] };
}) });

export type TeamRoster = 'members' | 'requests';
export const teamRosterLink = (team: TeamState, roster: TeamRoster) => team.owner && privateTeamLink(team) ? { team: team.team_id, panel: 'members' as const, roster } : null;
export const rosterRows = (data: { members: ManagedMember[]; requests: ManagedMember[] }, roster: TeamRoster) =>
  roster === 'members' ? data.members.filter(m => m.status === 'approved') : data.requests.filter(m => m.status === 'pending');