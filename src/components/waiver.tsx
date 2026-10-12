import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { FileText } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { ResponsiveSheet } from '@/components/responsive-sheet';
import { supabase } from '@/integrations/supabase/client';

export type EventWaiver = { required: boolean; version?: number; draft?: boolean; title_en?: string; title_es?: string; body_en?: string; body_es?: string };
const db = supabase as unknown as { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>; from: (t: string) => any };

/** Bound so supabase keeps its `this` (a detached `.rpc` throws "reading 'rest'"). */
export const waiverRpc = (fn: string, args: Record<string, unknown>) => db.rpc(fn, args);

export function useEventWaiver(eventId: string | undefined) {
  return useQuery({ queryKey: ['event-waiver', eventId], enabled: !!eventId, staleTime: 5 * 60_000,
    queryFn: async () => { const { data } = await db.rpc('event_waiver_k', { _event: eventId, _token: new URLSearchParams(window.location.search).get('k') }); return (data ?? { required: false }) as EventWaiver; } });
}

/** Read-and-accept block used in the RSVP step and at walk-in check-in. */
export function WaiverAccept({ waiver, name, accepted, onName, onAccepted, idPrefix = 'wv' }: { waiver: EventWaiver; name: string; accepted: boolean; onName: (v: string) => void; onAccepted: (v: boolean) => void; idPrefix?: string }) {
  const { t, i18n } = useTranslation(); const es = i18n.resolvedLanguage === 'es';
  if (!waiver.required) return null;
  const title = (es ? waiver.title_es : waiver.title_en) ?? ''; const body = (es ? waiver.body_es : waiver.body_en) ?? '';
  return <fieldset className="waiver-block">
    <legend className="field-label"><FileText />{title}</legend>
    {waiver.draft && <span className="chip quiet-chip">{t('waiver.draft')}</span>}
    <div className="waiver-text" tabIndex={0} role="document" aria-label={title}>{body.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}</div>
    <label className="field-label" htmlFor={`${idPrefix}-name`}>{t('waiver.typeName')}</label>
    <Input id={`${idPrefix}-name`} autoComplete="name" maxLength={120} className="field-input" value={name} onChange={e => onName(e.target.value)} />
    <label className="guest-consent"><Checkbox checked={accepted} onCheckedChange={v => onAccepted(!!v)} /><span>{t('waiver.agree')}</span></label>
  </fieldset>;
}

export const waiverReady = (w: EventWaiver | undefined, name: string, accepted: boolean) => !w?.required || (accepted && name.trim().length >= 2);

/** Host control on the gathering page: require the waiver + edit the team waiver. */
export function WaiverEventToggle({ eventId, teamId, value }: { eventId: string; teamId: string; value: boolean }) {
  const { t } = useTranslation(); const qc = useQueryClient();
  const [on, setOn] = useState(value); const [editing, setEditing] = useState(false);
  useEffect(() => setOn(value), [value]);
  const toggle = async (v: boolean) => {
    setOn(v);
    const { error } = await db.from('events').update({ requires_waiver: v }).eq('id', eventId);
    if (error) { setOn(!v); toast.error(t('profile.saveError')); return; }
    void qc.invalidateQueries({ queryKey: ['event-waiver', eventId] }); void qc.invalidateQueries({ queryKey: ['event', eventId] });
  };
  return <section className="panel waiver-toggle">
    <div className="setting-row"><div><h2>{t('waiver.require')}</h2><p className="auth-subtitle">{t('waiver.requireHelp')}</p></div>
      <Switch checked={on} onCheckedChange={toggle} aria-label={t('waiver.require')} /></div>
    <Button variant="secondary" onClick={() => setEditing(true)}><FileText />{t('waiver.edit')}</Button>
    <WaiverEditorSheet teamId={teamId} open={editing} onClose={() => setEditing(false)} />
  </section>;
}

type WaiverRow = { team_id: string; title_en: string; title_es: string; body_en: string; body_es: string; version: number; is_draft: boolean };
export function WaiverEditorSheet({ teamId, open, onClose }: { teamId: string; open: boolean; onClose: () => void }) {
  const { t } = useTranslation(); const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['waiver', teamId], enabled: open, queryFn: async () => (await db.from('waivers').select('*').eq('team_id', teamId).maybeSingle()).data as WaiverRow | null });
  const [f, setF] = useState<WaiverRow | null>(null); const [busy, setBusy] = useState(false);
  useEffect(() => { if (data) setF(data); }, [data]);
  const save = async () => {
    if (!f) return; setBusy(true);
    const { error } = await db.from('waivers').update({ title_en: f.title_en.trim(), title_es: f.title_es.trim(), body_en: f.body_en.trim(), body_es: f.body_es.trim() }).eq('team_id', teamId);
    setBusy(false);
    if (error) { toast.error(t('profile.saveError')); return; }
    toast.success(t('waiver.saved')); void qc.invalidateQueries({ queryKey: ['waiver', teamId] }); void qc.invalidateQueries({ queryKey: ['event-waiver'] }); onClose();
  };
  return <ResponsiveSheet open={open} onOpenChange={o => !o && onClose()} title={t('waiver.editTitle')} description={t('waiver.editHelp')}>
    {!f ? <p className="auth-subtitle">{t('publicEvent.loading')}</p> : <div className="edit-form">
      <p className="waiver-meta">{f.is_draft && <span className="chip quiet-chip">{t('waiver.draft')}</span>}<span>{t('waiver.version', { n: f.version })}</span></p>
      <label className="field-label" htmlFor="wv-ten">{t('waiver.titleEn')}</label><Input id="wv-ten" maxLength={120} className="field-input" value={f.title_en} onChange={e => setF({ ...f, title_en: e.target.value })} />
      <label className="field-label" htmlFor="wv-ben">{t('waiver.bodyEn')}</label><Textarea id="wv-ben" rows={8} maxLength={8000} className="field-textarea" value={f.body_en} onChange={e => setF({ ...f, body_en: e.target.value })} />
      <label className="field-label" htmlFor="wv-tes">{t('waiver.titleEs')}</label><Input id="wv-tes" maxLength={120} className="field-input" value={f.title_es} onChange={e => setF({ ...f, title_es: e.target.value })} />
      <label className="field-label" htmlFor="wv-bes">{t('waiver.bodyEs')}</label><Textarea id="wv-bes" rows={8} maxLength={8000} className="field-textarea" value={f.body_es} onChange={e => setF({ ...f, body_es: e.target.value })} />
      <p className="auth-subtitle">{t('waiver.versionHelp')}</p>
      <Button className="onboarding-continue" disabled={busy || ![f.title_en, f.title_es, f.body_en, f.body_es].every(v => v.trim())} onClick={save}>{t('waiver.save')}</Button>
    </div>}
  </ResponsiveSheet>;
}
