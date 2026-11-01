import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ResponsiveSheet } from '@/components/responsive-sheet';
import { EventWaiversAccept } from '@/components/event-waivers';
import { supabase } from '@/integrations/supabase/client';
import { missingBackendFunction } from '@/lib/cancellation';
import { acceptedPayload, missingRequired, type PublicWaiver, type WaiverChoices } from '@/lib/event-waivers';
import { useWaiverConsentState } from '@/lib/waiver-consent-state';

type Err = { code?: string; message: string } | null;
const db = supabase as unknown as { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: Err }>; from: (t: string) => any };

type Pinned = { id: string; title_en: string; body_en: string; file_name: string | null; version: number; library_id: string; library_version: number };
type Lib = { id: string; name: string; version: number; archived: boolean };

/** Host, any event state: shows each library-linked waiver's pinned version, a preview, and a confirmed update to the latest library version. */
export function EventWaiverVersions({ eventId, userId }: { eventId: string; userId: string }) {
  const { t } = useTranslation(); const qc = useQueryClient();
  const pinned = useQuery({ queryKey: ['event-waiver-pins', eventId, userId], queryFn: async () => {
    const { data, error } = await db.from('event_waivers').select('id,title_en,body_en,file_name,version,library_id,library_version').eq('event_id', eventId).is('archived_at', null).not('library_id', 'is', null).order('position');
    if (error) throw error; return (data ?? []) as Pinned[];
  } });
  const ids = (pinned.data ?? []).map(p => p.library_id);
  const lib = useQuery({ queryKey: ['event-waiver-pins-lib', userId, ids.join(',')], enabled: ids.length > 0, queryFn: async () => {
    const { data, error } = await db.from('waiver_library').select('id,name,version,archived').eq('owner_id', userId).in('id', ids);
    if (error) throw error; return (data ?? []) as Lib[];
  } });
  const [preview, setPreview] = useState<Pinned | null>(null);
  const [confirm, setConfirm] = useState<{ pin: Pinned; to: number; count: number } | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  if (pinned.isError) return <section className="panel"><p className="field-error" role="alert">{t('eventWaivers.errors.load')} <Button variant="ghost" onClick={() => void pinned.refetch()}>{t('error.retry')}</Button></p></section>;
  if (!pinned.data?.length) return null;
  const startUpdate = async (pin: Pinned, to: number) => {
    setError(null); setBusy(true);
    const { data, error: e } = await db.rpc('waiver_reaccept_count', { _event: eventId }); setBusy(false);
    if (e) { toast.error(t(missingBackendFunction(e) ? 'waiverVersions.errors.notReady' : 'waiverVersions.errors.generic')); return; }
    setConfirm({ pin, to, count: Number(data ?? 0) });
  };
  const apply = async () => {
    if (!confirm || busy) return; setBusy(true); setError(null);
    const { error: e } = await db.rpc('replace_event_waiver_version', { _event: eventId, _event_waiver: confirm.pin.id, _library_version: confirm.to, _expected: confirm.count });
    setBusy(false);
    if (e) { setError(t(e.message.includes('reaccept_count_changed') ? 'waiverVersions.errors.countChanged' : missingBackendFunction(e) ? 'waiverVersions.errors.notReady' : 'waiverVersions.errors.generic')); return; }
    toast.success(t('waiverVersions.applied', { version: confirm.to })); setConfirm(null);
    await qc.invalidateQueries({ queryKey: ['event-waiver-pins', eventId] }); void qc.invalidateQueries({ queryKey: ['event-waivers', eventId] });
  };
  return <section className="panel event-waiver-versions" aria-labelledby={`ewv-${eventId}`}>
    <h2 id={`ewv-${eventId}`}>{t('waiverVersions.title')}</h2>
    <p className="field-hint">{t('waiverVersions.help')}</p>
    <ul className="plain-list">{pinned.data.map(p => {
      const l = lib.data?.find(x => x.id === p.library_id); const newer = l && !l.archived && l.version > p.library_version;
      return <li key={p.id} className="waiver-version-row">
        <div><strong>{p.title_en}</strong><p className="muted">{t('waiverVersions.pinned', { version: p.library_version })}{newer ? ` · ${t('waiverVersions.newer', { version: l.version })}` : ''}</p></div>
        <div className="guest-button-row">
          <Button variant="secondary" onClick={() => setPreview(p)}>{t('waiverVersions.preview')}</Button>
          {newer && <Button disabled={busy} aria-busy={busy} onClick={() => void startUpdate(p, l.version)}>{t('waiverVersions.useNewer', { version: l.version })}</Button>}
          <Button asChild variant="ghost"><Link to="/waivers">{t('waiverVersions.editLibrary')}</Link></Button>
        </div>
      </li>;
    })}</ul>
    <p className="field-hint">{t('waiverVersions.platformSeparate')}</p>
    <ResponsiveSheet open={!!preview} onOpenChange={o => !o && setPreview(null)} title={preview?.title_en ?? ''} description={t('waiverVersions.pinned', { version: preview?.library_version ?? 0 })}
      footer={<Button className="onboarding-continue" onClick={() => setPreview(null)}>{t('eventWaivers.viewer.close')}</Button>}>
      {preview && <div className="waiver-text" tabIndex={0} role="document">{(preview.body_en || t('waiverVersions.fileOnly', { name: preview.file_name ?? '' })).split(/\n{2,}/).map((x, i) => <p key={i}>{x}</p>)}</div>}
    </ResponsiveSheet>
    <ResponsiveSheet open={!!confirm} onOpenChange={o => !o && setConfirm(null)} title={t('waiverVersions.confirmTitle', { version: confirm?.to ?? 0 })} description={t('waiverVersions.eventOnly')}
      footer={<div className="confirm-actions"><Button variant="secondary" onClick={() => setConfirm(null)}>{t('gathering.keep')}</Button><Button disabled={busy} aria-busy={busy} onClick={() => void apply()}>{t('waiverVersions.confirm')}</Button></div>}>
      {confirm && <div className="edit-form">
        <p role="status"><strong>{t('waiverVersions.reacceptCount', { count: confirm.count })}</strong></p>
        <p>{t('waiverVersions.keepsRecords')}</p>
        <p>{t('waiverVersions.future')}</p>
        <p className="field-hint">{t('waiverVersions.libraryNote')}</p>
        {error && <p className="field-error" role="alert">{error}</p>}
      </div>}
    </ResponsiveSheet>
  </section>;
}

/** Attendee (private code): accept a waiver version that changed after they registered. Hidden when nothing is needed. */
export function ReacceptWaivers({ code }: { code: string }) {
  const { t } = useTranslation(); const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['waivers-reaccept', code], retry: false, queryFn: async () => {
    const { data: d, error } = await db.rpc('waivers_needing_reaccept', { _code: code }); if (error) return [] as PublicWaiver[]; return (Array.isArray(d) ? d : []) as PublicWaiver[];
  } });
  const list = data ?? [];
  const [choices, setChoices] = useWaiverConsentState<WaiverChoices>(`${code}:${list.map(w => `${w.id}:${w.version}`).join(',')}`, {});
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  if (!list.length) return null;
  const save = async () => {
    if (busy) return;
    if (missingRequired(list, choices).length) { setError(t('eventWaivers.errors.required')); return; }
    setBusy(true); setError(null);
    const { error: e } = await db.rpc('reaccept_event_waivers', { _code: code, _accepted: acceptedPayload(list, choices) }); setBusy(false);
    if (e) { setError(t(e.message.includes('waiver_stale') ? 'waiverVersions.errors.stale' : 'waiverVersions.errors.generic')); void qc.invalidateQueries({ queryKey: ['waivers-reaccept', code] }); return; }
    toast.success(t('waiverVersions.reaccepted')); await qc.invalidateQueries({ queryKey: ['waivers-reaccept', code] }); void qc.invalidateQueries({ queryKey: ['my-event-waivers', code] });
  };
  return <section className="guest-card reaccept-waivers" aria-labelledby={`ra-${code}`}>
    <h3 id={`ra-${code}`} className="guest-subhead">{t('waiverVersions.attendeeTitle')}</h3>
    <p>{t('waiverVersions.attendeeHelp')}</p>
    <EventWaiversAccept waivers={list} choices={choices} onChange={setChoices} />
    {error && <p className="field-error" role="alert">{error}</p>}
    <Button disabled={busy} aria-busy={busy} onClick={() => void save()}>{t('waiverVersions.attendeeSave')}</Button>
  </section>;
}
