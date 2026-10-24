import { useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GwIcon } from '@/components/gw-icon';
import { EmptyState, ListSkeleton, RetryState } from '@/components/launch-states';
import { confirmAction } from '@/components/confirm-dialog';
import { ResponsiveSheet } from '@/components/responsive-sheet';
import { initialsOf } from '@/lib/account';

export const WORKSPACE_ROLES = ['admin', 'host', 'content_editor', 'checkin', 'moderator', 'analyst', 'member'] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

type Member = { user_id: string; full_name: string | null; workspace_role: string; suspended_at: string | null; is_owner: boolean };
type Invite = { id: string; email: string; role: string; state: 'pending' | 'accepted' | 'expired' | 'revoked'; expires_at: string; created_at: string };
type SeatUsage = { tier: string; seat_limit: number; seats_used: number; over_limit: boolean };
type AuditRow = { action: string; actor: string | null; target: string | null; at: string; meta: Record<string, unknown> };

const membersQuery = (teamId: string) => ({
  queryKey: ['ws-members', teamId],
  queryFn: async () => {
    const { data: team, error: te } = await supabase.from('teams').select('owner_id').eq('id', teamId).single();
    if (te) throw te;
    const { data, error } = await supabase.from('team_members').select('user_id, workspace_role, suspended_at').eq('team_id', teamId);
    if (error) throw error;
    const ids = data.map(m => m.user_id);
    const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
    const names = new Map((profs ?? []).map(p => [p.id, p.full_name]));
    return data.map(m => ({ ...m, full_name: names.get(m.user_id) ?? null, is_owner: m.user_id === team.owner_id })) as Member[];
  },
});

const invitesQuery = (teamId: string) => ({
  queryKey: ['ws-invites', teamId],
  queryFn: async () => {
    const { data, error } = await supabase.rpc('team_invites_list', { _team: teamId });
    if (error) throw error;
    return (data ?? []) as unknown as Invite[];
  },
});

const seatsQuery = (teamId: string) => ({
  queryKey: ['ws-seats', teamId],
  queryFn: async () => {
    const { data, error } = await supabase.rpc('team_seat_usage', { _team: teamId });
    if (error) throw error;
    return data as unknown as SeatUsage;
  },
});

const activityQuery = (teamId: string) => ({
  queryKey: ['ws-activity', teamId],
  queryFn: async () => {
    const { data, error } = await supabase.rpc('team_activity', { _team: teamId, _limit: 50 });
    if (error) throw error;
    return (data ?? []) as unknown as AuditRow[];
  },
});

type Tab = 'members' | 'invites' | 'seats' | 'activity';

export function WorkspaceSettings({ teamId, userId, teamName }: { teamId: string; userId: string; teamName: string }) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('members');
  const [search, setSearch] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('member');
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const members = useQuery(membersQuery(teamId));
  const invites = useQuery({ ...invitesQuery(teamId), enabled: tab === 'invites' });
  const seats = useQuery(seatsQuery(teamId));
  const activity = useQuery({ ...activityQuery(teamId), enabled: tab === 'activity' });
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['ws-members', teamId] }); void qc.invalidateQueries({ queryKey: ['ws-invites', teamId] }); void qc.invalidateQueries({ queryKey: ['ws-seats', teamId] }); void qc.invalidateQueries({ queryKey: ['ws-activity', teamId] }); };

  const run = async (fn: () => Promise<{ error: { message: string } | null }>, done?: string) => {
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) { toast.error(t(`workspace.err.${error.message}`, { defaultValue: t('error.message') })); return false; }
    if (done) toast.success(done);
    refresh();
    return true;
  };

  const sendInvite = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc('invite_team_member', { _team: teamId, _email: inviteEmail.trim(), _role: inviteRole });
    setBusy(false);
    if (error) { toast.error(t(`workspace.err.${error.message}`, { defaultValue: t('error.message') })); return; }
    const link = `${window.location.origin}/invite/team/${(data as unknown as { token: string }).token}`;
    setInviteLink(link);
    try { await navigator.clipboard.writeText(link); } catch { /* clipboard unavailable */ }
    toast.success(t('workspace.inviteCopied'));
    refresh();
  };

  const changeRole = (m: Member, role: WorkspaceRole) => void run(() => supabase.rpc('change_member_role', { _team: teamId, _user: m.user_id, _role: role }), t('workspace.roleChanged'));
  const toggleSuspend = (m: Member) => void run(() => supabase.rpc('set_member_suspension', { _team: teamId, _user: m.user_id, _suspend: !m.suspended_at }), t('workspace.saved'));
  const remove = async (m: Member) => {
    if (!(await confirmAction({ title: t('workspace.removeTitle', { name: m.full_name ?? '' }), body: t('workspace.removeBody'), confirmLabel: t('workspace.remove'), destructive: true }))) return;
    void run(() => supabase.rpc('remove_member', { _team: teamId, _user: m.user_id }), t('workspace.removed'));
  };
  const transfer = async (m: Member) => {
    const typed = window.prompt(t('workspace.transferPrompt', { team: teamName }));
    if (typed === null) return;
    void run(() => supabase.rpc('transfer_ownership', { _team: teamId, _new_owner: m.user_id, _confirm: typed }), t('workspace.transferred'));
  };
  const revoke = (id: string) => void run(() => supabase.rpc('revoke_team_invite', { _id: id }), t('workspace.revoked'));

  const filtered = (members.data ?? []).filter(m => !search || (m.full_name ?? '').toLowerCase().includes(search.toLowerCase()));
  const tabs: [Tab, string][] = [['members', t('workspace.members')], ['invites', t('workspace.invites')], ['seats', t('workspace.seats')], ['activity', t('workspace.activity')]];

  return <div className="workspace-settings">
    <div className="segmented ws-tabs" role="tablist" aria-label={t('workspace.title')}>
      {tabs.map(([k, label]) => <Button key={k} variant="ghost" role="tab" aria-selected={tab === k} className={tab === k ? 'selected' : ''} onClick={() => setTab(k)}>{label}</Button>)}
    </div>

    {tab === 'members' && <>
      <div className="search-field"><GwIcon name="Search" /><Input className="field-input" placeholder={t('teamSpace.searchMembers')} value={search} onChange={e => setSearch(e.target.value)} aria-label={t('teamSpace.searchMembers')} /></div>
      {members.isLoading && <ListSkeleton rows={3} />}
      {members.isError && <RetryState retry={() => void members.refetch()} />}
      {members.data && filtered.length === 0 && <EmptyState compact icon="UsersRound" text={t('workspace.noMembers')} />}
      <ul className="ws-member-list">{filtered.map(m => <li key={m.user_id} className="ws-member">
        <span className="initial-avatar" aria-hidden="true">{initialsOf(m.full_name)}</span>
        <span className="ws-member-main"><strong>{m.full_name ?? t('workspace.unnamed')}</strong>
          <small>{t(`workspace.role.${m.is_owner ? 'owner' : m.workspace_role}`)}{m.suspended_at ? ` · ${t('workspace.suspended')}` : ''}</small></span>
        {!m.is_owner && m.user_id !== userId && <div className="ws-member-actions">
          <select className="field-input ws-role-select" aria-label={t('workspace.changeRole')} value={m.workspace_role} disabled={busy}
            onChange={e => changeRole(m, e.target.value as WorkspaceRole)}>
            {WORKSPACE_ROLES.map(r => <option key={r} value={r}>{t(`workspace.role.${r}`)}</option>)}
          </select>
          <Button variant="ghost" size="icon" aria-label={m.suspended_at ? t('workspace.reactivate') : t('workspace.suspend')} onClick={() => toggleSuspend(m)}><GwIcon name={m.suspended_at ? 'Play' : 'Pause'} /></Button>
          <Button variant="ghost" size="icon" aria-label={t('workspace.transfer')} onClick={() => void transfer(m)}><GwIcon name="Crown" /></Button>
          <Button variant="ghost" size="icon" aria-label={t('workspace.remove')} onClick={() => void remove(m)}><GwIcon name="Trash2" /></Button>
        </div>}
      </li>)}</ul>
    </>}

    {tab === 'invites' && <>
      <Button onClick={() => { setInviteLink(null); setInviteOpen(true); }}><GwIcon name="UserPlus" />{t('workspace.newInvite')}</Button>
      {invites.isLoading && <ListSkeleton rows={2} />}
      {invites.isError && <RetryState retry={() => void invites.refetch()} />}
      {invites.data?.length === 0 && <EmptyState compact icon="EnvelopeSimple" text={t('workspace.noInvites')} />}
      <ul className="ws-invite-list">{invites.data?.map(i => <li key={i.id} className="ws-invite">
        <span className="ws-member-main"><strong>{i.email}</strong><small>{t(`workspace.role.${i.role}`)} · {t(`workspace.state.${i.state}`)}</small></span>
        {i.state === 'pending' && <Button variant="ghost" size="icon" aria-label={t('workspace.revoke')} onClick={() => revoke(i.id)}><GwIcon name="X" /></Button>}
      </li>)}</ul>}
      <ResponsiveSheet open={inviteOpen} onOpenChange={setInviteOpen} icon="UserPlus" title={t('workspace.newInvite')} description={t('workspace.inviteHint')}
        footer={inviteLink
          ? <Button className="w-full" onClick={async () => { try { await navigator.clipboard.writeText(inviteLink); toast.success(t('workspace.inviteCopied')); } catch { toast.error(t('error.message')); } }}><GwIcon name="Copy" />{t('workspace.copyLink')}</Button>
          : <Button className="w-full" type="submit" form="ws-invite-form" disabled={busy || !inviteEmail.includes('@')}>{t('workspace.createLink')}</Button>}>
        {inviteLink
          ? <div className="ws-invite-done"><p className="auth-subtitle">{t('workspace.linkReady')}</p><code className="ws-invite-link">{inviteLink}</code><p className="follow-fine">{t('workspace.emailSetupRequired')}</p></div>
          : <form id="ws-invite-form" onSubmit={e => { e.preventDefault(); if (!busy) void sendInvite(); }}>
            <div className="field"><Label htmlFor="ws-invite-email">{t('follow.email')}</Label><Input id="ws-invite-email" type="email" required autoComplete="off" inputMode="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} /></div>
            <div className="field"><Label htmlFor="ws-invite-role">{t('workspace.roleLabel')}</Label>
              <select id="ws-invite-role" className="field-input" value={inviteRole} onChange={e => setInviteRole(e.target.value as WorkspaceRole)}>
                {WORKSPACE_ROLES.map(r => <option key={r} value={r}>{t(`workspace.role.${r}`)}</option>)}
              </select></div>
          </form>}
      </ResponsiveSheet>
    </>}

    {tab === 'seats' && <>
      {seats.isLoading && <ListSkeleton rows={2} />}
      {seats.isError && <RetryState retry={() => void seats.refetch()} />}
      {seats.data && <div className="ws-seats">
        <p className="plan-name">{t('workspace.seatUsage', { used: seats.data.seats_used, limit: seats.data.seat_limit })}</p>
        <p className="auth-subtitle">{t(`plans.${seats.data.tier}`, { defaultValue: seats.data.tier })}</p>
        {seats.data.over_limit && <p className="field-error" role="alert">{t('workspace.overLimit')}</p>}
        {!seats.data.over_limit && seats.data.seats_used >= seats.data.seat_limit && <p className="auth-note">{t('workspace.seatsFull')}</p>}
        <p className="follow-fine">{t('workspace.upgradeSetup')}</p>
      </div>}
    </>}

    {tab === 'activity' && <>
      {activity.isLoading && <ListSkeleton rows={3} />}
      {activity.isError && <RetryState retry={() => void activity.refetch()} />}
      {activity.data?.length === 0 && <EmptyState compact icon="ListChecks" text={t('workspace.noActivity')} />}
      <ul className="ws-activity-list">{activity.data?.map((a, i) => <li key={i} className="ws-activity">
        <span className="ws-member-main"><strong>{t(`workspace.action.${a.action}`, { defaultValue: a.action })}</strong>
          <small>{[a.actor, a.target, new Date(a.at).toLocaleString(i18n.resolvedLanguage === 'es' ? 'es' : 'en')].filter(Boolean).join(' · ')}</small></span>
      </li>)}</ul>}
    </>}
  </div>;
}

/** Public invite landing: requires sign-in with the invited email, then explicit acceptance. */
export function TeamInvitePage({ token }: { token: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const [err, setErr] = useState('');
  const accept = async () => {
    setState('busy');
    const { data, error } = await supabase.auth.getUser();
    if (!data.user) { setState('error'); setErr(t('workspace.signInToAccept')); return; }
    const { data: res, error: ae } = await supabase.rpc('accept_team_invite', { _token: token });
    if (ae) { setState('error'); setErr(t(`workspace.err.${ae.message}`, { defaultValue: t('error.message') })); return; }
    setState('done');
    setTimeout(() => void navigate({ to: '/team' }), 1200);
    return res;
  };
  return <div className="auth-card ws-accept">
    <h1 className="page-title">{t('workspace.acceptTitle')}</h1>
    <p className="auth-subtitle">{t('workspace.acceptText')}</p>
    {state === 'error' && <p className="field-error" role="alert">{err}</p>}
    {state === 'done' ? <p className="auth-subtitle" role="status">{t('workspace.accepted')}</p>
      : <Button className="sheet-primary" disabled={state === 'busy'} onClick={() => void accept()}>{state === 'busy' ? t('onboarding.saving') : t('workspace.accept')}</Button>}
    <p className="follow-fine"><Link to="/login">{t('follow.signIn')}</Link></p>
  </div>;
}
