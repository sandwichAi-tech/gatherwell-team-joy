import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Flag, Eye, EyeOff, Trash2, Ban, Check } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ResponsiveSheet } from '@/components/responsive-sheet';
import { ListSkeleton, RetryState, EmptyState } from '@/components/launch-states';
import { supabase } from '@/integrations/supabase/client';

const db = supabase as unknown as { rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: any; error: { message?: string } | null }> };

type QueueItem = { id: string; excerpt: string; scope: 'event' | 'topic'; scope_id: string; reports: number; created_at: string };
type ReportItem = { id: string; target_type: string; target_id: string; reason: string; status: string; created_at: string; excerpt: string | null; author_id: string | null };

const errKey = (e: unknown) => {
  const m = String((e as { message?: string })?.message ?? '');
  for (const k of ['reason_required', 'not_allowed', 'forbidden', 'not_found', 'invalid_action']) if (m.includes(k)) return `moderation.errors.${k}`;
  return 'profile.saveError';
};

/** Scoped moderation queue + open reports. Reporter identity is never shown. */
export function ModerationPanel({ teamId }: { teamId: string }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage === 'es' ? 'es-419' : 'en-US';
  const qc = useQueryClient();
  const [removeFor, setRemoveFor] = useState<string | null>(null);
  const [suspendFor, setSuspendFor] = useState<ReportItem | null>(null);
  const queueQ = useQuery({
    queryKey: ['moderation-queue', teamId],
    queryFn: async () => (await db.rpc('moderation_queue', { _team: teamId })).data as unknown as QueueItem[],
  });
  const reportsQ = useQuery({
    queryKey: ['moderation-reports', teamId],
    queryFn: async () => (await db.rpc('moderation_reports', { _team: teamId })).data as unknown as ReportItem[],
  });
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['moderation-queue', teamId] }); void qc.invalidateQueries({ queryKey: ['moderation-reports', teamId] }); };
  const act = async (fn: string, args: Record<string, unknown>, ok: string) => {
    const { error } = await db.rpc(fn, args);
    if (error) { toast.error(t(errKey(error))); return; }
    toast.success(t(ok)); refresh();
  };

  if (queueQ.isLoading || reportsQ.isLoading) return <ListSkeleton />;
  if (queueQ.error || reportsQ.error) return <RetryState retry={() => refresh()} />;
  const queue = queueQ.data ?? []; const reports = reportsQ.data ?? [];

  return <div className="moderation-panel">
    <h3>{t('moderation.reportsTitle')}</h3>
    {reports.length === 0 ? <p className="auth-subtitle">{t('moderation.noReports')}</p> :
      <ul className="settings-list">{reports.map(r => <li key={r.id} className="settings-row moderation-row">
        <span className="settings-label">
          <strong><Flag className="inline-icon" />{t(`moderation.reason.${r.reason}`)}</strong>
          {r.excerpt && <small className="muted">“{r.excerpt}”</small>}
          <small className="muted">{t('moderation.anonymousReporter')} · {new Date(r.created_at).toLocaleString(lang, { month: 'short', day: 'numeric' })}</small>
        </span>
        <span className="guest-button-row">
          {r.target_type === 'comment' && <Button size="sm" variant="secondary" onClick={() => setRemoveFor(r.target_id)}><Trash2 />{t('moderation.remove')}</Button>}
          {r.author_id && <Button size="sm" variant="secondary" onClick={() => setSuspendFor(r)}><Ban />{t('moderation.suspend')}</Button>}
          <Button size="sm" variant="ghost" onClick={() => void act('resolve_report', { _id: r.id, _action: 'resolved' }, 'moderation.resolved')}><Check />{t('moderation.resolve')}</Button>
          <Button size="sm" variant="ghost" onClick={() => void act('resolve_report', { _id: r.id, _action: 'dismissed' }, 'moderation.dismissed')}>{t('moderation.dismiss')}</Button>
        </span>
      </li>)}</ul>}

    <h3>{t('moderation.queueTitle')}</h3>
    {queue.length === 0 ? <EmptyState compact icon="ShieldCheck" text={t('moderation.empty')} /> :
      <ul className="settings-list">{queue.map(c => <li key={c.id} className="settings-row moderation-row">
        <span className="settings-label">
          <strong>“{c.excerpt}”</strong>
          <small className="muted">{t(`moderation.scope.${c.scope}`)} · {t('moderation.reportCount', { count: c.reports })} · {new Date(c.created_at).toLocaleString(lang, { month: 'short', day: 'numeric' })}</small>
        </span>
        <span className="guest-button-row">
          <Button size="sm" variant="secondary" onClick={() => void act('moderate_comment', { _id: c.id, _hidden: true }, 'moderation.hidden')}><EyeOff />{t('moderation.hide')}</Button>
          <Button size="sm" variant="secondary" onClick={() => void act('moderate_comment', { _id: c.id, _hidden: false }, 'moderation.shown')}><Eye />{t('moderation.unhide')}</Button>
          <Button size="sm" variant="ghost" className="danger-text" onClick={() => setRemoveFor(c.id)}><Trash2 />{t('moderation.remove')}</Button>
        </span>
      </li>)}</ul>}

    {removeFor && <RemoveSheet commentId={removeFor} onClose={() => setRemoveFor(null)} onDone={() => { setRemoveFor(null); refresh(); }} />}
    {suspendFor?.author_id && <SuspendSheet teamId={teamId} report={suspendFor} onClose={() => setSuspendFor(null)} onDone={() => { setSuspendFor(null); refresh(); }} />}
  </div>;
}

function RemoveSheet({ commentId, onClose, onDone }: { commentId: string; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation();
  const [reason, setReason] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true);
    const { error } = await db.rpc('moderate_comment', { _id: commentId, _hidden: true, _remove_reason: reason.trim() });
    setBusy(false);
    if (error) { toast.error(t(errKey(error))); return; }
    toast.success(t('moderation.removed')); onDone();
  };
  return <ResponsiveSheet open onOpenChange={o => !o && onClose()} title={t('moderation.removeTitle')} description={t('moderation.removeText')}>
    <form className="edit-form" onSubmit={submit}>
      <div><label className="field-label" htmlFor="mod-reason">{t('moderation.reasonLabel')}</label><Textarea id="mod-reason" required rows={3} maxLength={500} value={reason} onChange={e => setReason(e.target.value)} /></div>
      <Button type="submit" className="danger-button" disabled={busy || reason.trim().length < 3}>{t('moderation.removeConfirm')}</Button>
    </form>
  </ResponsiveSheet>;
}

function SuspendSheet({ teamId, report, onClose, onDone }: { teamId: string; report: ReportItem; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation();
  const [reason, setReason] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true);
    const { error } = await db.rpc('suspend_community', { _team: teamId, _user: report.author_id, _scope_type: 'team', _scope_id: null, _reason: reason.trim() });
    setBusy(false);
    if (error) { toast.error(t(errKey(error))); return; }
    toast.success(t('moderation.suspended')); onDone();
  };
  return <ResponsiveSheet open onOpenChange={o => !o && onClose()} title={t('moderation.suspendTitle')} description={t('moderation.suspendText')}>
    <form className="edit-form" onSubmit={submit}>
      <div><label className="field-label" htmlFor="sus-reason">{t('moderation.reasonLabel')}</label><Textarea id="sus-reason" required rows={3} maxLength={500} value={reason} onChange={e => setReason(e.target.value)} /></div>
      <Button type="submit" className="danger-button" disabled={busy || reason.trim().length < 3}>{t('moderation.suspendConfirm')}</Button>
    </form>
  </ResponsiveSheet>;
}
