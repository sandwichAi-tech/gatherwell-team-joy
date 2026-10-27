import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { HostWaiverEditor, HostWaiverPreview, emptyWaiver, useWaiverLibrary, type LibraryWaiver } from '@/components/waiver-library';
import { usePlatformAgreement } from '@/components/platform-event-agreement';
import { hostWaiverStatus, initialHostPick, pickOne, platformStatus, type AgreementStatus, type WaiverPick } from '@/lib/builder-agreements';
import { platformSelection, type PlatformAgreement } from '@/lib/event-agreements';
import { FileText, Check } from '@/components/icons';

type Current = PlatformAgreement & { en_effective?: string | null; es_effective?: string | null };
export function useBuilderAgreements(userId: string, eventId: string | undefined, locked: boolean) {
  const current = useQuery({ queryKey: ['current-platform-agreement', userId], enabled: !!userId && !locked, queryFn: async () => {
    const r = await supabase.rpc('current_platform_agreement'); if (r.error) throw r.error; return r.data as unknown as Current;
  } });
  const pinned = usePlatformAgreement(locked ? eventId : undefined);
  const q = locked ? pinned : current;
  const library = useWaiverLibrary(userId);
  return { platform: q.data as Current | null | undefined, platformState: platformStatus(q.data, q.isPending, !!q.error), retryPlatform: () => void q.refetch(), library };
}

const fmt = (d: string | null | undefined, lang: string) => d ? new Date(d).toLocaleDateString(lang, { year: 'numeric', month: 'short', day: 'numeric' }) : '';

export function EventAgreementsSection({ teamId, userId, eventId, locked, isNew, value, onChange, platform, platformState, retryPlatform, library }: {
  teamId: string; userId: string; eventId?: string | undefined; locked: boolean; isNew: boolean; value: WaiverPick[]; onChange: (v: WaiverPick[]) => void;
  platform: Current | null | undefined; platformState: AgreementStatus; retryPlatform: () => void; library: ReturnType<typeof useWaiverLibrary>;
}) {
  const { t, i18n } = useTranslation(); const lang = i18n.resolvedLanguage === 'es' ? 'es' : 'en'; const qc = useQueryClient();
  const own = library.data; const active = own?.filter(w => !w.archived) ?? [];
  const [editor, setEditor] = useState<LibraryWaiver | null>(null); const [preview, setPreview] = useState<WaiverPick | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const seeded = useRef(false);
  useEffect(() => { if (seeded.current || !own) return; seeded.current = true; if (isNew && !value.length) { const p = initialHostPick(own, true); if (p.length) onChange(p); } }, [own, isNew]); // eslint-disable-line react-hooks/exhaustive-deps
  const pinnedRows = useQuery({ queryKey: ['event-host-waivers', eventId, userId], enabled: !!eventId && locked, queryFn: async () => {
    const r = await supabase.from('event_waivers').select('id,title_en,title_es,library_version,version,file_name,body_en,body_es,created_at').eq('event_id', eventId ?? '').is('archived_at', null).not('library_id', 'is', null); if (r.error) throw r.error; return r.data;
  } });
  const versions = useQuery({ queryKey: ['waiver-versions', userId, value.map(v => `${v.id}:${v.version}`).join(',')], enabled: !locked && value.length > 0, queryFn: async () => {
    const r = await supabase.from('waiver_library_versions').select('waiver_id,version,name,body_en,body_es,file_path,file_name,created_at').in('waiver_id', value.map(v => v.id)); if (r.error) throw r.error; return r.data;
  } });
  const hostState = hostWaiverStatus(value, own, locked);
  const sel = platformSelection(platform, lang);
  const selectedId = value.length === 1 ? value[0]?.id ?? '' : value.length ? 'multiple' : '';
  const toggleDefault = async (w: LibraryWaiver) => { setBusy(true); setError(''); const r = await supabase.rpc('set_host_waiver_default', { _id: w.id, _on: !w.is_default }); if (r.error) setError(t('waiverLibrary.saveError')); await qc.invalidateQueries({ queryKey: ['waiver-library'] }); setBusy(false); };
  const previewRow = preview && versions.data?.find(v => v.waiver_id === preview.id && v.version === preview.version);

  return <section id="g-agreements" className="form-section agreements-builder" aria-labelledby="g-agreements-title" tabIndex={-1}>
    <h2 id="g-agreements-title" className="field-label">{t('builderAgreements.title')}</h2>
    <p className="field-hint">{t('builderAgreements.intro')}</p>

    <div className="agreement-item" role="group" aria-labelledby="g-platform-title">
      <div className="agreement-item-head"><strong id="g-platform-title">{t('eventAgreements.title')}</strong><span className="chip">{t('builderAgreements.alwaysRequired')}</span></div>
      {platformState === 'loading' ? <p role="status">{t('publicEvent.loading')}</p>
        : platformState === 'error' ? <div role="alert"><p>{t('builderAgreements.platformLoadError')}</p><Button type="button" variant="secondary" onClick={retryPlatform}>{t('common.retry')}</Button></div>
        : platformState === 'missing' || !sel ? <p role="alert" className="field-error">{t('eventAgreements.legalRequired')}</p>
        : <><p>{t('waiver.version', { n: sel.version })}{(lang === 'es' ? platform?.es_effective : platform?.en_effective) ? ` · ${t('builderAgreements.effective', { date: fmt(lang === 'es' ? platform?.es_effective : platform?.en_effective, lang) })}` : ''}</p>
          <Button asChild variant="secondary"><a href={sel.url ?? ''} target="_blank" rel="noopener noreferrer"><FileText />{t('builderAgreements.previewPlatform')}</a></Button></>}
      <p className="field-hint">{t(locked ? 'eventAgreements.pinned' : 'builderAgreements.platformLocked')}</p>
    </div>

    <div className="agreement-item" role="group" aria-labelledby="g-host-title">
      <div className="agreement-item-head"><strong id="g-host-title">{t('builderAgreements.hostTitle')}</strong><span className="chip">{t('builderAgreements.optional')}</span></div>
      {locked ? (pinnedRows.isPending ? <p role="status">{t('publicEvent.loading')}</p> : !pinnedRows.data?.length ? <p>{t('builderAgreements.noneSelected')}</p>
        : <ul className="plain-list">{pinnedRows.data.map(w => <li key={w.id}><strong>{lang === 'es' ? w.title_es || w.title_en : w.title_en}</strong><p>{t('waiver.version', { n: w.library_version ?? w.version })} · {t('builderAgreements.pinnedOn', { date: fmt(w.created_at, lang) })}</p></li>)}</ul>)
      : library.isPending ? <p role="status">{t('publicEvent.loading')}</p>
      : library.error ? <div role="alert"><p>{t('eventWaivers.errors.load')}</p><Button type="button" variant="secondary" onClick={() => void library.refetch()}>{t('common.retry')}</Button></div>
      : <>
        <label className="field-label" htmlFor="g-host-waiver">{t('builderAgreements.choose')}</label>
        <select id="g-host-waiver" className="field-input w-full" value={selectedId} aria-invalid={hostState === 'unavailable'} onChange={e => { setError(''); onChange(pickOne(own, e.target.value || null)); }}>
          <option value="">{t('builderAgreements.none')}</option>
          {selectedId === 'multiple' && <option value="multiple" disabled>{t('builderAgreements.multiple', { count: value.length })}</option>}
          {active.map(w => <option key={w.id} value={w.id}>{w.name} · {t('waiver.version', { n: w.version })}{w.is_default ? ` · ${t('waiverLibrary.default')}` : ''}</option>)}
        </select>
        {!active.length && <p className="field-hint">{t('builderAgreements.emptyLibrary')}</p>}
        {value.map(v => { const w = own?.find(x => x.id === v.id); const ver = versions.data?.find(x => x.waiver_id === v.id && x.version === v.version);
          if (!w || w.archived) return <p key={v.id} role="alert" className="field-error">{t('builderAgreements.unavailable')}</p>;
          return <div key={v.id} className="agreement-selected">
            <strong>{ver?.name ?? w.name}</strong>
            <dl className="agreement-facts">
              <div><dt>{t('builderAgreements.versionLabel')}</dt><dd>{t('waiver.version', { n: v.version })}{ver ? ` · ${t('builderAgreements.effective', { date: fmt(ver.created_at, lang) })}` : ''}</dd></div>
              <div><dt>{t('builderAgreements.source')}</dt><dd>{ver?.file_name ? t('builderAgreements.sourcePdf', { name: ver.file_name }) : t('builderAgreements.sourceText')}</dd></div>
              <div><dt>{t('builderAgreements.languages')}</dt><dd>{[ver?.body_en?.trim() ? t('me.english') : '', ver?.body_es?.trim() ? t('me.spanish') : ''].filter(Boolean).join(' · ') || t('builderAgreements.pdfOnly')}</dd></div>
            </dl>
            {ver && !ver.body_es?.trim() && <p className="field-hint">{t('builderAgreements.noSpanish')}</p>}
            {w.version > v.version && <div role="status" className="field-hint"><p>{t('builderAgreements.newer', { n: w.version })}</p><Button type="button" variant="secondary" onClick={() => onChange(value.map(x => x.id === v.id ? { id: w.id, version: w.version } : x))}>{t('builderAgreements.useLatest', { n: w.version })}</Button></div>}
            <div className="chip-row">
              <Button type="button" variant="secondary" disabled={!ver} onClick={() => setPreview(v)}>{t('eventWaivers.preview')}</Button>
              <Button type="button" variant="secondary" onClick={() => setEditor(w)}>{t('builderAgreements.replace')}</Button>
              <Button type="button" variant="ghost" disabled={busy} aria-pressed={w.is_default} onClick={() => void toggleDefault(w)}>{w.is_default ? <><Check />{t('waiverLibrary.clearDefault')}</> : t('waiverLibrary.makeDefault')}</Button>
              {value.length > 1 && <Button type="button" variant="ghost" onClick={() => onChange(value.filter(x => x.id !== v.id))}>{t('builderAgreements.remove')}</Button>}
            </div>
          </div>; })}
        <Button type="button" variant="secondary" onClick={() => { setError(''); setEditor(emptyWaiver()); }}>{t('builderAgreements.create')}</Button>
        <p className="field-hint">{t('waiverLibrary.scope')}</p>
      </>}
      {error && <p role="alert" className="field-error">{error}</p>}
    </div>
    <p className="field-hint">{t(value.length ? 'builderAgreements.bothAccepted' : 'builderAgreements.platformOnly')}</p>
    <p className="field-hint">{t('builderAgreements.noLegalAdvice')}</p>

    {editor && <HostWaiverEditor teamId={teamId} initial={editor} onClose={() => setEditor(null)} onSaved={async id => {
      const r = await supabase.from('waiver_library').select('id,version,archived').eq('id', id).maybeSingle();
      if (r.data && !r.data.archived) onChange([{ id: r.data.id, version: r.data.version }]); else if (r.data?.archived) onChange(value.filter(x => x.id !== id));
    }} />}
    {preview && previewRow && <HostWaiverPreview waiver={{ id: preview.id, name: previewRow.name, version: previewRow.version, body_en: previewRow.body_en, body_es: previewRow.body_es, file_path: previewRow.file_path, file_name: previewRow.file_name }} onClose={() => setPreview(null)} />}
  </section>;
}

export function RequiredAgreementsSummary({ platformState, hostState, hostName, onFix }: { platformState: AgreementStatus; hostState: AgreementStatus; hostName: string | null; onFix: () => void }) {
  const { t } = useTranslation();
  const row = (label: string, state: AgreementStatus, ok: boolean) => <li className={`agreement-summary-row ${ok ? 'is-ready' : 'is-blocked'}`}>
    <span><strong>{label}</strong><small>{t(`builderAgreements.status.${state}`)}</small></span>
    {!ok && <Button type="button" variant="secondary" size="sm" onClick={onFix} aria-label={t('builderAgreements.fixLabel', { item: label })}>{t('builderAgreements.fix')}</Button>}
  </li>;
  return <section className="form-section agreements-summary" aria-labelledby="g-agreements-summary">
    <h2 id="g-agreements-summary" className="field-label">{t('builderAgreements.summaryTitle')}</h2>
    <ul className="plain-list">
      {row(t('eventAgreements.title'), platformState, platformState === 'ready')}
      {row(hostName ? t('builderAgreements.hostNamed', { name: hostName }) : t('builderAgreements.hostTitle'), hostState, hostState === 'ready' || hostState === 'none' || hostState === 'stale')}
    </ul>
    <p className="field-hint">{t('builderAgreements.noLegalAdvice')}</p>
  </section>;
}
