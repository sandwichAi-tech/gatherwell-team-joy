import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Download, ExternalLink, FileText, Pencil, Plus, ShieldCheck, Trash2, Upload } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { ResponsiveSheet } from '@/components/responsive-sheet';
import { LangPair } from '@/components/lang-fields';
import { confirmAction } from '@/components/confirm-dialog';
import { supabase } from '@/integrations/supabase/client';
import { downloadCsv } from '@/lib/csv';
import { signEventWaiverFile } from '@/lib/event-waivers.functions';
import {
  WAIVER_KINDS, canAccept, consentRows, consentState, waiverBody, waiverTitle,
  type PublicWaiver, type WaiverChoices, type WaiverKind, type WaiverStatus,
} from '@/lib/event-waivers';

const db = supabase as unknown as { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>; from: (t: string) => any };
const inviteToken = () => (typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('k'));

/** Active waivers an attendee must see for this event (empty when none or not visible). */
export function useEventWaivers(eventId: string | undefined) {
  return useQuery({
    queryKey: ['event-waivers', eventId], enabled: !!eventId, staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await db.rpc('event_waiver_list', { _event: eventId, _token: inviteToken() });
      if (error) throw error;
      return (Array.isArray(data) ? data : []) as PublicWaiver[];
    },
  });
}

function useOpenWaiverFile() {
  const sign = useServerFn(signEventWaiverFile);
  return async (waiverId: string, opts: { code?: string; version?: number } = {}) => {
    const tab = window.open('', '_blank', 'noopener');
    const { url } = await sign({ data: { waiverId, token: inviteToken(), code: opts.code ?? null, version: opts.version ?? null } });
    if (!url) { tab?.close(); return false; }
    if (tab) tab.location.href = url; else window.location.assign(url);
    return true;
  };
}

/** Attendee review-and-accept list. Checkboxes always start unchecked; documents must be opened first. */
export function EventWaiversAccept({ waivers, choices, onChange }: { waivers: PublicWaiver[]; choices: WaiverChoices; onChange: (c: WaiverChoices) => void }) {
  const { t, i18n } = useTranslation(); const lang = i18n.resolvedLanguage ?? 'en';
  const open = useOpenWaiverFile(); const [busy, setBusy] = useState<string | null>(null);
  if (!waivers.length) return null;
  const set = (id: string, patch: Partial<WaiverChoices[string]>) => onChange({ ...choices, [id]: { accepted: false, opened: false, ...choices[id], ...patch } });
  return <div className="event-waivers" role="group" aria-label={t('eventWaivers.groupLabel')}>
    {waivers.map(w => {
      const c = choices[w.id]; const title = waiverTitle(w, lang); const body = waiverBody(w, lang); const ready = canAccept(w, c);
      return <fieldset key={w.id} className="waiver-block">
        <legend className="field-label"><FileText aria-hidden="true" />{title}</legend>
        <p className="waiver-meta"><span className="chip quiet-chip">{t(`eventWaivers.kind.${w.kind}`)}</span>
          <span className="chip quiet-chip">{t(w.required ? 'eventWaivers.required' : 'eventWaivers.optional')}</span>
          <span>{t('waiver.version', { n: w.version })}</span></p>
        {body && <div className="waiver-text" tabIndex={0} role="document" aria-label={title}>{body.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}</div>}
        {w.has_file && <Button type="button" variant="secondary" aria-busy={busy === w.id} disabled={busy === w.id}
          onClick={async () => { setBusy(w.id); const ok = await open(w.id); setBusy(null); if (ok) set(w.id, { opened: true }); else toast.error(t('eventWaivers.errors.file')); }}>
          <ExternalLink />{t('eventWaivers.openFile', { name: w.file_name || t('eventWaivers.document') })}</Button>}
        {w.has_file && !c?.opened && <p className="field-hint" id={`ew-${w.id}-hint`}>{t('eventWaivers.openFirst')}</p>}
        <label className="guest-consent">
          <Checkbox checked={!!c?.accepted} disabled={!ready} aria-describedby={w.has_file && !c?.opened ? `ew-${w.id}-hint` : undefined}
            onCheckedChange={v => set(w.id, { accepted: !!v })} />
          <span>{t(w.required ? 'eventWaivers.agreeRequired' : 'eventWaivers.agreeOptional', { title })}</span>
        </label>
      </fieldset>;
    })}
  </div>;
}

type Accepted = { waiver_id: string; version: number; kind: WaiverKind; title_en: string; title_es: string; body_en: string; body_es: string; has_file: boolean; file_name: string | null; required: boolean; accepted_at: string };

/** Exactly what this attendee accepted (by their private RSVP code). */
export function MyWaiverAcceptances({ code }: { code: string }) {
  const { t, i18n } = useTranslation(); const lang = i18n.resolvedLanguage ?? 'en';
  const open = useOpenWaiverFile();
  const { data } = useQuery({ queryKey: ['my-event-waivers', code], enabled: !!code, queryFn: async () => {
    const { data: d, error } = await db.rpc('my_event_waiver_acceptances', { _code: code }); if (error) throw error; return (d ?? []) as Accepted[];
  } });
  if (!data?.length) return null;
  const fmt = new Intl.DateTimeFormat(lang === 'es' ? 'es-419' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' });
  return <section className="guest-card my-waivers" aria-labelledby={`mw-${code}`}>
    <h3 id={`mw-${code}`} className="guest-subhead"><ShieldCheck aria-hidden="true" /> {t('eventWaivers.youAccepted')}</h3>
    <ul className="plain-list">{data.map(a => <li key={`${a.waiver_id}-${a.version}`}>
      <details><summary><strong>{waiverTitle(a, lang)}</strong> · {t('waiver.version', { n: a.version })} · {fmt.format(new Date(a.accepted_at))}</summary>
        {waiverBody(a, lang) && <div className="waiver-text">{waiverBody(a, lang).split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}</div>}
        {a.has_file && <Button type="button" variant="ghost" onClick={async () => { if (!(await open(a.waiver_id, { code, version: a.version }))) toast.error(t('eventWaivers.errors.file')); }}>
          <ExternalLink />{t('eventWaivers.openFile', { name: a.file_name || t('eventWaivers.document') })}</Button>}
      </details></li>)}</ul>
  </section>;
}

type Row = { id: string; event_id: string; kind: WaiverKind; title_en: string; title_es: string; body_en: string; body_es: string; file_path: string | null; file_name: string | null; required: boolean; position: number; version: number; archived_at: string | null };
const blank = (eventId: string, position: number): Row => ({ id: '', event_id: eventId, kind: 'waiver', title_en: '', title_es: '', body_en: '', body_es: '', file_path: null, file_name: null, required: true, position, version: 0, archived_at: null });

/** Host: add, edit (new version), preview and archive this event's waivers. */
export function EventWaiversManager({ eventId, userId }: { eventId: string; userId: string }) {
  const { t, i18n } = useTranslation(); const lang = i18n.resolvedLanguage ?? 'en'; const qc = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['event-waivers-manage', eventId], queryFn: async () => {
    const { data: rows, error: e } = await db.from('event_waivers').select('*').eq('event_id', eventId).is('archived_at', null).order('position').order('created_at');
    if (e) throw e; return (rows ?? []) as Row[];
  } });
  const [edit, setEdit] = useState<Row | null>(null);
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['event-waivers-manage', eventId] }); void qc.invalidateQueries({ queryKey: ['event-waivers', eventId] }); void qc.invalidateQueries({ queryKey: ['event-waiver-status', eventId] }); };
  const archive = async (w: Row) => {
    if (!(await confirmAction({ title: t('eventWaivers.archiveTitle'), description: t('eventWaivers.archiveText'), confirmLabel: t('eventWaivers.archive'), destructive: true } as never))) return;
    const { error: e } = await db.from('event_waivers').update({ archived_at: new Date().toISOString() }).eq('id', w.id);
    if (e) toast.error(t('profile.saveError')); else { toast.success(t('eventWaivers.archived')); refresh(); }
  };
  return <section className="panel event-waivers-manage" aria-labelledby="ew-manage-title">
    <div className="section-heading"><div><h2 id="ew-manage-title">{t('eventWaivers.manageTitle')}</h2><p className="auth-subtitle">{t('eventWaivers.manageHelp')}</p></div></div>
    {isLoading ? <p className="auth-subtitle" aria-busy="true">{t('publicEvent.loading')}</p>
      : error ? <p className="field-error" role="alert">{t('eventWaivers.errors.load')} <Button variant="ghost" onClick={() => void refetch()}>{t('launch.retry')}</Button></p>
      : !data?.length ? <p className="auth-subtitle">{t('eventWaivers.empty')}</p>
      : <ul className="plain-list ew-list">{data.map(w => <li key={w.id} className="ew-item">
        <div><strong>{waiverTitle(w, lang)}</strong>
          <p className="waiver-meta"><span className="chip quiet-chip">{t(`eventWaivers.kind.${w.kind}`)}</span><span className="chip quiet-chip">{t(w.required ? 'eventWaivers.required' : 'eventWaivers.optional')}</span><span>{t('waiver.version', { n: w.version })}</span>{w.file_name && <span>{w.file_name}</span>}</p></div>
        <div className="row-actions">
          <Button variant="secondary" onClick={() => setEdit(w)} aria-label={t('eventWaivers.editNamed', { title: waiverTitle(w, lang) })}><Pencil />{t('eventWaivers.edit')}</Button>
          <Button variant="ghost" className="danger-text" onClick={() => void archive(w)} aria-label={t('eventWaivers.archiveNamed', { title: waiverTitle(w, lang) })}><Trash2 /></Button>
        </div></li>)}</ul>}
    <Button variant="secondary" onClick={() => setEdit(blank(eventId, data?.length ?? 0))}><Plus />{t('eventWaivers.add')}</Button>
    {edit && <WaiverEditor row={edit} userId={userId} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); refresh(); }} />}
  </section>;
}

function WaiverEditor({ row, userId, onClose, onSaved }: { row: Row; userId: string; onClose: () => void; onSaved: () => void }) {
  const { t, i18n } = useTranslation(); const lang = i18n.resolvedLanguage ?? 'en';
  const [f, setF] = useState<Row>(row); const [busy, setBusy] = useState(false); const [uploading, setUploading] = useState(false); const [preview, setPreview] = useState(false);
  useEffect(() => setF(row), [row]);
  const content = (f.title_en.trim() || f.title_es.trim()) && (f.body_en.trim() || f.body_es.trim() || f.file_path);
  const upload = async (file: File) => {
    if (file.type !== 'application/pdf' || file.size > 10 * 1024 * 1024) { toast.error(t('eventWaivers.errors.fileType')); return; }
    setUploading(true);
    // A fresh name per upload: older accepted versions keep pointing at their own file.
    const path = `${userId}/waivers/${row.event_id}/${crypto.randomUUID()}.pdf`;
    const { error } = await supabase.storage.from('media').upload(path, file, { contentType: 'application/pdf', upsert: false });
    setUploading(false);
    if (error) { toast.error(t('eventWaivers.errors.upload')); return; }
    setF(x => ({ ...x, file_path: path, file_name: file.name.slice(0, 120) }));
  };
  const openOwn = async () => {
    if (!f.file_path) return;
    const { data } = await supabase.storage.from('media').createSignedUrl(f.file_path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener'); else toast.error(t('eventWaivers.errors.file'));
  };
  const save = async () => {
    if (!content || busy) return; setBusy(true);
    const body = { kind: f.kind, title_en: f.title_en, title_es: f.title_es, body_en: f.body_en, body_es: f.body_es, file_path: f.file_path, file_name: f.file_name, required: f.required, position: f.position };
    const { error } = f.id ? await db.from('event_waivers').update(body).eq('id', f.id) : await db.from('event_waivers').insert({ ...body, event_id: f.event_id });
    setBusy(false);
    if (error) { toast.error(t('eventWaivers.errors.save')); return; }
    toast.success(t('eventWaivers.saved')); onSaved();
  };
  return <ResponsiveSheet open onOpenChange={o => !o && onClose()} title={t(f.id ? 'eventWaivers.editTitle' : 'eventWaivers.addTitle')} description={t('eventWaivers.editHelp')}
    footer={<Button className="onboarding-continue" disabled={!content || busy || uploading} aria-busy={busy} onClick={() => void save()}>{busy ? t('onboarding.saving') : t('eventWaivers.save')}</Button>}>
    <div className="edit-form">
      {f.id && <p className="field-hint">{t('eventWaivers.versionNote', { n: f.version })}</p>}
      <label className="field-label" htmlFor="ew-kind">{t('eventWaivers.kindLabel')}</label>
      <select id="ew-kind" className="field-input" value={f.kind} onChange={e => setF({ ...f, kind: e.target.value as WaiverKind })}>
        {WAIVER_KINDS.map(k => <option key={k} value={k}>{t(`eventWaivers.kind.${k}`)}</option>)}
      </select>
      <LangPair id="ew-title" label={t('eventWaivers.titleLabel')} en={f.title_en} es={f.title_es} onEn={v => setF({ ...f, title_en: v })} onEs={v => setF({ ...f, title_es: v })} maxLength={120} />
      <LangPair id="ew-body" label={t('eventWaivers.bodyLabel')} en={f.body_en} es={f.body_es} onEn={v => setF({ ...f, body_en: v })} onEs={v => setF({ ...f, body_es: v })} multiline rows={8} maxLength={12000} />
      <div className="form-field">
        <span className="field-label">{t('eventWaivers.fileLabel')}</span>
        {f.file_path ? <div className="row-actions"><span>{f.file_name}</span>
          <Button type="button" variant="ghost" onClick={() => void openOwn()}><ExternalLink />{t('eventWaivers.preview')}</Button>
          <Button type="button" variant="ghost" className="danger-text" onClick={() => setF({ ...f, file_path: null, file_name: null })}>{t('eventWaivers.removeFile')}</Button></div>
          : <label className="button-like secondary"><Upload aria-hidden="true" />{uploading ? t('onboarding.saving') : t('eventWaivers.uploadPdf')}
            <input type="file" accept="application/pdf" className="sr-only" onChange={e => { const file = e.target.files?.[0]; if (file) void upload(file); e.target.value = ''; }} /></label>}
        <small className="field-hint">{t('eventWaivers.fileHint')}</small>
      </div>
      <label className="settings-row is-static"><span className="settings-label">{t('eventWaivers.requiredLabel')}<small className="field-hint">{t('eventWaivers.requiredHint')}</small></span>
        <Switch checked={f.required} onCheckedChange={v => setF({ ...f, required: v })} aria-label={t('eventWaivers.requiredLabel')} /></label>
      <Button type="button" variant="secondary" onClick={() => setPreview(p => !p)} aria-expanded={preview}><FileText />{t('eventWaivers.previewAttendee')}</Button>
      {preview && <div className="waiver-preview" aria-label={t('eventWaivers.previewAttendee')}>
        <EventWaiversAccept waivers={[{ id: 'preview', kind: f.kind, title_en: f.title_en, title_es: f.title_es, body_en: f.body_en, body_es: f.body_es, has_file: false, file_name: f.file_name, required: f.required, version: f.id ? f.version : 1 }]} choices={{}} onChange={() => undefined} />
        {waiverTitle(f, lang) === '' && <p className="field-hint">{t('eventWaivers.previewEmpty')}</p>}
      </div>}
    </div>
  </ResponsiveSheet>;
}

/** Host: attendee-level consent status with an export (names + consent only, no contact details). */
export function EventWaiverStatusPanel({ eventId }: { eventId: string }) {
  const { t, i18n } = useTranslation(); const lang = i18n.resolvedLanguage ?? 'en';
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['event-waiver-status', eventId], queryFn: async () => {
    const { data: d, error: e } = await db.rpc('event_waiver_status', { _event: eventId }); if (e) throw e; return d as WaiverStatus;
  } });
  if (isLoading) return null;
  if (error) return <p className="field-error" role="alert">{t('eventWaivers.errors.load')} <Button variant="ghost" onClick={() => void refetch()}>{t('launch.retry')}</Button></p>;
  if (!data?.waivers.length) return null;
  const label = (k: ReturnType<typeof consentState>) => t(`eventWaivers.state.${k}`);
  const missing = data.attendees.filter(a => data.waivers.some(w => consentState(w, a) === 'missing' || (w.required && consentState(w, a) === 'outdated'))).length;
  return <section className="panel ew-status" aria-labelledby="ew-status-title">
    <div className="section-heading"><div><h2 id="ew-status-title"><ShieldCheck aria-hidden="true" /> {t('eventWaivers.statusTitle')}</h2>
      <p className="auth-subtitle">{t('eventWaivers.statusSummary', { count: data.attendees.length, missing })}</p></div>
      <Button variant="secondary" disabled={!data.attendees.length} onClick={() => downloadCsv(`waivers-${eventId.slice(0, 8)}.csv`, consentRows(data, lang, label))}><Download />{t('eventWaivers.export')}</Button></div>
    {!data.attendees.length ? <p className="auth-subtitle">{t('eventWaivers.noAttendees')}</p>
      : <div className="table-scroll"><table className="data-table"><caption className="sr-only">{t('eventWaivers.statusTitle')}</caption>
        <thead><tr><th scope="col">{t('eventWaivers.attendee')}</th>{data.waivers.map(w => <th key={w.id} scope="col">{waiverTitle(w, lang)}</th>)}</tr></thead>
        <tbody>{data.attendees.map(a => <tr key={a.rsvp_id}><th scope="row">{a.name || t('eventWaivers.unnamed')}</th>
          {data.waivers.map(w => { const st = consentState(w, a); return <td key={w.id} data-state={st}>{label(st)}{a.accepted[w.id] ? ` · v${a.accepted[w.id]!.version}` : ''}</td>; })}</tr>)}</tbody>
      </table></div>}
  </section>;
}
