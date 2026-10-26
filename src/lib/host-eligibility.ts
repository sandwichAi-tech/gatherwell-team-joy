import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { teamsQuery, type TeamMembership } from '@/lib/account';

/** Team roles that already carry hosting permissions (mirrors builder-seat roles). */
const HOST_TEAM_ROLES = new Set(['leader', 'host']);
const HOST_WORKSPACE_ROLES = new Set(['owner', 'admin', 'host', 'content_editor']);

/**
 * Whether an account may return to hosting without re-registering. Decided only from authoritative
 * server rows (active team memberships, team ownership, events they host) — never from the selected
 * view mode, which is display-only. Platform admin is deliberately not a hosting permission.
 */
export function canSwitchToHost(userId: string, teams: Pick<TeamMembership, 'role' | 'workspaceRole' | 'ownerId'>[], hostedEvents: number): boolean {
  if (hostedEvents > 0) return true;
  return teams.some(team => team.ownerId === userId || HOST_TEAM_ROLES.has(team.role) || HOST_WORKSPACE_ROLES.has(team.workspaceRole));
}

export const hostEligibilityQuery = (userId: string) => queryOptions({
  queryKey: ['host-eligibility', userId],
  queryFn: async ({ client }) => {
    const [teams, events] = await Promise.all([
      client.fetchQuery(teamsQuery(userId)),
      supabase.from('events').select('id', { count: 'exact', head: true }).eq('host_id', userId),
    ]);
    if (events.error) throw events.error;
    return canSwitchToHost(userId, teams, events.count ?? 0);
  },
});
