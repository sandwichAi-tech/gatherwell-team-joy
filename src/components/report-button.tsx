import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ResponsiveSheet } from '@/components/responsive-sheet';
import { GwIcon } from '@/components/gw-icon';

export type ReportTarget = 'event' | 'shoutout' | 'photo' | 'activity' | 'announcement' | 'comment';
const REASONS = ['inappropriate', 'spam', 'claim', 'other'] as const;

/** Small flag button that lets anyone report content to platform staff. */
export function ReportButton({ type, id, className = '', label = false }: { type: ReportTarget; id: string; className?: string; label?: boolean }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof REASONS)[number] | null>(null);
  const [note, setNote] = useState(''); const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!reason) return;
    setBusy(true);
    const { error } = await supabase.rpc('report_content', { _type: type, _id: id, _reason: reason, _note: note });
    setBusy(false);
    if (error) { toast.error(t(error.message.includes('rate_limited') ? 'report.tooMany' : 'report.error')); return; }
    toast.success(t('report.thanks')); setOpen(false); setReason(null); setNote('');
  };
  return <>
    <button type="button" className={`report-button ${className}`} aria-label={t('report.action')} title={t('report.action')} onClick={() => setOpen(true)}>
      <GwIcon name="Flag" size={18} />{label && <span>{t('report.action')}</span>}
    </button>
    <ResponsiveSheet open={open} onOpenChange={setOpen} title={t('report.title')} description={t('report.subtitle')}>
      <div className="edit-form">
        <div className="report-reasons" role="radiogroup" aria-label={t('report.reasonLabel')}>
          {REASONS.map(r => <button key={r} type="button" role="radio" aria-checked={reason === r} className={`choice-card ${reason === r ? 'is-selected' : ''}`} onClick={() => setReason(r)}><strong>{t(`report.reason.${r}`)}</strong></button>)}
        </div>
        <div className="form-field"><label className="field-label" htmlFor="report-note">{t('report.noteLabel')}</label>
          <Textarea id="report-note" rows={3} maxLength={500} className="field-textarea" value={note} onChange={e => setNote(e.target.value)} /></div>
        <div className="confirm-actions"><Button variant="secondary" onClick={() => setOpen(false)}>{t('report.cancel')}</Button><Button disabled={!reason || busy} onClick={send}>{t('report.send')}</Button></div>
      </div>
    </ResponsiveSheet>
  </>;
}

/** Calm banners for platform broadcasts and a paused team, shown above every app screen. */
export function PlatformNotices({ teamId }: { teamId: string | null | undefined }) {
  const { t, i18n } = useTranslation(); const qc = useQueryClient();
  const es = i18n.resolvedLanguage === 'es';
  const { data: broadcast } = useQuery({ queryKey: ['my-broadcast'], queryFn: async () => { const { data } = await supabase.rpc('my_broadcasts'); return data?.[0] ?? null; }, staleTime: 5 * 60_000 });
  const { data: paused } = useQuery({ queryKey: ['team-paused', teamId], enabled: !!teamId, queryFn: async () => { const { data } = await supabase.from('team_suspensions').select('reason').eq('team_id', teamId!).maybeSingle(); return data; } });
  const dismiss = async () => {
    if (!broadcast) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await supabase.from('broadcast_reads').insert({ broadcast_id: broadcast.id, user_id: user.id });
    await qc.invalidateQueries({ queryKey: ['my-broadcast'] });
  };
  if (!broadcast && !paused) return null;
  return <div className="platform-notices">
    {paused && <div className="notice-banner is-warning" role="status"><GwIcon name="Pause" /><div><strong>{t('admin.pausedTitle')}</strong><p>{t('admin.pausedBody')}</p></div></div>}
    {broadcast && <div className="notice-banner" role="status"><GwIcon name="Megaphone" /><div><strong>{es ? broadcast.title_es : broadcast.title_en}</strong><p>{es ? broadcast.body_es : broadcast.body_en}</p></div>
      <button type="button" className="notice-close" aria-label={t('report.dismiss')} onClick={dismiss}><GwIcon name="X" size={18} /></button></div>}
  </div>;
}
