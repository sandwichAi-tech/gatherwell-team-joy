import { CropFileInput } from '@/components/image-crop';
import { EmptyState } from '@/components/launch-states';
import { LangFields, LangPair } from '@/components/lang-fields';
import { confirmAction } from '@/components/confirm-dialog';
import { MembersOnlyPicker } from '@/components/offers';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ArrowDown, ArrowLeft, ArrowUp, Eye, GripVertical, Pencil, Plus, Trash2, Upload } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { ResponsiveSheet } from '@/components/responsive-sheet';
import { supabase } from '@/integrations/supabase/client';
import { COVER_STYLES } from '@/lib/gatherings';
import { compressImage, lessonTitle, lessonsOf, listOf, RECIPE_TAGS, recipesQuery, trackTitle, uploadLearnFile, type Lesson, type LessonType, type Recipe, type Track } from '@/lib/learn';
import { fileMatchesLessonType, isTrackFlow, lessonEditorConfig, lessonPresetFor, parseCreateType, type TrackFlowType } from '@/lib/create-resource';
import { LearnCover, useLearn } from '@/components/learn';
import { isLowResolution } from '@/lib/media-renditions';
import { hasPlaceholder, isLive, trackState } from '@/lib/resource-flow';

type Tab = 'tracks' | 'recipes' | 'progress';

function errMsg(t: (k: string) => string, e: unknown) {
  const m = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : '';
  if (m.includes('too_large')) return t('learnHub.tooLarge');
  if (m.includes('blueprint_placeholder')) return t('resources.item.placeholderBlock');
  if (m.includes('not_allowed') || m.includes('row-level')) return t('teamSpace.notAllowed');
  return t('profile.saveError');
}

export function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return <div className="form-field"><label className="field-label" htmlFor={id}>{label}</label>{children}</div>;
}

/** `upload`/`renderCover` let offer-backed items store the cover in the host's own media folder (required for offers) instead of team learn media. */
export function CoverPicker({ teamId, path, styleIdx, title, onPath, onStyle, upload, renderCover }: { teamId: string; path: string | null; styleIdx: number; title: string; onPath: (p: string | null) => void; onStyle: (n: number) => void; upload?: (file: File) => Promise<string>; renderCover?: (onNaturalWidth: (w: number) => void) => React.ReactNode }) {
  const { t } = useTranslation(); const [busy, setBusy] = useState(false); const [width, setWidth] = useState<number | null>(null);
  return <div className="form-field"><span className="field-label">{t('onboarding.cover')}</span>
    {renderCover ? renderCover(setWidth) : <LearnCover key={path ?? 'none'} path={path} style={styleIdx} title={title || 'L'} className="is-wide" onNaturalWidth={setWidth} />}
    {path && width != null && isLowResolution(width) && <p className="field-hint crop-lowres" role="status">{t('gathering.coverLowRes', { width })}</p>}
    <div className="cover-styles" role="group" aria-label={t('onboarding.cover')}>{COVER_STYLES.map((bg, i) => <button key={i} type="button" className={`cover-swatch ${!path && styleIdx === i ? 'is-selected' : ''}`} style={{ backgroundImage: bg }} aria-label={`${t('onboarding.cover')} ${i + 1}`} aria-pressed={!path && styleIdx === i} onClick={() => { onPath(null); onStyle(i); }} />)}</div>
    <label className="file-button"><Upload />{busy ? t('onboarding.saving') : t('onboarding.uploadCover')}<CropFileInput kind="cover" className="hidden" onCropped={async r => { setBusy(true); try { onPath(await (upload ? upload(r.file) : uploadLearnFile(teamId, r.file, () => {}))); } catch (err) { toast.error(errMsg(t, err)); } setBusy(false); }} /></label></div>;
}

function TrackEditor({ track, teamId, onClose, preset }: { track: Partial<Track> | null; teamId: string; onClose: (created?: Track) => void; preset?: TrackFlowType | null }) {
  const { t } = useTranslation(); const qc = useQueryClient(); const { userId } = useLearn();
  const [f, setF] = useState({ title_en: '', title_es: '', description_en: '', description_es: '', cover_url: null as string | null, cover_style: 0, is_start_here: false, is_published: false });
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (track) setF({ title_en: track.title_en ?? '', title_es: track.title_es ?? '', description_en: track.description_en ?? '', description_es: track.description_es ?? '', cover_url: track.cover_url ?? null, cover_style: track.cover_style ?? 0, is_start_here: !!track.is_start_here, is_published: !!track.is_published }); }, [track]);
  const trackPlaceholder = f.is_published && hasPlaceholder(f.title_en, f.title_es, f.description_en, f.description_es);
  const ok = !!(f.title_en.trim() || f.title_es.trim()) && !trackPlaceholder;
  const save = async () => {
    setBusy(true);
    const row = { ...f, title_en: f.title_en.trim(), title_es: f.title_es.trim(), description_en: f.description_en.trim() || null, description_es: f.description_es.trim() || null };
    const res = track?.id ? await supabase.from('tracks').update(row).eq('id', track.id) : await supabase.from('tracks').insert({ ...row, team_id: teamId, sort_order: Date.now() % 1_000_000 }).select().single();
    setBusy(false);
    if (res.error) { toast.error(errMsg(t, res.error)); return; }
    toast.success(t('templates.saved')); await qc.invalidateQueries({ queryKey: ['learn', userId] }); onClose(track?.id ? undefined : (res.data as Track));
  };
  const remove = async () => {
    if (!track?.id || !(await confirmAction({ title: t('learnHub.confirmDeleteTrack'), destructive: true }))) return;
    const res = await supabase.from('tracks').delete().eq('id', track.id);
    if (res.error) { toast.error(errMsg(t, res.error)); return; }
    await qc.invalidateQueries({ queryKey: ['learn', userId] }); onClose();
  };
  return <ResponsiveSheet open={!!track} onOpenChange={o => !o && onClose()} title={preset && !track?.id ? t(`resources.preset.track.${preset}`) : track?.id ? t('learnHub.editTrack') : t('learnHub.newTrack')} description={preset && !track?.id ? t(`resources.preset.trackText.${preset}`) : undefined}>
    <div className="edit-form">
      <LangFields idPrefix="tr" titleEn={f.title_en} titleEs={f.title_es} descEn={f.description_en} descEs={f.description_es}
        onChange={p => setF(x => ({ ...x, title_en: p.titleEn ?? x.title_en, title_es: p.titleEs ?? x.title_es, description_en: p.descEn ?? x.description_en, description_es: p.descEs ?? x.description_es }))}
        titleLabel={t('templates.title')} descLabel={t('templates.description')} />
      <CoverPicker teamId={teamId} path={f.cover_url} styleIdx={f.cover_style} title={f.title_en || f.title_es} onPath={p => setF(x => ({ ...x, cover_url: p }))} onStyle={n => setF(x => ({ ...x, cover_style: n }))} />
      <label className="switch-row"><Switch checked={f.is_start_here} onCheckedChange={v => setF({ ...f, is_start_here: v })} /><span><strong>{t('learnHub.markStartHere')}</strong><small>{t('learnHub.markStartHereText')}</small></span></label>
      <label className="switch-row"><Switch checked={f.is_published} onCheckedChange={v => setF({ ...f, is_published: v })} /><span><strong>{t('learnHub.publishTrack')}</strong><small>{t('learnHub.publishTrackText')}</small></span></label>
      {trackPlaceholder && <p className="field-hint" role="alert">{t('resources.item.placeholderBlock')}</p>}
      {track?.id && <MembersOnlyPicker table="tracks" id={track.id} teamId={teamId} />}
      <Button className="onboarding-continue" disabled={busy || !ok} onClick={save}>{busy ? t('onboarding.saving') : t('profile.save')}</Button>
      {track?.id && <Button variant="ghost" className="danger-link" onClick={remove}><Trash2 />{t('learnHub.deleteTrack')}</Button>}
    </div>
  </ResponsiveSheet>;
}

const toLocalInput = (iso?: string | null) => { if (!iso) return ''; const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16); };

function LessonEditor({ lesson, teamId, onClose, preset }: { lesson: (Partial<Lesson> & { track_id: string }) | null; teamId: string; onClose: () => void; preset?: LessonType | null }) {
  const { t } = useTranslation(); const qc = useQueryClient(); const { userId } = useLearn();
  const empty = { title_en: '', title_es: '', type: (preset ?? 'video') as LessonType, url: '', storage_path: null as string | null, duration: '', live: '', meeting: '', replay: '', notes_en: '', notes_es: '', published: true };
  const [f, setF] = useState(empty); const [busy, setBusy] = useState(false); const [progress, setProgress] = useState<number | null>(null); const [fileName, setFileName] = useState('');
  useEffect(() => {
    if (!lesson) return;
    setF({ title_en: lesson.title_en ?? '', title_es: lesson.title_es ?? '', type: (lesson.type as LessonType) ?? preset ?? 'video', url: lesson.url ?? '', storage_path: lesson.storage_path ?? null, duration: lesson.duration_minutes ? String(lesson.duration_minutes) : '', live: toLocalInput(lesson.live_starts_at), meeting: '', replay: lesson.replay_url ?? '', notes_en: lesson.notes_en ?? '', notes_es: lesson.notes_es ?? '', published: lesson.is_published ?? true });
    setProgress(null); setFileName('');
    if (lesson.id && lesson.type === 'live') void supabase.from('lesson_live_links').select('url').eq('lesson_id', lesson.id).maybeSingle().then(({ data }) => data && setF(x => ({ ...x, meeting: data.url })));
  }, [lesson]);
  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const upload = async (file: File) => {
    if (!fileMatchesLessonType(f.type, file)) { toast.error(t('learnHub.wrongFileType')); return; }
    setFileName(file.name); setProgress(0);
    try { const p = await uploadLearnFile(teamId, file, setProgress); setF(x => ({ ...x, storage_path: p, url: '' })); setProgress(100); }
    catch (e) { toast.error(errMsg(t, e)); setProgress(null); setFileName(''); }
  };
  const validUrl = (u: string) => !u || /^https?:\/\/\S+$/i.test(u);
  const lessonPlaceholder = f.published && hasPlaceholder(f.title_en, f.title_es, f.notes_en, f.notes_es);
  const ok = !!(f.title_en.trim() || f.title_es.trim()) && (f.type !== 'live' || !!f.live) && validUrl(f.url) && validUrl(f.meeting) && validUrl(f.replay) && (progress === null || progress === 100);
  const save = async () => {
    if (!lesson) return; setBusy(true);
    try {
      const row = { title_en: f.title_en.trim(), title_es: f.title_es.trim(), type: f.type, url: f.type === 'live' ? null : f.url.trim() || null, storage_path: lessonEditorConfig(f.type).keepsFile ? f.storage_path : null,
        duration_minutes: parseInt(f.duration, 10) > 0 ? Math.min(600, parseInt(f.duration, 10)) : null, live_starts_at: f.type === 'live' && f.live ? new Date(f.live).toISOString() : null,
        replay_url: f.type === 'live' ? f.replay.trim() || null : null, notes_en: f.notes_en.trim() || null, notes_es: f.notes_es.trim() || null, is_published: f.published };
      let id = lesson.id;
      if (id) { const r = await supabase.from('lessons').update(row).eq('id', id); if (r.error) throw r.error; }
      else { const r = await supabase.from('lessons').insert({ ...row, track_id: lesson.track_id, sort_order: Date.now() % 1_000_000 }).select('id').single(); if (r.error) throw r.error; id = r.data.id; }
      if (f.type === 'live') {
        const r = f.meeting.trim() ? await supabase.from('lesson_live_links').upsert({ lesson_id: id!, url: f.meeting.trim() }) : await supabase.from('lesson_live_links').delete().eq('lesson_id', id!);
        if (r.error) throw r.error;
      }
      toast.success(t('templates.saved')); await qc.invalidateQueries({ queryKey: ['learn', userId] }); onClose();
    } catch (e) { toast.error(errMsg(t, e)); }
    setBusy(false);
  };
  const remove = async () => {
    if (!lesson?.id || !(await confirmAction({ title: t('learnHub.confirmDeleteLesson'), destructive: true }))) return;
    const r = await supabase.from('lessons').delete().eq('id', lesson.id);
    if (r.error) { toast.error(errMsg(t, r.error)); return; }
    await qc.invalidateQueries({ queryKey: ['learn', userId] }); onClose();
  };
  const cfg = lessonEditorConfig(f.type);
  const uploadLabel = f.type === 'video' ? 'learnHub.uploadVideo' : f.type === 'audio' ? 'learnHub.uploadAudio' : 'learnHub.uploadPdf';
  const uploadHint = f.type === 'video' ? 'learnHub.videoHint' : f.type === 'audio' ? 'learnHub.audioHint' : 'learnHub.pdfHint';
  const urlLabel = f.type === 'video' ? 'learnHub.videoLink' : f.type === 'pdf' ? 'learnHub.pdfLink' : f.type === 'audio' ? 'learnHub.audioLink' : 'learnHub.link';
  return <ResponsiveSheet open={!!lesson} onOpenChange={o => !o && onClose()} title={preset && !lesson?.id ? t(`resources.preset.lesson.${preset}`) : lesson?.id ? t('learnHub.editLesson') : t('learnHub.newLesson')} description={preset && !lesson?.id ? t(`resources.preset.lessonText.${preset}`) : undefined}>
    <div className="edit-form">
      <LangFields idPrefix="ls" titleEn={f.title_en} titleEs={f.title_es} descEn={f.notes_en} descEs={f.notes_es}
        onChange={p => setF(x => ({ ...x, title_en: p.titleEn ?? x.title_en, title_es: p.titleEs ?? x.title_es, notes_en: p.descEn ?? x.notes_en, notes_es: p.descEs ?? x.notes_es }))}
        titleLabel={t('templates.title')} descLabel={t('learnHub.notes')} titleMax={140} descMax={4000} descRows={4} />
      {preset && !lesson?.id ? <p className="chip lesson-preset-chip">{t(`learnHub.type.${f.type}`)}</p> :
        <div className="form-field"><span className="field-label">{t('learnHub.lessonType')}</span>
          <div className="type-choices">{(['video', 'pdf', 'audio', 'link', 'live'] as const).map(ty => <button type="button" key={ty} className={`choice-card ${f.type === ty ? 'is-selected' : ''}`} aria-pressed={f.type === ty} onClick={() => setF({ ...f, type: ty })}><strong>{t(`learnHub.type.${ty}`)}</strong></button>)}</div></div>}
      {cfg.uploadAccept && <div className="form-field"><span className="field-label">{t(uploadLabel)}</span>
        <label className="file-button"><Upload />{t('learnHub.chooseFile')}<input type="file" accept={cfg.uploadAccept} hidden onChange={e => { const x = e.target.files?.[0]; if (x) void upload(x); }} /></label>
        {progress !== null && <div className="upload-progress"><span>{fileName}</span><progress value={progress} max={100} aria-label={t('learnHub.uploading')} /><small>{progress < 100 ? t('learnHub.uploadingPct', { pct: progress }) : t('learnHub.uploaded')}</small></div>}
        {progress === null && f.storage_path && <p className="field-hint">{t('learnHub.fileAttached')} <button type="button" className="text-link" onClick={() => setF({ ...f, storage_path: null })}>{t('learnHub.removeFile')}</button></p>}
        <p className="field-hint">{t(uploadHint)}</p></div>}
      {cfg.showsUrl && !f.storage_path && <Field id="ls-url" label={t(urlLabel)}><Input id="ls-url" type="url" className="field-input" placeholder="https://" value={f.url} onChange={set('url')} /></Field>}
      {f.type === 'live' && <>
        <Field id="ls-live" label={t('learnHub.liveStarts')}><Input id="ls-live" type="datetime-local" className="field-input" value={f.live} onChange={set('live')} /></Field>
        <Field id="ls-meet" label={t('learnHub.meetingLink')}><Input id="ls-meet" type="url" className="field-input" placeholder="https://" value={f.meeting} onChange={set('meeting')} /></Field>
        <p className="field-hint">{t('learnHub.meetingHint')}</p>
        <Field id="ls-replay" label={t('learnHub.replayLink')}><Input id="ls-replay" type="url" className="field-input" placeholder="https://" value={f.replay} onChange={set('replay')} /></Field>
        <p className="field-hint">{t('learnHub.replayHint')}</p></>}
      <Field id="ls-dur" label={t('learnHub.duration')}><Input id="ls-dur" type="number" min={1} max={600} className="field-input" value={f.duration} onChange={set('duration')} /></Field>
      <label className="switch-row"><Switch checked={f.published} onCheckedChange={v => setF({ ...f, published: v })} /><span><strong>{t('resources.item.lessonStatus')}</strong><small>{t(f.published ? 'templates.published' : 'templates.draft')}</small></span></label>
      {lessonPlaceholder && <p className="field-hint" role="alert">{t('resources.item.placeholderBlock')}</p>}
      <Button className="onboarding-continue" disabled={busy || !ok || lessonPlaceholder} onClick={save}>{busy ? t('onboarding.saving') : t('profile.save')}</Button>
      {lesson?.id && <Button variant="ghost" className="danger-link" onClick={remove}><Trash2 />{t('learnHub.deleteLesson')}</Button>}
    </div>
  </ResponsiveSheet>;
}

function LessonOrder({ track, lessons, onEdit }: { track: Track; lessons: Lesson[]; onEdit: (l: Partial<Lesson> & { track_id: string }) => void }) {
  const { t, i18n } = useTranslation(); const qc = useQueryClient(); const { userId } = useLearn();
  const [order, setOrder] = useState(lessons); const [drag, setDrag] = useState<number | null>(null);
  useEffect(() => setOrder(lessons), [lessons]);
  const persist = async (next: Lesson[]) => {
    setOrder(next);
    const results = await Promise.all(next.map((l, i) => supabase.from('lessons').update({ sort_order: i }).eq('id', l.id)));
    if (results.some(r => r.error)) toast.error(t('profile.saveError'));
    await qc.invalidateQueries({ queryKey: ['learn', userId] });
  };
  const move = (from: number, to: number) => { if (to < 0 || to >= order.length || from === to) return; const n = [...order]; const [x] = n.splice(from, 1); n.splice(to, 0, x!); void persist(n); };
  return <div className="lesson-manage">
    <ol className="order-list">{order.map((l, i) => <li key={l.id} draggable onDragStart={() => setDrag(i)} onDragOver={e => e.preventDefault()} onDrop={() => { if (drag !== null) move(drag, i); setDrag(null); }} className={drag === i ? 'is-dragging' : ''}>
      <GripVertical className="grip" aria-hidden="true" /><span className="order-title"><strong>{lessonTitle(l, i18n.resolvedLanguage)}</strong><small>{t(`learnHub.type.${l.type}`)}</small></span>
      <Button variant="ghost" size="icon" disabled={i === 0} aria-label={t('templates.moveUp')} onClick={() => move(i, i - 1)}><ArrowUp /></Button>
      <Button variant="ghost" size="icon" disabled={i === order.length - 1} aria-label={t('templates.moveDown')} onClick={() => move(i, i + 1)}><ArrowDown /></Button>
      <Button variant="ghost" size="icon" aria-label={t('templates.edit')} onClick={() => onEdit(l)}><Pencil /></Button></li>)}</ol>
    <div className="lesson-add"><Button variant="secondary" onClick={() => onEdit({ track_id: track.id, type: 'video' })}><Plus />{t('learnHub.addLesson')}</Button>
      <Button variant="secondary" onClick={() => onEdit({ track_id: track.id, type: 'live' })}><Plus />{t('learnHub.scheduleLive')}</Button></div>
  </div>;
}

function TracksTab({ teamId, newType }: { teamId: string; newType?: string | undefined }) {
  const { t, i18n } = useTranslation(); const { data } = useLearn(); const navigate = useNavigate();
  const [editing, setEditing] = useState<Partial<Track> | null>(null); const [lesson, setLesson] = useState<(Partial<Lesson> & { track_id: string }) | null>(null);
  const parsed = parseCreateType(newType);
  const [flow, setFlow] = useState<TrackFlowType | null>(null);
  const [flowTrack, setFlowTrack] = useState<Track | null>(null); const [flowDone, setFlowDone] = useState(false);
  useEffect(() => { if (parsed && isTrackFlow(parsed) && !flow && !flowDone) setFlow(parsed); }, [parsed, flow, flowDone]);
  const clearParam = () => void navigate({ to: '/learn/manage', search: { tab: 'tracks' }, replace: true, resetScroll: false });
  const own = (data?.tracks ?? []).filter(tr => tr.team_id === teamId);
  const flowEditing = flow && !flowTrack && !flowDone;
  const closeTrack = (created?: Track) => {
    if (editing) { setEditing(null); return; }
    if (created) { setFlowTrack(created); clearParam(); } else { setFlowDone(true); clearParam(); }
  };
  const closeLesson = () => { setLesson(null); if (flowTrack) { setFlowTrack(null); setFlowDone(true); } };
  return <section className="panel">
    <div className="section-heading"><h2>{t('learnHub.teamTracks')}</h2><Button onClick={() => setEditing({ cover_style: own.length % COVER_STYLES.length })}><Plus />{t('learnHub.newTrack')}</Button></div>
    {own.length ? <div className="manage-tracks">{own.map(tr => <article key={tr.id} className="manage-track">
      <div className="manage-track-head"><LearnCover path={tr.cover_url} style={tr.cover_style} title={trackTitle(tr, i18n.resolvedLanguage)} className="is-thumb" />
        <div className="order-title"><strong>{trackTitle(tr, i18n.resolvedLanguage)}</strong><small>{(() => { const st = data ? trackState(tr.is_published, lessonsOf(data, tr.id)) : null; const opens = tr.available_from && !isLive(tr.available_from) ? t('resources.item.scheduled', { date: new Date(tr.available_from).toLocaleString(i18n.resolvedLanguage) }) : null;
          return [tr.is_start_here ? t('learnHub.startHere') : null, st ? t(`resources.item.trackStateLabel.${st.key}`, { live: st.live, total: st.total }) : t(tr.is_published ? 'templates.published' : 'templates.draft'), opens].filter(Boolean).join(' · '); })()}</small></div>
        <div className="sheet-actions">
          <Button asChild variant="ghost" size="sm"><Link to="/learn/track/$id" params={{ id: tr.id }}><Eye />{t('resources.item.previewTitle')}</Link></Button>
          <Button variant="secondary" size="sm" onClick={() => setEditing(tr)}><Pencil />{t('templates.edit')}</Button></div></div>
      {data && <LessonOrder track={tr} lessons={lessonsOf(data, tr.id)} onEdit={setLesson} />}
    </article>)}</div> : <EmptyState compact icon="BookOpen" text={t('learnHub.noTracksYet')} />}
    <TrackEditor track={editing ?? (flowEditing ? { cover_style: own.length % COVER_STYLES.length } : null)} teamId={teamId} onClose={closeTrack} preset={editing ? null : flow} />
    <LessonEditor lesson={lesson ?? (flowTrack && flow ? { track_id: flowTrack.id } : null)} teamId={teamId} onClose={closeLesson} preset={lesson ? null : flow ? lessonPresetFor(flow) : null} />
  </section>;
}

function RecipeEditor({ recipe, teamId, onClose }: { recipe: Partial<Recipe> | null; teamId: string; onClose: () => void }) {
  const { t } = useTranslation(); const qc = useQueryClient(); const { userId } = useLearn();
  const [f, setF] = useState({ title_en: '', title_es: '', prep: '', tags: [] as string[], ing_en: '', ing_es: '', steps_en: '', steps_es: '', cover_url: null as string | null, cover_style: 0 });
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (recipe) setF({ title_en: recipe.title_en ?? '', title_es: recipe.title_es ?? '', prep: recipe.prep_minutes ? String(recipe.prep_minutes) : '', tags: recipe.tags ?? [], ing_en: listOf(recipe.ingredients, 'en').join('\n'), ing_es: listOf(recipe.ingredients, 'es').join('\n'), steps_en: listOf(recipe.steps, 'en').join('\n'), steps_es: listOf(recipe.steps, 'es').join('\n'), cover_url: recipe.cover_url ?? null, cover_style: recipe.cover_style ?? 0 }); }, [recipe]);
  const lines = (s: string) => s.split('\n').map(x => x.trim()).filter(Boolean).slice(0, 40).map(x => x.slice(0, 300));
  const ok = !!(f.title_en.trim() || f.title_es.trim());
  const save = async () => {
    setBusy(true);
    const row = { title_en: f.title_en.trim(), title_es: f.title_es.trim(), prep_minutes: parseInt(f.prep, 10) > 0 ? Math.min(600, parseInt(f.prep, 10)) : null, tags: f.tags,
      ingredients: { en: lines(f.ing_en), es: lines(f.ing_es) }, steps: { en: lines(f.steps_en), es: lines(f.steps_es) }, cover_url: f.cover_url, cover_style: f.cover_style };
    const res = recipe?.id ? await supabase.from('recipes').update(row).eq('id', recipe.id) : await supabase.from('recipes').insert({ ...row, team_id: teamId, created_by: userId });
    setBusy(false);
    if (res.error) { toast.error(errMsg(t, res.error)); return; }
    toast.success(t('templates.saved')); await qc.invalidateQueries({ queryKey: ['recipes', userId] }); onClose();
  };
  const remove = async () => {
    if (!recipe?.id || !(await confirmAction({ title: t('learnHub.confirmDeleteRecipe'), destructive: true }))) return;
    const res = await supabase.from('recipes').delete().eq('id', recipe.id);
    if (res.error) { toast.error(errMsg(t, res.error)); return; }
    await qc.invalidateQueries({ queryKey: ['recipes', userId] }); onClose();
  };
  return <ResponsiveSheet open={!!recipe} onOpenChange={o => !o && onClose()} title={recipe?.id ? t('learnHub.editRecipe') : t('learnHub.addRecipe')} description={t('learnHub.recipeRule')}>
    <div className="edit-form">
      <LangPair id="rc-title" label={t('templates.title')} en={f.title_en} es={f.title_es} onEn={v => setF({ ...f, title_en: v })} onEs={v => setF({ ...f, title_es: v })} maxLength={120} />
      <Field id="rc-prep" label={t('learnHub.prepLabel')}><Input id="rc-prep" type="number" min={1} max={600} className="field-input" value={f.prep} onChange={e => setF({ ...f, prep: e.target.value })} /></Field>
      <div className="form-field"><span className="field-label">{t('learnHub.tagsLabel')}</span><div className="filter-chips">{RECIPE_TAGS.map(tag => { const on = f.tags.includes(tag); return <button type="button" key={tag} className={`filter-chip ${on ? 'is-active' : ''}`} aria-pressed={on} onClick={() => setF({ ...f, tags: on ? f.tags.filter(x => x !== tag) : [...f.tags, tag] })}>{t(`learnHub.tags.${tag}`)}</button>; })}</div></div>
      <CoverPicker teamId={teamId} path={f.cover_url} styleIdx={f.cover_style} title={f.title_en || f.title_es} onPath={p => setF(x => ({ ...x, cover_url: p }))} onStyle={n => setF(x => ({ ...x, cover_style: n }))} />
      <p className="field-hint">{t('learnHub.onePerLine')}</p>
      <LangPair id="rc-ing" label={t('learnHub.ingredients')} en={f.ing_en} es={f.ing_es} onEn={v => setF({ ...f, ing_en: v })} onEs={v => setF({ ...f, ing_es: v })} multiline rows={5} />
      <LangPair id="rc-steps" label={t('learnHub.steps')} en={f.steps_en} es={f.steps_es} onEn={v => setF({ ...f, steps_en: v })} onEs={v => setF({ ...f, steps_es: v })} multiline rows={5} />
      <Button className="onboarding-continue" disabled={busy || !ok} onClick={save}>{busy ? t('onboarding.saving') : t('profile.save')}</Button>
      {recipe?.id && <Button variant="ghost" className="danger-link" onClick={remove}><Trash2 />{t('learnHub.deleteRecipe')}</Button>}
    </div>
  </ResponsiveSheet>;
}

function RecipesTab({ teamId, openNew }: { teamId: string; openNew?: boolean | undefined }) {
  const { t, i18n } = useTranslation(); const { userId } = useLearn(); const navigate = useNavigate();
  const { data } = useQuery(recipesQuery(userId));
  const [editing, setEditing] = useState<Partial<Recipe> | null>(null);
  const [consumed, setConsumed] = useState(false);
  const own = (data?.recipes ?? []).filter(r => r.team_id === teamId);
  useEffect(() => {
    if (openNew && !consumed) { setConsumed(true); setEditing({ tags: [], cover_style: own.length % COVER_STYLES.length }); void navigate({ to: '/learn/manage', search: { tab: 'recipes' }, replace: true, resetScroll: false }); }
  }, [openNew, consumed, own.length, navigate]);
  return <section className="panel">
    <div className="section-heading"><h2>{t('learnHub.teamRecipes')}</h2><Button onClick={() => setEditing({ tags: [], cover_style: own.length % COVER_STYLES.length })}><Plus />{t('learnHub.addRecipe')}</Button></div>
    {own.length ? <ul className="order-list">{own.map(r => <li key={r.id}><span className="order-title"><strong>{i18n.resolvedLanguage === 'es' ? r.title_es || r.title_en : r.title_en || r.title_es}</strong><small>{r.prep_minutes ? t('learnHub.prep', { count: r.prep_minutes }) : ''}</small></span>
      <Button variant="ghost" size="icon" aria-label={t('templates.edit')} onClick={() => setEditing(r)}><Pencil /></Button></li>)}</ul> : <EmptyState compact icon="BookOpen" text={t('learnHub.noTeamRecipes')} />}
    <RecipeEditor recipe={editing} teamId={teamId} onClose={() => setEditing(null)} />
  </section>;
}

function ProgressTab({ teamId }: { teamId: string }) {
  const { t, i18n } = useTranslation(); const { data: learn } = useLearn();
  const { data = [], error } = useQuery({ queryKey: ['track-progress', teamId], queryFn: async () => { const r = await supabase.rpc('track_progress', { _team: teamId }); if (r.error) throw r.error; return r.data ?? []; } });
  const byId = new Map((learn?.tracks ?? []).map(tr => [tr.id, tr]));
  return <section className="panel"><div className="section-heading"><div><h2>{t('learnHub.trackProgress')}</h2><p>{t('learnHub.trackProgressText')}</p></div></div>
    {error ? <p className="auth-subtitle">{t('teamSpace.notAllowed')}</p> : data.length ? <table className="progress-table"><thead><tr><th>{t('learnHub.track')}</th><th>{t('learnHub.started')}</th><th>{t('learnHub.finished')}</th></tr></thead>
      <tbody>{data.map(row => { const tr = byId.get(row.track_id); return <tr key={row.track_id}><td>{tr ? trackTitle(tr, i18n.resolvedLanguage) : '—'}<small>{t('learnHub.lessonCount', { count: row.lessons })}</small></td><td>{row.started}</td><td>{row.completed}</td></tr>; })}</tbody></table>
      : <EmptyState compact icon="BookOpen" text={t('learnHub.noTracksYet')} />}
  </section>;
}

export function LearnManage({ tab, newType }: { tab: Tab; newType?: string | undefined }) {
  const { t } = useTranslation(); const { teamId, workspace } = useLearn(); const navigate = useNavigate();
  if (!workspace) return <div className="min-h-96" />;
  if (workspace.role === 'member') return <section className="panel"><Link to="/learn" className="back-link"><ArrowLeft />{t('learn.title')}</Link><p className="auth-subtitle">{t('learnHub.leadersOnly')}</p></section>;
  return <>
    <Link to="/learn" className="back-link"><ArrowLeft />{t('learn.title')}</Link>
    <div className="page-heading"><div><span className="eyebrow">{t('learn.title')}</span><h1>{t('learnHub.manage')}</h1><p>{t('learnHub.manageText')}</p></div></div>
    <div className="segmented-tabs" role="tablist">{(['tracks', 'recipes', 'progress'] as const).map(k => <button key={k} role="tab" type="button" aria-selected={tab === k} className={tab === k ? 'is-active' : ''} onClick={() => void navigate({ to: '/learn/manage', search: { tab: k }, replace: true })}>{t(`learnHub.tab.${k}`)}</button>)}</div>
    {tab === 'tracks' && <TracksTab teamId={teamId} newType={newType} />}
    {tab === 'recipes' && <RecipesTab teamId={teamId} openNew={newType === 'recipe'} />}
    {tab === 'progress' && <ProgressTab teamId={teamId} />}
  </>;
}
