import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ResponsiveSheet } from '@/components/responsive-sheet';
import { safeWaiverPdf } from '@/lib/event-agreements';
import { FORM_KINDS, FORM_DESCRIPTION_MAX, formLanguages, safeFormFileName, type FormKind } from '@/lib/host-forms';
import { useServerFn } from '@tanstack/react-start';
import { uploadHostWaiver, signHostWaiver, cleanupHostWaiverUpload } from '@/lib/host-waivers.functions';
import { Upload, FileText } from '@/components/icons';

export type LibraryWaiver = { id: string; name: string; description: string; form_kind: FormKind; body_en: string; body_es: string; version: number; archived: boolean; file_path: string | null; file_name: string | null; is_default: boolean; updated_at?: string };
export const emptyWaiver = (): LibraryWaiver => ({ id: '', name: '', description: '', form_kind: 'waiver', body_en: '', body_es: '', version: 0, archived: false, file_path: null, file_name: null, is_default: false });

/** Owner-scoped: RLS only returns forms owned by the signed-in host. */
export function useWaiverLibrary(userId: string) {
  return useQuery({ queryKey: ['waiver-library', userId], enabled: !!userId, queryFn: async () => {
    const { data, error } = await supabase.from('waiver_library').select('id,name,description,form_kind,body_en,body_es,version,archived,file_path,file_name,is_default,updated_at').order('updated_at', { ascending: false });
    if (error) throw error; return data as LibraryWaiver[];
  } });
}
/** Caller's own draft/published event counts per form (server-scoped to the caller). */
export function useFormUsage(userId: string) {
  return useQuery({ queryKey: ['host-form-usage', userId], enabled: !!userId, queryFn: async () => {
    const { data, error } = await supabase.rpc('host_form_usage'); if (error) throw error;
    return Object.fromEntries((data ?? []).map(r => [r.library_id, { drafts: r.drafts, published: r.published }])) as Record<string, { drafts: number; published: number }>;
  } });
}

const fmt = (d: string | undefined, lang: string) => d ? new Date(d).toLocaleDateString(lang, { year: 'numeric', month: 'short', day: 'numeric' }) : '';

export function HostWaiverEditor({ teamId, initial, usage, onClose, onSaved }: { teamId: string; initial: LibraryWaiver; usage?: { drafts: number; published: number } | undefined; onClose: () => void; onSaved?: (id: string) => void }) {
  const { t, i18n } = useTranslation(); const qc = useQueryClient(); const es = i18n.resolvedLanguage === 'es';
  const [edit, setEdit] = useState(initial); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [confirmArchive, setConfirmArchive] = useState(false);
  const upload = useServerFn(uploadHostWaiver); const cleanup = useServerFn(cleanupHostWaiverUpload); const [uploads, setUploads] = useState<string[]>([]);
  const clearUploads = async (keep?: string | null) => { for (const path of uploads) if (path !== keep) await cleanup({ data: { path } }).catch(() => null); setUploads([]); };
  const close = async () => { if (busy) return; await clearUploads(); onClose(); };
  useEffect(() => { const id = requestAnimationFrame(() => document.getElementById('wl-name')?.focus()); return () => cancelAnimationFrame(id); }, []);
  const descTooLong = edit.description.length > FORM_DESCRIPTION_MAX;
  const valid = !!edit.name.trim() && (!!edit.body_en.trim() || !!edit.file_path) && !descTooLong;
  const inUse = (usage?.drafts ?? 0) + (usage?.published ?? 0) > 0;
  const save = async (archived = false) => {
    if (busy) return; if (!valid) { setError(t(descTooLong ? 'hostForms.descTooLong' : 'waiverLibrary.saveError')); return; } setBusy(true); setError('');
    try {
      const r = await supabase.rpc('save_host_form', { _team: teamId, _id: edit.id || null, _name: edit.name, _description: edit.description, _kind: edit.form_kind, _en: edit.body_en, _es: edit.body_es, _file: edit.file_path, _filename: edit.file_name, _archive: archived } as never);
      if (r.error || !r.data) throw r.error;
      await clearUploads(edit.file_path); await qc.invalidateQueries({ queryKey: ['waiver-library'] }); await qc.invalidateQueries({ queryKey: ['host-form-usage'] }); onSaved?.(r.data as string); onClose();
    } catch (e) { setError(t((e as { message?: string })?.message?.includes('invalid_file') ? 'eventWaivers.errors.fileType' : 'waiverLibrary.saveError')); } finally { setBusy(false); }
  };
  const file = async (f: File) => {
    if (busy) return;
    if (!safeWaiverPdf(f.size, f.type, await f.slice(0, 5).text())) { setError(t('hostForms.fileRejected')); return; }
    setBusy(true); setError('');
    try { const form = new FormData(); form.set('file', f); const r = await upload({ data: form }); setUploads(x => [...x, r.path]); setEdit(e => ({ ...e, file_path: r.path, file_name: safeFormFileName(f.name) })); }
    catch { setError(t('eventWaivers.errors.upload')); } finally { setBusy(false); }
  };
  return <ResponsiveSheet open title={edit.id ? t('hostForms.editTitle') : t('hostForms.newTitle')} onOpenChange={o => !o && void close()} footer={<Button disabled={busy || !valid} onClick={() => void save()}>{busy ? t('onboarding.saving') : t('waiver.save')}</Button>}>
    <div className="edit-form">
      <p>{t('waiverLibrary.versionHelp')}</p><p className="field-hint">{t('waiverLibrary.textOnly')}</p>
      <label htmlFor="wl-name">{t('hostForms.name')}</label><Input id="wl-name" maxLength={120} value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} />
      <label htmlFor="wl-desc">{t('hostForms.description')} <span className="field-hint">({t('hostForms.optional')})</span></label>
      <Textarea id="wl-desc" rows={2} value={edit.description} aria-invalid={descTooLong} aria-describedby="wl-desc-help" onChange={e => setEdit({ ...edit, description: e.target.value })} />
      <p id="wl-desc-help" className={descTooLong ? 'field-error' : 'field-hint'}>{t('hostForms.descCount', { n: edit.description.length, max: FORM_DESCRIPTION_MAX })}</p>
      <label htmlFor="wl-kind">{t('hostForms.kind')}</label>
      <select id="wl-kind" className="field-input w-full" value={edit.form_kind} onChange={e => setEdit({ ...edit, form_kind: e.target.value as FormKind })}>
        {FORM_KINDS.map(k => <option key={k} value={k}>{t(`hostForms.kinds.${k}`)}</option>)}
      </select>
      <label htmlFor="wl-body">{t('eventWaivers.bodyLabel')} · {t(es ? 'me.spanish' : 'me.english')}</label><Textarea id="wl-body" rows={8} maxLength={12000} value={es ? edit.body_es : edit.body_en} onChange={e => setEdit({ ...edit, [es ? 'body_es' : 'body_en']: e.target.value })} />
      {es && !edit.body_en.trim() && !edit.file_path && <p className="field-hint">{t('builderAgreements.englishNeeded')}</p>}
      <p id="wl-file-help" className="field-hint">{t('hostForms.fileRules')}</p>
      <label className="button-like secondary"><Upload />{busy ? t('onboarding.saving') : t(edit.file_path ? 'hostForms.replaceFile' : 'eventWaivers.uploadPdf')}<input type="file" accept="application/pdf,.pdf" aria-describedby="wl-file-help" disabled={busy} className="sr-only" onChange={e => { const f = e.target.files?.[0]; if (f) void file(f); e.target.value = ''; }} /></label>
      {edit.file_name && <p className="host-form-file"><FileText />{edit.file_name} <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => setEdit({ ...edit, file_path: null, file_name: null })}>{t('builderAgreements.remove')}</Button></p>}
      {error && <p role="alert" className="field-error">{error}</p>}
      {edit.id && !confirmArchive && <Button variant="secondary" disabled={busy} onClick={() => inUse ? setConfirmArchive(true) : void save(true)}>{t('eventWaivers.archive')}</Button>}
      {confirmArchive && <div role="alertdialog" aria-labelledby="wl-archive-q" className="agreement-item">
        <p id="wl-archive-q">{t('hostForms.archiveConfirm', { drafts: usage?.drafts ?? 0, published: usage?.published ?? 0 })}</p>
        <div className="chip-row"><Button variant="destructive" disabled={busy} onClick={() => void save(true)}>{t('hostForms.archiveYes')}</Button><Button variant="secondary" onClick={() => setConfirmArchive(false)}>{t('common.cancel')}</Button></div>
      </div>}
    </div>
  </ResponsiveSheet>;
}

export function HostWaiverPreview({ waiver, onClose }: { waiver: { id: string; name: string; version: number; body_en: string; body_es: string; file_path: string | null; file_name: string | null; description?: string }; onClose: () => void }) {
  const { t, i18n } = useTranslation(); const es = i18n.resolvedLanguage === 'es'; const sign = useServerFn(signHostWaiver); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const body = es ? waiver.body_es || waiver.body_en : waiver.body_en;
  return <ResponsiveSheet open title={waiver.name} onOpenChange={o => !o && onClose()}><p>{t('waiver.version', { n: waiver.version })}</p>
    {waiver.description ? <p className="field-hint">{waiver.description}</p> : null}
    {body ? <div className="waiver-text whitespace-pre-wrap" role="document" tabIndex={0}>{body}</div> : null}
    {waiver.file_path && <Button variant="secondary" disabled={busy} onClick={async () => { setBusy(true); setError(''); try { const r = await sign({ data: { id: waiver.id, version: waiver.version } }); if (r.url) window.open(r.url, '_blank', 'noopener'); else setError(t('eventWaivers.errors.file')); } catch { setError(t('eventWaivers.errors.file')); } finally { setBusy(false); } }}><FileText />{t('eventWaivers.openFile', { name: waiver.file_name })}</Button>}
    {error && <p role="alert">{error}</p>}
  </ResponsiveSheet>;
}

export function WaiverLibrary({ teamId, userId }: { teamId: string; userId: string }) {
  const { t, i18n } = useTranslation(); const lang = i18n.resolvedLanguage === 'es' ? 'es' : 'en'; const qc = useQueryClient(); const q = useWaiverLibrary(userId); const usage = useFormUsage(userId);
  const [edit, setEdit] = useState<LibraryWaiver | null>(null); const [preview, setPreview] = useState<LibraryWaiver | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [showArchived, setShowArchived] = useState(false);
  const list = (q.data ?? []).filter(w => showArchived || !w.archived); const archivedCount = (q.data ?? []).filter(w => w.archived).length;
  return <section className="form-section host-forms" aria-busy={q.isPending}>
    <p className="field-hint">{t('waiverLibrary.scope')}</p>
    <p className="field-hint">{t('builderAgreements.noLegalAdvice')}</p>
    <Button onClick={() => { setError(''); setEdit(emptyWaiver()); }}>{t('hostForms.add')}</Button>
    {q.isPending ? <p role="status">{t('publicEvent.loading')}</p>
      : q.error ? <div role="alert"><p>{t('eventWaivers.errors.load')}</p><Button variant="secondary" onClick={() => void q.refetch()}>{t('error.retry')}</Button></div>
      : !list.length ? <p>{t('hostForms.empty')}</p>
      : <ul className="plain-list host-form-list">{list.map(w => { const u = usage.data?.[w.id]; const langs = formLanguages(w);
        return <li key={w.id} className="agreement-item">
          <div className="agreement-item-head"><strong>{w.name}</strong><span className="chip">{t(`hostForms.kinds.${w.form_kind}`)}</span>{w.is_default && <span className="chip">{t('waiverLibrary.default')}</span>}{w.archived && <span className="chip">{t('eventWaivers.archived')}</span>}</div>
          {w.description && <p>{w.description}</p>}
          <dl className="agreement-facts">
            <div><dt>{t('builderAgreements.versionLabel')}</dt><dd>{t('waiver.version', { n: w.version })} · {t('hostForms.updated', { date: fmt(w.updated_at, lang) })}</dd></div>
            <div><dt>{t('builderAgreements.source')}</dt><dd>{w.file_name ? t('builderAgreements.sourcePdf', { name: w.file_name }) : t('builderAgreements.sourceText')}</dd></div>
            <div><dt>{t('builderAgreements.languages')}</dt><dd>{langs.length ? langs.map(l => t(l === 'es' ? 'hostForms.langEs' : 'hostForms.langEn')).join(' · ') : t('builderAgreements.pdfOnly')}</dd></div>
            <div><dt>{t('hostForms.usage')}</dt><dd>{usage.isPending ? t('builderAgreements.status.loading') : usage.error ? t('hostForms.usageError') : t('hostForms.usageCounts', { drafts: u?.drafts ?? 0, published: u?.published ?? 0 })}</dd></div>
          </dl>
          <div className="chip-row"><Button variant="secondary" onClick={() => setPreview(w)}>{t('eventWaivers.preview')}</Button>{!w.archived && <><Button variant="secondary" onClick={() => { setError(''); setEdit(w); }}>{t('builderAgreements.replace')}</Button><Button variant="ghost" disabled={busy} aria-pressed={w.is_default} onClick={async () => { setBusy(true); setError(''); const r = await supabase.rpc('set_host_waiver_default', { _id: w.id, _on: !w.is_default }); if (r.error) setError(t('waiverLibrary.saveError')); await qc.invalidateQueries({ queryKey: ['waiver-library'] }); setBusy(false); }}>{t(w.is_default ? 'waiverLibrary.clearDefault' : 'waiverLibrary.makeDefault')}</Button></>}</div>
        </li>; })}</ul>}
    {archivedCount > 0 && <Button variant="ghost" aria-pressed={showArchived} onClick={() => setShowArchived(s => !s)}>{t(showArchived ? 'hostForms.hideArchived' : 'hostForms.showArchived', { count: archivedCount })}</Button>}
    {error && <p role="alert" className="field-error">{error}</p>}
    {preview && <HostWaiverPreview waiver={preview} onClose={() => setPreview(null)} />}
    {edit && <HostWaiverEditor teamId={teamId} initial={edit} usage={edit.id ? usage.data?.[edit.id] : undefined} onClose={() => setEdit(null)} />}
  </section>;
}
