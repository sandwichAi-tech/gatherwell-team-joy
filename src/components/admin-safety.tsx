import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ResponsiveSheet } from '@/components/responsive-sheet';
import { confirmAction } from '@/components/confirm-dialog';
import { GwIcon } from '@/components/gw-icon';
import { listSafety, actSafety, adminUserAction } from '@/lib/admin.functions';
import { safetyAction, type SafetyKind, type SafetyRow } from '@/lib/admin-safety';
import type { z } from 'zod';

type Action = z.infer<typeof safetyAction>;
export function AdminSafety({ kind }: { kind: SafetyKind }) {
  const { t, i18n } = useTranslation();
  const [term, setTerm] = useState(''); const [q, setQ] = useState(''); const [state, setState] = useState<'all' | 'active' | 'suspended' | 'draft' | 'published' | 'archived' | 'open' | 'closed' | 'mine' | 'escalated'>('all'); const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<SafetyRow | null>(null);
  const list = useServerFn(listSafety);
  const query = useQuery({ queryKey: ['admin', 'safety', kind, q, state, page], queryFn: () => list({ data: { kind, q, state, page } }), retry: false });
  const states = kind === 'reports' ? ['all', 'open', 'mine', 'escalated', 'closed'] : kind === 'offerings' ? ['all', 'published', 'draft', 'archived'] : kind === 'audit' ? ['all'] : ['all', 'active', 'suspended'];
  const date = (v: string) => new Intl.DateTimeFormat(i18n.resolvedLanguage === 'es' ? 'es-MX' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(v));
  return <section className="space-y-4" aria-label={t(`safety.tabs.${kind}`)}>
    <p className="muted-copy">{t('safety.platformScope')}</p>
    <form className="flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); setQ(term.trim()); setPage(0); }}>
      <label className="min-w-0 flex-1"><span className="field-label">{t('safety.search')}</span><Input className="field-input" value={term} maxLength={100} onChange={e => setTerm(e.target.value)} /></label>
      <label><span className="field-label">{t('safety.filter')}</span><select className="field-input min-h-12" value={state} onChange={e => { setState(e.target.value as typeof state); setPage(0); }}>{states.map(s => <option key={s} value={s}>{t(`safety.state.${s}`)}</option>)}</select></label>
      <Button type="submit"><GwIcon name="Search" />{t('safety.search')}</Button>
    </form>
    {query.isPending ? <p role="status">{t('admin.loading')}</p> : query.isError ? <div role="alert"><p>{t('safety.loadError')}</p><Button variant="secondary" onClick={() => void query.refetch()}>{t('safety.retry')}</Button></div> : <>
      <ul className="divide-y divide-border">{query.data.rows.map(row => <li key={row.id} className="py-3">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3"><div className="min-w-0 flex-1 break-words"><strong>{kind === 'audit' ? row.title : row.title || t('safety.unavailable')}</strong><p className="muted-copy">{t(`safety.types.${row.kind}`, { defaultValue: row.kind })}{row.state ? ` · ${t(`safety.state.${row.state}`, { defaultValue: row.state })}` : ''} · {date(row.created_at)}</p>
          {kind === 'audit' && <><p className="muted-copy">{t('safety.actor')}: {row.actor || t('safety.unavailable')} · {row.target_id}</p>{row.reason && <p>{row.reason}</p>}</>}
          {row.assignee && <p>{t('safety.assignee')}: {row.assignee}</p>}{row.escalated_at && <p>{t('safety.state.escalated')}</p>}{row.workspace && <p>{row.workspace}</p>}{row.members !== undefined && <p>{t('admin.teams.members', { count: row.members })}</p>}
        </div>{kind !== 'audit' && <Button variant="secondary" onClick={() => setSelected(row)}>{t('safety.review')}</Button>}</div>
      </li>)}</ul>
      {!query.data.rows.length && <p role="status" className="muted-copy">{t('admin.empty')}</p>}
      <nav className="flex items-center justify-between gap-2" aria-label={t('safety.pagination')}><Button variant="secondary" disabled={page === 0} onClick={() => setPage(p => p - 1)}><GwIcon name="ChevronLeft" />{t('safety.previous')}</Button><span>{t('safety.page', { page: page + 1 })}</span><Button variant="secondary" disabled={!query.data.hasNext} onClick={() => setPage(p => p + 1)}>{t('safety.next')}<GwIcon name="ChevronRight" /></Button></nav>
    </>}
    {selected && <SafetyDetail row={selected} kind={kind} onClose={() => setSelected(null)} />}
  </section>;
}

function SafetyDetail({ row, kind, onClose }: { row: SafetyRow; kind: SafetyKind; onClose: () => void }) {
  const { t } = useTranslation(); const qc = useQueryClient(); const act = useServerFn(actSafety); const account = useServerFn(adminUserAction);
  const [reason, setReason] = useState(''); const [busy, setBusy] = useState(false); const [user, setUser] = useState('');
  const actions: Action['action'][] = kind === 'reports' ? row.state === 'open' ? ['claim', 'escalate', 'resolve', 'dismiss', ...(['event', 'comment', 'photo', 'shoutout'].includes(row.kind) ? ['hide' as const] : [])] : [] : kind === 'offerings' ? row.state === 'published' ? ['unpublish'] : [] : kind === 'communities' ? row.state === 'suspended' ? ['restore'] : [] : ['suspend', 'restore'].filter(a => a === (row.state === 'suspended' ? 'restore' : 'suspend')) as Action['action'][];
  const run = async (action: Action['action'], community = false) => {
    if (!(await confirmAction({ title: t(`safety.action.${action}`), body: `${t('safety.confirm')}\n${reason}`, confirmLabel: t(`safety.action.${action}`), destructive: ['hide', 'unpublish', 'suspend'].includes(action) }))) return;
    setBusy(true);
    try {
      if (kind === 'users' && !community && (action === 'suspend' || action === 'restore')) {
        const r = await account({ data: { userId: row.id, action, reason, origin: window.location.origin } }); if (!r.ok) throw new Error(r.error);
      } else {
        const targetKind: Action['kind'] = community ? kind === 'teams' ? 'community_team' : 'community_event' : kind === 'reports' ? 'report' : kind === 'teams' ? 'team' : kind === 'communities' ? 'community' : ['event', 'retreat'].includes(row.kind) ? 'event' : 'offer';
        await act({ data: { kind: targetKind, id: row.id, action, reason, ...(community ? { user } : {}) } });
      }
      toast.success(t('admin.saved')); await qc.invalidateQueries({ queryKey: ['admin'] }); onClose();
    } catch { toast.error(t('safety.actionError')); } finally { setBusy(false); }
  };
  const canCommunity = kind === 'teams' || (kind === 'offerings' && ['event', 'retreat'].includes(row.kind));
  return <ResponsiveSheet open onOpenChange={v => { if (!v && !busy) onClose(); }} title={row.title || t('safety.unavailable')} description={t('safety.platformScope')} footer={<div className="flex flex-wrap gap-2">{actions.map(a => <Button key={a} variant={['hide', 'unpublish', 'suspend'].includes(a) ? 'destructive' : 'secondary'} disabled={busy || reason.trim().length < 3} onClick={() => void run(a)}>{t(`safety.action.${a}`)}</Button>)}<Button variant="secondary" disabled={busy} onClick={onClose}>{t('confirm.cancel')}</Button></div>}>
    <div className="space-y-4 break-words"><dl><dt>{t('safety.target')}</dt><dd>{row.target_id || row.id}</dd><dt>{t('safety.filter')}</dt><dd>{t(`safety.state.${row.state}`, { defaultValue: row.state || '—' })}</dd></dl>
      {kind === 'reports' && <p>{t(`report.reason.${row.reason}`, { defaultValue: row.reason || '' })}</p>}
      {kind === 'users' && <p className="muted-copy">{t('safety.accountScope')}</p>}{kind === 'teams' && <p className="muted-copy">{t('safety.teamScope')}</p>}{kind === 'communities' && <p className="muted-copy">{t('safety.communityScope')}</p>}
      <label className="block"><span className="field-label">{t('safety.reason')}</span><Textarea rows={3} maxLength={500} value={reason} onChange={e => setReason(e.target.value)} /></label>
      <p className="muted-copy">{t('safety.notePrivacy')}</p>
      {canCommunity && <section className="space-y-3"><h3>{t('safety.communityTitle')}</h3><p className="muted-copy">{t('safety.communityScope')}</p><label><span className="field-label">{t('safety.userId')}</span><Input value={user} onChange={e => setUser(e.target.value)} /></label><Button variant="destructive" disabled={busy || reason.trim().length < 3 || !/^[0-9a-f-]{36}$/i.test(user)} onClick={() => void run('suspend', true)}>{t('safety.action.suspend')}</Button></section>}
    </div>
  </ResponsiveSheet>;
}