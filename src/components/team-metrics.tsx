import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ListSkeleton, RetryState } from '@/components/launch-states';
import { ResponsiveSheet } from '@/components/responsive-sheet';
import { supabase } from '@/integrations/supabase/client';
import { TEAM_METRICS, insightsState, normalizeMetrics, type MemberInsights, type TeamMetric } from '@/lib/team-metrics';
import { teamCallerQuery, announceTeamChange, listenTeamChanges } from '@/lib/team-query-boundary';

/** A member's per-team, revocable choice of what that team's leader may see. Nothing is shared until chosen. */
export function TeamMetricSharing({ teamId, userId }: { teamId: string; userId: string }) {
  const { t } = useTranslation(); const qc = useQueryClient();
  const key = ['team-metric-share', teamId, userId];
  const q = useQuery({ queryKey: key, staleTime: 0, gcTime: 0, refetchInterval: 3_000, queryFn: ({ signal }) => teamCallerQuery(userId, signal, async () => {
    const { data, error } = await supabase.from('team_metric_shares').select('metrics').eq('team_id', teamId).eq('user_id', userId).maybeSingle();
    if (error) throw error; return normalizeMetrics(data?.metrics);
  }) });
  const [sel, setSel] = useState<TeamMetric[]>([]); const [busy, setBusy] = useState(false);
  useEffect(() => { if (q.data) setSel(q.data); }, [q.data]);
  useEffect(() => { setSel([]); }, [teamId, userId]);
  if (q.isPending) return <ListSkeleton />;
  if (q.isError) return <RetryState retry={() => void q.refetch()} />;
  const save = async () => {
    setBusy(true); const { error } = await supabase.rpc('set_team_metric_share', { _team: teamId, _metrics: sel }); setBusy(false);
    if (error) { toast.error(t('teamMetrics.saveError')); return; }
    await qc.cancelQueries({ queryKey: ['team-member-insights', teamId] }); qc.removeQueries({ queryKey: ['team-member-insights', teamId] }); announceTeamChange(teamId);
    await qc.invalidateQueries({ queryKey: key }); toast.success(t(sel.length ? 'teamMetrics.saved' : 'teamMetrics.stopped'));
  };
  return <fieldset className="team-metric-share">
    <legend className="field-label">{t('teamMetrics.shareTitle')}</legend>
    <p className="field-hint">{t('teamMetrics.shareHint')}</p>
    {TEAM_METRICS.map(m => <label key={m} className="guest-consent">
      <Checkbox disabled={busy} checked={sel.includes(m)} onCheckedChange={v => setSel(current => v ? normalizeMetrics([...current, m]) : current.filter(x => x !== m))} />
      <span><strong>{t(`teamMetrics.metric.${m}`)}</strong><br /><small className="field-hint">{t(`teamMetrics.preview.${m}`)}</small></span>
    </label>)}
    <p className="field-hint">{t('teamMetrics.neverShared')}</p>
    <div role="status"><strong>{t('teamMetrics.previewTitle')}</strong>{sel.length ? <ul>{sel.map(m => <li key={m}>{t(`teamMetrics.preview.${m}`)}</li>)}</ul> : <p>{t('teamMetrics.previewNothing')}</p>}</div>
    <Button disabled={busy} onClick={() => void save()}>{t(sel.length ? 'teamMetrics.save' : 'teamMetrics.shareNothing')}</Button>
    {!!q.data?.length && <Button variant="secondary" disabled={busy} onClick={async () => {
      setBusy(true); const { error } = await supabase.rpc('set_team_metric_share', { _team: teamId, _metrics: [] }); setBusy(false);
      if (error) { toast.error(t('teamMetrics.saveError')); return; }
      setSel([]); await qc.cancelQueries({ queryKey: ['team-member-insights', teamId] }); qc.removeQueries({ queryKey: ['team-member-insights', teamId] }); announceTeamChange(teamId); await qc.invalidateQueries({ queryKey: key });
      toast.success(t('teamMetrics.stopped'));
    }}>{t('teamMetrics.stopNow')}</Button>}
  </fieldset>;
}

/** Leader view of one member's opted-in event insights. */
export function MemberInsightsSheet({ teamId, userId, member, onClose }: { teamId: string; userId: string; member: { user_id: string; name: string | null } | null; onClose: () => void }) {
  const { t, i18n } = useTranslation(); const lang = i18n.resolvedLanguage === 'es' ? 'es-419' : 'en-US';
  const qc = useQueryClient();
  const key = ['team-member-insights', teamId, member?.user_id, userId];
  const q = useQuery({ queryKey: key, enabled: !!member, staleTime: 0, gcTime: 0, refetchInterval: 3_000, retry: false, queryFn: ({ signal }) => teamCallerQuery(userId, signal, async () => {
    if (!member) throw new Error('not_member');
    const { data, error } = await supabase.rpc('team_member_insights', { _team: teamId, _user: member.user_id }); if (error) throw error; return data as unknown as MemberInsights;
  }) });
  useEffect(() => listenTeamChanges(changed => {
    if (changed !== teamId) return;
    void qc.cancelQueries({ queryKey: ['team-member-insights', teamId] }).then(() => { qc.removeQueries({ queryKey: ['team-member-insights', teamId] }); onClose(); });
  }), [teamId, qc, onClose]);
  // Old values are never displayed while permission/consent is being rechecked, including errors.
  const state = insightsState(q.isPending || q.isFetching, q.isError, q.data);
  const fmt = (s: string, tz?: string | null) => new Date(s).toLocaleDateString(lang, { month: 'short', day: 'numeric', year: 'numeric', timeZone: tz || undefined });
  return <ResponsiveSheet open={!!member} onOpenChange={o => { if (!o) onClose(); }} title={t('teamMetrics.insightsTitle', { name: member?.name ?? t('workspace.unnamed') })} icon="BarChart3">
    {state === 'loading' && <ListSkeleton />}
    {state === 'error' && <RetryState retry={() => void q.refetch()} />}
    {state === 'not_shared' && <p role="status">{t('teamMetrics.notShared')}</p>}
    {(state === 'no_events' || state === 'ready') && q.data && <div className="edit-form">
      <p className="field-hint">{t('teamMetrics.range', { date: fmt(q.data.from) })}</p>
      {q.data.upcoming_count != null && <p><strong className="tabular-nums">{q.data.upcoming_count}</strong> {t('teamMetrics.upcomingCount', { count: q.data.upcoming_count })}</p>}
      {state === 'no_events' ? <p role="status">{t('teamMetrics.noEvents')}</p> : <ul className="team-membership-list">{q.data.events.map(e => <li key={e.id}>
        {e.public ? <Link className="auth-link" to="/e/$id" params={{ id: e.id }}>{e.title}</Link> : <strong>{e.title}</strong>}
        <small>{fmt(e.starts_at, e.timezone)}</small>
        {e.registered != null && <small>{t('teamMetrics.registered', { count: e.registered })}</small>}
        {e.checked_in != null && <small>{t('teamMetrics.checkedIn', { count: e.checked_in })}</small>}
      </li>)}</ul>}
      <p className="field-hint">{t('teamMetrics.leaderNote')}</p>
    </div>}
  </ResponsiveSheet>;
}
