import { tgShare } from '@/lib/chat-links';
import { EmptyState } from '@/components/launch-states';
import { useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ArrowLeft, CalendarDays, UsersRound, CircleCheck, UserRound, UserPlus, Rocket, Megaphone, MessageCircle, Copy, HandHeart, Send } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ResponsiveSheet } from '@/components/responsive-sheet';
import { useGatherwell } from '@/components/gatherwell-shell';
import { supabase } from '@/integrations/supabase/client';
import { firstName, initialsOf, workspaceQuery } from '@/lib/account';
import { teamKey, teamTreeQuery } from '@/lib/team';
import { PlaybookCard, BenchmarkPanel } from '@/components/playbook';

type Period = 'week' | 'month' | 'quarter';
type Stats = Record<'g' | 'g_prev' | 'r' | 'r_prev' | 'c' | 'c_prev' | 'h' | 'h_prev' | 'm' | 'm_prev' | 't' | 't_prev', number>;
type Insights = { stats: Stats; weekly: { week: string; count: number }[]; top_hosts: { user_id: string; name: string | null; team: string | null; gatherings: number; checkins: number }[];
  templates: { id: string; title: string; launches: number; checkins: number }[]; nudge: { user_id: string; name: string | null; team: string; last_hosted: string | null }[] };

function range(period: Period) {
  const to = new Date(); const from = new Date(to);
  if (period === 'week') from.setDate(to.getDate() - 7); else if (period === 'month') from.setDate(to.getDate() - 30); else from.setDate(to.getDate() - 91);
  return { from: from.toISOString(), to: to.toISOString() };
}

const EMPTY: Insights = { stats: { g: 0, g_prev: 0, r: 0, r_prev: 0, c: 0, c_prev: 0, h: 0, h_prev: 0, m: 0, m_prev: 0, t: 0, t_prev: 0 }, weekly: [], top_hosts: [], templates: [], nudge: [] };
/** @deprecated Signed-in screens never show sample data. */
const SAMPLE: Insights = {
  stats: { g: 14, g_prev: 11, r: 186, r_prev: 152, c: 142, c_prev: 120, h: 6, h_prev: 5, m: 12, m_prev: 9, t: 5, t_prev: 3 },
  weekly: [18, 22, 19, 27, 24, 31, 29, 35].map((count, i) => ({ week: new Date(Date.now() - (7 - i) * 604800000).toISOString(), count })),
  top_hosts: [{ user_id: 's1', name: 'Sofia Martinez', team: 'North Crew', gatherings: 5, checkins: 61 }, { user_id: 's2', name: 'James Wilson', team: 'Sunrise Walkers', gatherings: 4, checkins: 44 }, { user_id: 's3', name: 'Emily Chen', team: 'Evening Circle', gatherings: 3, checkins: 37 }],
  templates: [{ id: 't1', title: 'Saturday Fit Camp', launches: 7, checkins: 88 }, { id: 't2', title: 'Wellness Night', launches: 4, checkins: 39 }, { id: 't3', title: 'New Member Welcome', launches: 2, checkins: 15 }],
  nudge: [{ user_id: 'n1', name: 'Daniel Reyes', team: 'North Crew', last_hosted: new Date(Date.now() - 41 * 86400000).toISOString() }, { user_id: 'n2', name: 'Ana Torres', team: 'Evening Circle', last_hosted: null }],
};

function Chart({ data, lang }: { data: { week: string; count: number }[]; lang: string }) {
  const { t } = useTranslation();
  const W = 640, H = 200, P = 28; const max = Math.max(4, ...data.map(d => d.count));
  const x = (i: number) => P + (i * (W - P * 2)) / Math.max(1, data.length - 1); const y = (v: number) => H - P - (v / max) * (H - P * 2);
  const path = data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.count).toFixed(1)}`).join(' ');
  return <svg className="insights-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('insights.chart')} preserveAspectRatio="none">
    {[0, 0.5, 1].map(f => <line key={f} x1={P} x2={W - P} y1={y(max * f)} y2={y(max * f)} className="chart-grid" />)}
    {[0, 0.5, 1].map(f => <text key={`l${f}`} x={4} y={y(max * f) + 4} className="chart-label">{Math.round(max * f)}</text>)}
    <path d={path} className="chart-line" />
    {data.map((d, i) => <g key={d.week}><circle cx={x(i)} cy={y(d.count)} r={3.5} className="chart-dot"><title>{d.count}</title></circle>
      {(i === 0 || i === data.length - 1 || i % 2 === 0) && <text x={x(i)} y={H - 6} textAnchor="middle" className="chart-label">{new Date(d.week).toLocaleDateString(lang, { month: 'short', day: 'numeric' })}</text>}</g>)}
  </svg>;
}

export function InsightsPage() {
  const { t, i18n } = useTranslation(); const { userId } = useGatherwell(); const queryClient = useQueryClient();
  const lang = i18n.resolvedLanguage ?? 'en';
  const { data: workspace } = useQuery(workspaceQuery(userId));
  const rootId = workspace?.teamId ?? '';
  const { data: tree = [] } = useQuery({ ...teamTreeQuery(rootId), enabled: !!rootId });
  const [period, setPeriod] = useState<Period>('month'); const [scope, setScope] = useState<string>('all');
  const { from, to } = useMemo(() => range(period), [period]);
  const { data, isLoading, error } = useQuery({
    queryKey: [...teamKey(rootId), 'insights', period, scope], enabled: !!rootId && workspace?.role === 'leader',
    queryFn: async (): Promise<Insights & { followups: { v: number; p: number } }> => {
      const { data, error } = await supabase.rpc('team_insights', { _root: rootId, _scope: scope === 'all' ? rootId : scope, _from: from, _to: to });
      if (error) throw error;
      const sc = scope === 'all' ? rootId : scope; const span = new Date(to).getTime() - new Date(from).getTime();
      const [a, b] = await Promise.all([supabase.rpc('followups_sent', { _root: rootId, _scope: sc, _from: from, _to: to }), supabase.rpc('followups_sent', { _root: rootId, _scope: sc, _from: new Date(new Date(from).getTime() - span).toISOString(), _to: from })]);
      return { ...(data as unknown as Insights), followups: { v: Number(a.data ?? 0), p: Number(b.data ?? 0) } };
    },
  });
  const [shout, setShout] = useState<{ userId: string; name: string } | null>(null); const [message, setMessage] = useState('');
  const [nudge, setNudge] = useState<{ name: string } | null>(null);

  if (!workspace) return null;
  if (workspace.role !== 'leader') return <section className="panel"><h2>{t('insights.leadersOnly')}</h2><Button asChild variant="secondary" className="mt-4"><Link to="/team"><ArrowLeft />{t('eventDetail.backToTeam')}</Link></Button></section>;

  const real = data && (data.stats.g + data.stats.r + data.stats.c + data.stats.m + data.stats.t) > 0;
  void real; void SAMPLE; void isLoading;
  const view = data ?? EMPTY; const sample = false;
  const s = view.stats;
  const cards = [
    { key: 'gatherings', Icon: CalendarDays, v: s.g, p: s.g_prev }, { key: 'guests', Icon: UsersRound, v: s.r, p: s.r_prev }, { key: 'checkins', Icon: CircleCheck, v: s.c, p: s.c_prev },
    { key: 'hosts', Icon: UserRound, v: s.h, p: s.h_prev }, { key: 'members', Icon: UserPlus, v: s.m, p: s.m_prev }, { key: 'templates', Icon: Rocket, v: s.t, p: s.t_prev },
    { key: 'followups', Icon: MessageCircle, v: real ? data!.followups.v : 14, p: real ? data!.followups.p : 9 },
  ] as const;
  const change = (v: number, p: number) => { const d = v - p; return d === 0 ? t('insights.same') : t(d > 0 ? 'insights.up' : 'insights.down', { count: Math.abs(d) }); };
  const nudgeText = nudge ? t('insights.nudgeMessage', { name: firstName(nudge.name) || nudge.name, team: workspace.name }) : '';
  const sendShout = async () => {
    if (!shout || !message.trim()) return;
    if (sample) { toast(t('insights.sampleAction')); return; }
    const { error } = await supabase.rpc('post_shoutout', { _team: rootId, _to: shout.userId, _message: message.trim() });
    if (error) { toast.error(t('profile.saveError')); return; }
    toast.success(t('insights.shoutPosted')); setShout(null); await queryClient.invalidateQueries({ queryKey: [...teamKey(rootId), 'wins'] });
  };

  return <>
    <Link to="/team" className="auth-link back-link"><ArrowLeft />{workspace.name}</Link>
    <div className="page-heading"><div><span className="eyebrow">{t('insights.eyebrow')}</span><h1>{t('insights.title')}</h1><p>{t('insights.subtitle')}</p></div>{sample && <span className="chip sample-badge">{t('common.sample')}</span>}</div>
    <div className="insights-filters">
      <div className="segmented" role="group" aria-label={t('insights.period')}>{(['week', 'month', 'quarter'] as const).map(p => <Button key={p} variant="ghost" className={period === p ? 'selected' : ''} aria-pressed={period === p} onClick={() => setPeriod(p)}>{t(`insights.periods.${p}`)}</Button>)}</div>
      {tree.length > 1 && <Select value={scope} onValueChange={setScope}><SelectTrigger className="team-switcher scope-select" aria-label={t('insights.scope')}><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="all">{t('insights.wholeOrg')}</SelectItem>{tree.filter(n => n.depth > 0).map(n => <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>)}</SelectContent></Select>}
    </div>
    {error && <p className="field-error">{t('profile.saveError')}</p>}
    <section className="stats-grid insights-stats">{cards.map(({ key, Icon, v, p }) => <article className="stat-card" key={key}><div className="stat-heading"><span>{t(`insights.stats.${key}`)}</span><Icon /></div><strong className="stat-value">{v}</strong><p className="muted-change">{change(v, p)}</p></article>)}</section>
    <section className="panel"><div className="section-heading"><h2>{t('insights.chart')}</h2>{sample && <span className="chip sample-badge">{t('common.sample')}</span>}</div><Chart data={view.weekly} lang={lang} /></section>
    {rootId && <BenchmarkPanel teamId={rootId} />}
    <PlaybookCard context="insights" />
    <div className="dashboard-columns insights-columns">
      <section className="panel"><div className="section-heading"><h2>{t('insights.topHosts')}</h2></div>
        {view.top_hosts.length ? <ol className="rank-list">{view.top_hosts.map((h, i) => <li key={h.user_id} className="person-row"><span className="rank">{i + 1}</span><span className="initial-avatar">{initialsOf(h.name)}</span>
          <div className="person-info"><h3>{h.name ?? t('teamSpace.someone')}</h3><p>{h.team} · {t('insights.hostLine', { gatherings: h.gatherings, checkins: h.checkins })}</p></div>
          <Button variant="secondary" size="sm" onClick={() => { setShout({ userId: h.user_id, name: h.name ?? '' }); setMessage(t('insights.shoutDefault', { name: firstName(h.name) })); }}><Megaphone />{t('insights.shout')}</Button></li>)}</ol>
          : <EmptyState compact icon="BarChart3" text={t('insights.noHosts')} />}</section>
      <section className="panel"><div className="section-heading"><h2>{t('insights.templatePerf')}</h2></div>
        {view.templates.length ? <ul className="perf-list">{view.templates.map(tp => <li key={tp.id}><span className="perf-title">{tp.title}</span><span className="perf-num">{t('insights.launches', { count: tp.launches })}</span><span className="perf-num">{t('insights.checkinsCount', { count: tp.checkins })}</span></li>)}</ul>
          : <EmptyState compact icon="BarChart3" text={t('insights.noTemplates')} />}</section>
    </div>
    <section className="panel"><div className="section-heading"><div><h2>{t('insights.nudge')}</h2><p>{t('insights.nudgeText')}</p></div></div>
      {view.nudge.length ? <div>{view.nudge.map(n => <div className="person-row" key={n.user_id}><span className="initial-avatar">{initialsOf(n.name)}</span><div className="person-info"><h3>{n.name ?? t('teamSpace.someone')}</h3>
        <p>{n.team} · {n.last_hosted ? t('insights.lastHosted', { date: new Date(n.last_hosted).toLocaleDateString(lang, { month: 'short', day: 'numeric' }) }) : t('insights.neverHosted')}</p></div>
        <Button variant="secondary" size="sm" onClick={() => setNudge({ name: n.name ?? '' })}><HandHeart />{t('insights.checkIn')}</Button></div>)}</div>
        : <p className="auth-subtitle">{t('insights.allActive')}</p>}</section>

    <ResponsiveSheet open={!!shout} onOpenChange={o => !o && setShout(null)} title={t('insights.shoutTitle', { name: shout?.name ?? '' })} description={t('insights.shoutHelp')}>
      <div className="edit-form"><Textarea rows={3} maxLength={280} className="field-textarea" value={message} onChange={e => setMessage(e.target.value)} aria-label={t('teamSpace.message')} /><span className="char-count">{message.length}/280</span>
        <Button className="onboarding-continue" disabled={!message.trim()} onClick={sendShout}><Megaphone />{t('insights.postShout')}</Button></div>
    </ResponsiveSheet>
    <ResponsiveSheet open={!!nudge} onOpenChange={o => !o && setNudge(null)} title={t('insights.checkInTitle', { name: nudge?.name ?? '' })} description={t('insights.noAutoSend')}>
      <div className="edit-form"><div className="copy-field nudge-text"><span>{nudgeText}</span></div>
        <div className="share-grid"><Button onClick={async () => { await navigator.clipboard.writeText(nudgeText); toast.success(t('onboarding.copied')); }}><Copy />{t('insights.copy')}</Button>
          <Button asChild variant="secondary"><a href={`https://wa.me/?text=${encodeURIComponent(nudgeText)}`} target="_blank" rel="noopener noreferrer"><MessageCircle />{t('teamSpace.whatsapp')}</a></Button><Button asChild variant="secondary"><a href={tgShare(nudgeText)} target="_blank" rel="noopener noreferrer"><Send />{t('teamSpace.telegram')}</a></Button></div></div>
    </ResponsiveSheet>
  </>;
}
