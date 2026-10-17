import { Feature } from '@/lib/feature-flags';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Check, Download, Flame, Lock, Plus, Trash2 } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useGatherwell } from '@/components/gatherwell-shell';
import { ListSkeleton, RetryState, EmptyState } from '@/components/launch-states';
import { downloadRecognitionCard } from '@/components/recognition';
import { supabase } from '@/integrations/supabase/client';
import { profileQuery, workspaceQuery } from '@/lib/account';
import { hasBlockedClaim } from '@/lib/recognition';

type Progress = {
  attended: number; streak: number; best_streak: number; lessons: number;
  by_category: { category: string; count: number }[];
  month: { start: string; gatherings: number; goals_checked: number; new_people: number; streak: number };
  goals?: { title: string; checks: number }[];
  bests?: { label: string; value: number; unit: string; recorded_on: string }[];
};
const tz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return 'UTC'; } };
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const UNITS = { distance: ['km', 'mi'], time: ['min'], reps: ['reps'], lifted: ['kg', 'lb'] } as const;
type Kind = keyof typeof UNITS;

function Stats({ p }: { p: Progress }) {
  const { t } = useTranslation();
  return <>
    <div className="progress-stats">
      {([['attended', p.attended], ['streak', p.streak], ['best', p.best_streak], ['lessons', p.lessons]] as const).map(([k, v]) =>
        <div key={k}><strong className="tabular-nums">{v}</strong><span>{t(`progress.stat.${k}`)}</span></div>)}
    </div>
    {p.by_category.length > 0 && <section className="progress-block"><h3 className="gw-group-title">{t('progress.byCategory')}</h3>
      <ul className="progress-bars">{p.by_category.map(c => { const max = p.by_category[0]?.count || 1; return <li key={c.category}>
        <span>{t(`landing.catOne.${c.category}`, { defaultValue: t('progress.otherCategory') })}</span>
        <span className="progress-bar" aria-hidden="true"><i style={{ width: `${Math.round((c.count / max) * 100)}%` }} /></span>
        <strong className="tabular-nums">{c.count}</strong></li>; })}</ul></section>}
  </>;
}

export function MyProgressPage() {
  const { t, i18n } = useTranslation(); const lang = i18n.resolvedLanguage ?? 'en';
  const { userId } = useGatherwell(); const qc = useQueryClient();
  const { data: ws } = useQuery(workspaceQuery(userId));
  const { data: profile } = useQuery(profileQuery(userId));
  const prog = useQuery({ queryKey: ['progress', userId], queryFn: async () => { const { data, error } = await supabase.rpc('my_progress', { _tz: tz() }); if (error) throw error; return data as unknown as Progress; } });
  const goals = useQuery({ queryKey: ['progress', userId, 'goals'], queryFn: async () => {
    const { data, error } = await supabase.from('progress_goals').select('id, title, progress_goal_checks(checked_on)').eq('archived', false).order('created_at');
    if (error) throw error; return data ?? [];
  } });
  const bests = useQuery({ queryKey: ['progress', userId, 'bests'], queryFn: async () => {
    const { data, error } = await supabase.from('personal_bests').select('*').order('recorded_on', { ascending: false }).limit(50);
    if (error) throw error; return data ?? [];
  } });
  const share = useQuery({ queryKey: ['progress', userId, 'share', ws?.teamId], enabled: !!ws?.teamId, queryFn: async () => {
    const { data } = await supabase.from('progress_shares').select('team_id').eq('team_id', ws!.teamId).maybeSingle(); return !!data;
  } });
  const [goal, setGoal] = useState('');
  const [pb, setPb] = useState({ label: '', kind: 'distance' as Kind, value: '', unit: 'km' });
  const refresh = () => qc.invalidateQueries({ queryKey: ['progress', userId] });
  const guard = (s: string) => { if (hasBlockedClaim(s)) { toast.error(t('progress.claim')); return false; } return true; };

  const addGoal = async () => {
    const title = goal.trim(); if (!title || !guard(title)) return;
    const { error } = await supabase.from('progress_goals').insert({ title, user_id: userId });
    if (error) { toast.error(t('progress.saveError')); return; } setGoal(''); await refresh();
  };
  const toggleCheck = async (goalId: string, done: boolean) => {
    const { error } = done ? await supabase.from('progress_goal_checks').delete().match({ goal_id: goalId, checked_on: today() })
      : await supabase.from('progress_goal_checks').insert({ goal_id: goalId, checked_on: today(), user_id: userId });
    if (error) { toast.error(t('progress.saveError')); return; } await refresh();
  };
  const removeGoal = async (id: string) => { await supabase.from('progress_goals').update({ archived: true }).eq('id', id); await refresh(); };
  const addBest = async () => {
    const value = Number(pb.value); const label = pb.label.trim();
    if (!label || !(value > 0) || !guard(label)) return;
    const { error } = await supabase.from('personal_bests').insert({ label, kind: pb.kind, value, unit: pb.unit, user_id: userId });
    if (error) { toast.error(t('progress.saveError')); return; } setPb({ ...pb, label: '', value: '' }); await refresh();
  };
  const removeBest = async (id: string) => { await supabase.from('personal_bests').delete().eq('id', id); await refresh(); };
  const toggleShare = async (on: boolean) => {
    if (!ws?.teamId) return;
    const { error } = on ? await supabase.from('progress_shares').insert({ team_id: ws.teamId, user_id: userId }) : await supabase.from('progress_shares').delete().match({ team_id: ws.teamId, user_id: userId });
    if (error) { toast.error(t('progress.saveError')); return; } toast.success(t(on ? 'progress.sharedOn' : 'progress.sharedOff')); await refresh();
  };

  if (prog.isPending) return <ListSkeleton />;
  if (prog.isError) return <RetryState retry={() => void prog.refetch()} />;
  const p = prog.data;
  const monthName = new Date(`${p.month.start}T12:00:00`).toLocaleDateString(lang, { month: 'long' });
  const shareRecap = () => void downloadRecognitionCard({
    eyebrow: t('progress.recapEyebrow', { month: monthName }), title: t('progress.recapTitle'),
    subtitle: t('progress.recapLine', { g: p.month.gatherings, s: p.month.streak, n: p.month.new_people, c: p.month.goals_checked }),
    name: profile?.full_name ?? '', photo: null, icon: 'Flame', tier: 'gold', team: ws?.name ?? '', file: 'gatherwell-your-month.png',
  });

  return <div className="my-progress">
    <header className="page-heading"><h1>{t('progress.title')}</h1><p className="gw-muted-line"><Lock className="inline-icon" />{t('progress.private')}</p></header>

    <section className="panel progress-recap" aria-labelledby="recap-h">
      <span className="gw-eyebrow">{t('progress.recapEyebrow', { month: monthName })}</span>
      <h2 id="recap-h">{t('progress.recapTitle')}</h2>
      <div className="progress-stats four">
        {([['gatherings', p.month.gatherings], ['streak', p.month.streak], ['people', p.month.new_people], ['goals', p.month.goals_checked]] as const).map(([k, v]) =>
          <div key={k}><strong className="tabular-nums">{v}</strong><span>{t(`progress.recap.${k}`)}</span></div>)}
      </div>
      <Button variant="secondary" onClick={shareRecap}><Download />{t('progress.shareRecap')}</Button>
    </section>

    <Stats p={p} />

    <section className="progress-block"><h3 className="gw-group-title">{t('progress.goals')}</h3>
      {goals.data?.length ? <ul className="progress-goals">{goals.data.map(g => { const done = g.progress_goal_checks.some(c => c.checked_on === today()); return <li key={g.id}>
        <button type="button" className={`goal-check ${done ? 'is-done' : ''}`} aria-pressed={done} aria-label={t('progress.checkToday', { goal: g.title })} onClick={() => void toggleCheck(g.id, done)}><Check /></button>
        <div><strong>{g.title}</strong><small>{t('progress.checks', { count: g.progress_goal_checks.length })}</small></div>
        <Button variant="ghost" size="icon" aria-label={t('progress.removeGoal')} onClick={() => void removeGoal(g.id)}><Trash2 /></Button>
      </li>; })}</ul> : <EmptyState compact icon="Flag" text={t('progress.noGoals')} />}
      <div className="inline-form"><label className="sr-only" htmlFor="goal-new">{t('progress.newGoal')}</label>
        <Input id="goal-new" className="field-input" maxLength={80} placeholder={t('progress.goalPlaceholder')} value={goal} onChange={e => setGoal(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void addGoal(); }} />
        <Button onClick={() => void addGoal()} disabled={!goal.trim()}><Plus />{t('progress.add')}</Button></div>
    </section>

    <Feature flag="feature_badges_limited"><section className="progress-block"><h3 className="gw-group-title">{t('progress.bests')}</h3>
      {bests.data?.length ? <ul className="progress-bests">{bests.data.map(b => <li key={b.id}>
        <div><strong>{b.label}</strong><small>{new Date(`${b.recorded_on}T12:00:00`).toLocaleDateString(lang, { month: 'short', day: 'numeric', year: 'numeric' })}</small></div>
        <span className="tabular-nums">{b.value} {t(`progress.unit.${b.unit}`)}</span>
        <Button variant="ghost" size="icon" aria-label={t('progress.removeBest')} onClick={() => void removeBest(b.id)}><Trash2 /></Button>
      </li>)}</ul> : <EmptyState compact icon="Trophy" text={t('progress.noBests')} />}
      <div className="edit-form progress-best-form">
        <div className="form-field"><label className="field-label" htmlFor="pb-label">{t('progress.bestLabel')}</label><Input id="pb-label" className="field-input" maxLength={60} placeholder={t('progress.bestPlaceholder')} value={pb.label} onChange={e => setPb({ ...pb, label: e.target.value })} /></div>
        <div className="form-field"><span className="field-label">{t('progress.bestKind')}</span>
          <div className="choice-pair four">{(Object.keys(UNITS) as Kind[]).map(k => <button type="button" key={k} aria-pressed={pb.kind === k} className={`choice-card ${pb.kind === k ? 'is-selected' : ''}`} onClick={() => setPb({ ...pb, kind: k, unit: UNITS[k][0] })}><strong>{t(`progress.kind.${k}`)}</strong></button>)}</div></div>
        <div className="inline-form">
          <label className="sr-only" htmlFor="pb-value">{t('progress.bestValue')}</label>
          <Input id="pb-value" className="field-input" inputMode="decimal" placeholder={t('progress.bestValue')} value={pb.value} onChange={e => setPb({ ...pb, value: e.target.value.replace(/[^0-9.]/g, '') })} />
          {UNITS[pb.kind].length > 1 && <div className="choice-pair" role="group" aria-label={t('progress.bestUnit')}>{UNITS[pb.kind].map(u => <button type="button" key={u} aria-pressed={pb.unit === u} className={`choice-card ${pb.unit === u ? 'is-selected' : ''}`} onClick={() => setPb({ ...pb, unit: u })}><strong>{t(`progress.unit.${u}`)}</strong></button>)}</div>}
          <Button onClick={() => void addBest()} disabled={!pb.label.trim() || !Number(pb.value)}><Plus />{t('progress.add')}</Button>
        </div>
      </div>
    </section></Feature>

    {ws?.teamId && <section className="panel progress-share">
      <div><strong>{t('progress.shareTitle', { team: ws.name })}</strong><p className="gw-muted-line">{t('progress.shareText')}</p></div>
      <Switch checked={!!share.data} onCheckedChange={v => void toggleShare(v)} aria-label={t('progress.shareTitle', { team: ws.name })} />
    </section>}
  </div>;
}

/** Leader view inside a member's profile: only what the member chose to share. */
export function SharedProgress({ teamId, userId }: { teamId: string; userId: string }) {
  const { t } = useTranslation();
  const { data } = useQuery({ queryKey: ['progress', 'shared', teamId, userId], queryFn: async () => {
    const { data, error } = await supabase.rpc('shared_progress', { _team: teamId, _user: userId, _tz: tz() }); if (error) throw error; return (data as unknown as Progress) ?? null;
  } });
  if (!data) return null;
  return <section className="progress-block shared-progress"><h3 className="gw-group-title"><Flame className="inline-icon" />{t('progress.sharedWithYou')}</h3>
    <Stats p={data} />
    {!!data.goals?.length && <ul className="progress-goals readonly">{data.goals.map((g, i) => <li key={i}><div><strong>{g.title}</strong><small>{t('progress.checks', { count: g.checks })}</small></div></li>)}</ul>}
    {!!data.bests?.length && <ul className="progress-bests">{data.bests.map((b, i) => <li key={i}><div><strong>{b.label}</strong></div><span className="tabular-nums">{b.value} {t(`progress.unit.${b.unit}`)}</span></li>)}</ul>}
  </section>;
}
