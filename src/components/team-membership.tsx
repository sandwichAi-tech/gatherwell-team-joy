import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ListSkeleton, RetryState } from '@/components/launch-states';
import { ResponsiveSheet } from '@/components/responsive-sheet';
import { confirmAction } from '@/components/confirm-dialog';
import { supabase } from '@/integrations/supabase/client';
import { MemberInsightsSheet, TeamMetricSharing } from '@/components/team-metrics';
import { managementQuery, myTeamStatesQuery, splitMyTeams, privateTeamLink, rosterRows, teamRosterLink, type TeamRoster } from '@/lib/team-membership';

import { announceTeamChange } from '@/lib/team-query-boundary';

function TeamRosterCounts({ team, userId }: { team: Parameters<typeof teamRosterLink>[0]; userId: string }) {
  const { t } = useTranslation(); const q = useQuery(managementQuery(team.team_id, userId));
  if (q.isPending) return <ListSkeleton rows={1} />;
  if (q.isError) return <RetryState retry={() => void q.refetch()} />;
  return <div className="feed-actions">{(['members', 'requests'] as const).map(roster => {
    const destination = teamRosterLink(team, roster);
    return destination && <Button key={roster} asChild variant="secondary"><Link to="/team" search={destination}>{t(`teamMembership.${roster}`)}: {rosterRows(q.data, roster).length}</Link></Button>;
  })}</div>;
}

export function MyTeams({ userId }: { userId: string }) {
  const { t } = useTranslation(); const q = useQuery(myTeamStatesQuery(userId));
  if (q.isPending) return <ListSkeleton />;
  if (q.isError) return <RetryState retry={() => void q.refetch()} />;
  const groups = splitMyTeams(q.data);
  return <div className="edit-form">{(['lead', 'belong'] as const).map(group => <section key={group}>
    <h2>{t(`teamMembership.${group}`)}</h2>
    {!groups[group].length && <p className="auth-subtitle">{t(`teamMembership.empty${group}`)}</p>}
    <ul className="team-membership-list">{groups[group].map(team => <li key={team.team_id}>
      <strong>{team.name}</strong><small>{t(`roles.${team.role}`, { defaultValue: t('roles.member') })} · {t(`teamMembership.status.${team.status}`, { defaultValue: t('teamMembership.status.unavailable') })}</small>
      {privateTeamLink(team) ? <Button asChild variant="secondary"><Link to="/team" search={{ team: team.team_id }}>{t('teamMembership.open')}</Link></Button> : <p className="field-hint">{t('teamMembership.pendingHint')}</p>}
      {team.owner && privateTeamLink(team) && <TeamRosterCounts team={team} userId={userId} />}
      {group === 'belong' && privateTeamLink(team) && <TeamMetricSharing key={`${userId}:${team.team_id}`} teamId={team.team_id} userId={userId} />}
    </li>)}</ul>
  </section>)}</div>;
}

export function TeamMemberManagement({ teamId, userId, roster }: { teamId: string; userId: string; roster?: TeamRoster }) {
  const { t, i18n } = useTranslation(); const qc = useQueryClient(); const q = useQuery(managementQuery(teamId, userId));
  const [busy, setBusy] = useState(false); const [insights, setInsights] = useState<{ user_id: string; name: string | null } | null>(null);
  useEffect(() => { setInsights(null); }, [teamId, userId]);
  const decide = async (id: string, decision: 'approved' | 'declined' | 'removed') => {
    if (decision !== 'approved' && !await confirmAction({ title: t(`teamMembership.${decision}`), destructive: true })) return;
    setBusy(true); const { error } = await supabase.rpc('decide_team_request', { _team: teamId, _user: id, _decision: decision }); setBusy(false);
    if (error) { toast.error(t('teamMembership.error')); return; }
    setInsights(null); await qc.cancelQueries({ queryKey: ['team-member-insights', teamId] }); qc.removeQueries({ queryKey: ['team-member-insights', teamId] }); announceTeamChange(teamId);
    await qc.invalidateQueries({ queryKey: ['team-management', teamId] });
    for (const key of ['teams', 'workspace', 'team', 'my-team-states', 'notifications', 'notifications-unread', 'team-channel']) void qc.invalidateQueries({ queryKey: [key] });
  };
  if (q.isPending) return <ListSkeleton />;
  if (q.isError) return <><p role="status">{t('teamMembership.ownerOnly')}</p><RetryState retry={() => void q.refetch()} /></>;
  const date = (s?: string | null) => s ? new Date(s).toLocaleDateString(i18n.resolvedLanguage === 'es' ? 'es-419' : 'en-US') : '';
  return <div className="edit-form">{(roster ? [roster] : ['requests', 'members'] as const).map(group => <section key={group}>
    <h2>{t(`teamMembership.${group}`)} <span className="tabular-nums">{rosterRows(q.data, group).length}</span></h2>
    {!rosterRows(q.data, group).length && <p className="auth-subtitle">{t('teamMembership.emptyList')}</p>}
    <ul className="team-membership-list">{rosterRows(q.data, group).map(m => <li key={m.user_id}>
      {m.slug ? <Link className="auth-link" to="/h/$slug" params={{ slug: m.slug }}>{m.name ?? t('workspace.unnamed')}</Link> : <strong>{m.name ?? t('workspace.unnamed')}</strong>}
      <small>{t(`roles.${m.role}`, { defaultValue: t('roles.member') })} · {t(`teamMembership.status.${m.status}`)}</small>
      {m.requested_at && <small>{t('teamMembership.requested', { date: date(m.requested_at) })}</small>}{m.joined_at && <small>{t('teamMembership.joined', { date: date(m.joined_at) })}</small>}
      <div className="feed-actions">{m.status === 'pending' && <><Button disabled={busy} onClick={() => void decide(m.user_id, 'approved')}>{t('teamMembership.approve')}</Button><Button disabled={busy} variant="secondary" onClick={() => void decide(m.user_id, 'declined')}>{t('teamMembership.declined')}</Button></>}
        {group === 'members' && m.status === 'approved' && m.user_id !== userId && <Button variant="secondary" onClick={() => setInsights({ user_id: m.user_id, name: m.name })}>{t('teamMetrics.viewInsights')}</Button>}
        {group === 'members' && m.user_id !== userId && <Button disabled={busy} variant="secondary" onClick={() => void decide(m.user_id, 'removed')}>{t('teamMembership.removed')}</Button>}
      </div>
    </li>)}</ul>
  </section>)}<MemberInsightsSheet key={`${teamId}:${userId}:${insights?.user_id}`} userId={userId} teamId={teamId} member={insights} onClose={() => setInsights(null)} /></div>;
}

export function TeamMembershipSheet({ open, onOpenChange, teamId, userId, teamName, roster }: { open: boolean; onOpenChange: (open: boolean) => void; teamId: string; userId: string; teamName?: string; roster?: TeamRoster }) {
  const { t } = useTranslation(); return <ResponsiveSheet open={open} onOpenChange={onOpenChange} title={`${teamName ?? ''}: ${t(roster ? `teamMembership.${roster}` : 'teamMembership.manage')}`} icon="UsersRound">{open && <TeamMemberManagement key={`${teamId}:${userId}`} teamId={teamId} userId={userId} roster={roster} />}</ResponsiveSheet>;
}

export function RequestTeamJoin({ teamId }: { teamId: string }) {
  const { t } = useTranslation(); const qc = useQueryClient(); const [busy, setBusy] = useState(false); const [failed, setFailed] = useState(false);
  const me = useQuery({ queryKey: ['viewer-id'], queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null });
  const states = useQuery({ ...myTeamStatesQuery(me.data ?? ''), enabled: !!me.data });
  const state = states.data?.find(s => s.team_id === teamId);
  if (!me.data) return <Button asChild variant="secondary"><Link to="/login">{t('teamMembership.signIn')}</Link></Button>;
  if (states.isPending) return <ListSkeleton rows={1} />;
  if (state) return <p role="status">{t(`teamMembership.status.${state.status}`, { defaultValue: t('teamMembership.status.unavailable') })}</p>;
  return <div>{failed && <p className="field-error" role="alert">{t('teamMembership.error')}</p>}<Button disabled={busy} onClick={async () => { setBusy(true); const { error } = await supabase.rpc('request_team_membership', { _team: teamId }); setBusy(false); setFailed(!!error); if (!error) void qc.invalidateQueries({ queryKey: ['my-team-states'] }); }}>{t('teamMembership.request')}</Button><p className="field-hint">{t('teamMembership.pendingHint')}</p><p className="field-hint">{t('teamMembership.separateNote')}</p></div>;
}