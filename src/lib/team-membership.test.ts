import { describe, expect, it } from 'vitest';
import { splitMyTeams, privateTeamLink, teamRosterLink, rosterRows, type TeamState } from './team-membership';
import { mePanelFromSearch } from './profile-ia';

const team = (changes: Partial<TeamState> = {}): TeamState => ({ team_id: 'team-a', name: 'Team A', slug: 'team-a', owner: false, role: 'member', status: 'approved', access: true, requested_at: null, joined_at: null, ...changes });
describe('My teams membership rules', () => {
  it('separates authoritative ownership from legacy leader label', () => {
    const owner = team({ owner: true }); const legacyLeader = team({ team_id: 'b', role: 'leader' });
    expect(splitMyTeams([owner, legacyLeader])).toEqual({ lead: [owner], belong: [legacyLeader] });
  });
  it.each(['pending', 'declined', 'removed', 'suspended', 'unavailable'])('%s never opens private team', status => expect(privateTeamLink(team({ status }))).toBeNull());
  it('requires authoritative access even for an approved status', () => expect(privateTeamLink(team({ access: false }))).toBeNull());
  it('approved direct membership opens its own team only', () => expect(privateTeamLink(team())).toEqual({ team: 'team-a' }));
  it('My teams is an allowed notification destination', () => expect(mePanelFromSearch('teams')).toBe('teams'));
  it('member/request counts link to the exact named owner team and roster', () => {
    expect(teamRosterLink(team({ owner: true, team_id: 'ZZ-TEST-B' }), 'requests')).toEqual({ team: 'ZZ-TEST-B', panel: 'members', roster: 'requests' });
    expect(teamRosterLink(team({ owner: true }), 'members')).toEqual({ team: 'team-a', panel: 'members', roster: 'members' });
    expect(teamRosterLink(team(), 'members')).toBeNull();
  });
  it('counts and roster rows use identical pending/approved filters', () => {
    const member = { user_id: 'coach', name: 'Coach', slug: null, role: 'host', status: 'approved', requested_at: null };
    const data = { members: [member, { ...member, user_id: 'removed', status: 'removed' }], requests: [{ ...member, status: 'pending' }, { ...member, status: 'declined' }] };
    expect(rosterRows(data, 'members').map(m => m.user_id)).toEqual(['coach']);
    expect(rosterRows(data, 'requests').map(m => m.status)).toEqual(['pending']);
  });
});