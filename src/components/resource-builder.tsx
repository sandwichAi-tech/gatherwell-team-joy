import { useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ArrowLeft, Check, GraduationCap, Upload } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { confirmAction } from '@/components/confirm-dialog';
import { CoverPicker, Field } from '@/components/learn-manage';
import { LangFields } from '@/components/lang-fields';
import { QuizEditor } from '@/components/quiz';
import { RefundSelect } from '@/components/refund-line';
import { useLearn } from '@/components/learn';
import { hasAnyTitle } from '@/lib/lang-fields';
import { listOf, RECIPE_TAGS, uploadLearnFile } from '@/lib/learn';
import { myOffersQuery, offerTitle, saveOffer, uploadOfferFile, type Offer } from '@/lib/offers';
import type { RefundPolicy } from '@/lib/refunds';
import {
  CREATE_TYPES, emptyBuilderDraft, isTrackFlow, lessonEditorConfig, lessonPresetFor, offerKindFor, typeContentAtRisk,
  type BuilderDraft, type CreateType,
} from '@/lib/create-resource';

const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
const validUrl = (u: string) => !u || /^https?:\/\/\S+$/i.test(u);

/**
 * One builder for every resource type: the type selector sits on top, shared fields
 * (active-language title/description, cover) stay put while the type-specific section
 * swaps underneath. Switching type keeps shared input and asks before discarding
 * incompatible type-specific content.
 */
export function ResourceBuilder({ initialType }: { initialType: CreateType }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? 'en';
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { teamId, userId } = useLearn();

  const [type, setType] = useState<CreateType>(initialType);
  const [shared, setShared] = useState({ titleEn: '', titleEs: '', descEn: '', descEs: '', coverPath: null as string | null, coverStyle: 0 });
  const [draft, setDraft] = useState<BuilderDraft>(emptyBuilderDraft);
  const [publish, setPublish] = useState(false);
  const [refund, setRefund] = useState<RefundPolicy>('24h');
  const [drip, setDrip] = useState(7);
  const [courseId, setCourseId] = useState('');
  const [createdQuiz, setCreatedQuiz] = useState<{ quizId: string; offer: Offer } | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [fileName, setFileName] = useState('');

  const offers = useQuery(myOffersQuery(userId));
  const courses = (offers.data ?? []).filter(o => o.kind === 'course' && o.status !== 'archived');

  const patchLesson = (p: Partial<BuilderDraft['lesson']>) => setDraft(d => ({ ...d, lesson: { ...d.lesson, ...p } }));
  const patchRecipe = (p: Partial<BuilderDraft['recipe']>) => setDraft(d => ({ ...d, recipe: { ...d.recipe, ...p } }));
  const patchOffer = (p: Partial<BuilderDraft['offer']>) => setDraft(d => ({ ...d, offer: { ...d.offer, ...p } }));

  const pickType = async (next: CreateType) => {
    if (next === type) return;
    if (typeContentAtRisk(draft, type, next)) {
      const ok = await confirmAction({ title: t('resources.builder.switchTitle'), body: t('resources.builder.switchText'), confirmLabel: t('resources.builder.switchConfirm') });
      if (!ok) return;
      // Clear only the incompatible family; shared title/description/cover always carry over.
      if (isTrackFlow(type) && !isTrackFlow(next)) patchLesson({ url: '', storagePath: null, live: '', meeting: '', replay: '' });
      if (type === 'recipe' && next !== 'recipe') setDraft(d => ({ ...d, recipe: emptyBuilderDraft().recipe }));
      if (offerKindFor(type) && !offerKindFor(next)) patchOffer({ price: '', filePath: null });
    }
    setType(next);
    void navigate({ to: '/learn/create', search: { type: next }, replace: true, resetScroll: false });
  };

  const uploadLessonFile = async (file: File) => {
    setFileName(file.name); setProgress(0);
    try { const p = await uploadLearnFile(teamId, file, setProgress); patchLesson({ storagePath: p, url: '' }); setProgress(100); }
    catch { toast.error(t('profile.saveError')); setProgress(null); setFileName(''); }
  };
  const uploadOfferFileAction = async (file: File) => {
    if (file.size > 100 * 1024 * 1024) { toast.error(t('offers.fileTooBig')); return; }
    setBusy(true);
    try { const p = await uploadOfferFile(userId, file); patchOffer({ filePath: p }); toast.success(t('offers.fileReady')); }
    catch { toast.error(t('offers.uploadError')); }
    setBusy(false);
  };

  const lessonType = isTrackFlow(type) ? lessonPresetFor(type) : null;
  const cfg = lessonType ? lessonEditorConfig(lessonType) : null;
  const priceCents = draft.offer.price ? Math.round(Number(draft.offer.price) * 100) : 0;

  const valid = hasAnyTitle(shared.titleEn, shared.titleEs)
    && (type !== 'link' || (draft.lesson.url.trim() !== '' && validUrl(draft.lesson.url)))
    && (type !== 'live' || !!draft.lesson.live)
    && (!isTrackFlow(type) || (validUrl(draft.lesson.url) && validUrl(draft.lesson.meeting) && validUrl(draft.lesson.replay)))
    && (type !== 'quiz' || !!courseId)
    && (!offerKindFor(type) || (Number.isFinite(priceCents) && priceCents >= 0 && priceCents <= 100000))
    && (!publish || type !== 'file' && type !== 'bundle' || !!draft.offer.filePath)
    && (progress === null || progress === 100);

  const finish = async (ok: boolean, go?: () => void) => {
    setBusy(false);
    if (!ok) { toast.error(t('profile.saveError')); return; }
    toast.success(t('templates.saved'));
    await qc.invalidateQueries();
    go?.();
  };

  const save = async () => {
    setBusy(true);
    const base = {
      title_en: shared.titleEn.trim(), title_es: shared.titleEs.trim(),
      description_en: shared.descEn.trim() || null, description_es: shared.descEs.trim() || null,
      cover_url: shared.coverPath, cover_style: shared.coverStyle,
    };
    if (isTrackFlow(type) && lessonType) {
      const tr = await supabase.from('tracks').insert({ ...base, is_published: publish, team_id: teamId, sort_order: Date.now() % 1_000_000 }).select('id').single();
      if (tr.error) return finish(false);
      const ls = await supabase.from('lessons').insert({
        title_en: base.title_en, title_es: base.title_es, type: lessonType, track_id: tr.data.id, sort_order: 1,
        url: lessonType === 'live' ? null : draft.lesson.url.trim() || null,
        storage_path: cfg?.keepsFile ? draft.lesson.storagePath : null,
        live_starts_at: lessonType === 'live' && draft.lesson.live ? new Date(draft.lesson.live).toISOString() : null,
        replay_url: lessonType === 'live' ? draft.lesson.replay.trim() || null : null,
      }).select('id').single();
      if (ls.error) return finish(false);
      if (lessonType === 'live' && draft.lesson.meeting.trim()) await supabase.from('lesson_live_links').insert({ lesson_id: ls.data.id, url: draft.lesson.meeting.trim() });
      return finish(true, () => void navigate({ to: '/learn/manage', search: { tab: 'tracks' } }));
    }
    if (type === 'recipe') {
      const lines = (s: string) => s.split('\n').map(x => x.trim()).filter(Boolean).slice(0, 40).map(x => x.slice(0, 300));
      const r = await supabase.from('recipes').insert({
        title_en: base.title_en, title_es: base.title_es, cover_url: base.cover_url, cover_style: base.cover_style,
        prep_minutes: parseInt(draft.recipe.prep, 10) > 0 ? Math.min(600, parseInt(draft.recipe.prep, 10)) : null,
        tags: draft.recipe.tags,
        ingredients: { en: lines(draft.recipe.ingEn), es: lines(draft.recipe.ingEs) },
        steps: { en: lines(draft.recipe.stepsEn), es: lines(draft.recipe.stepsEs) },
        team_id: teamId, created_by: userId,
      });
      return finish(!r.error, () => void navigate({ to: '/learn/manage', search: { tab: 'recipes' } }));
    }
    const kind = offerKindFor(type);
    if (kind) {
      const row = {
        kind, ...base, price_cents: priceCents, refund_policy: refund, drip_days: drip,
        file_path: kind === 'download' ? draft.offer.filePath : null,
        includes_en: [] as string[], includes_es: [] as string[],
        status: (publish ? 'published' : 'draft') as 'published' | 'draft', team_id: teamId, host_id: userId,
      };
      const r = await saveOffer(row);
      if (r.error) { setBusy(false); toast.error(t(String(r.error.message).includes('payouts_required') ? 'billing.payoutsRequired' : 'offers.saveError')); return; }
      return finish(true, () => void navigate({ to: '/offers' }));
    }
    // quiz: create a draft quiz on the chosen course, then open the question builder inline.
    const offer = courses.find(o => o.id === courseId);
    if (!offer) return finish(false);
    const q = await supabase.from('quizzes').insert({
      title_en: base.title_en, title_es: base.title_es, offer_id: offer.id, created_by: userId,
      pass_pct: 80, cooldown_minutes: 0, is_required: false, show_score: true, reveal_answers: 'after_pass', is_published: false, sort_order: 1,
    }).select('id').single();
    setBusy(false);
    if (q.error) { toast.error(t('profile.saveError')); return; }
    toast.success(t('resources.builder.quizReady'));
    setCreatedQuiz({ quizId: q.data.id, offer });
  };

  if (createdQuiz) {
    return <QuizEditor
      quiz={{ id: createdQuiz.quizId, offer_id: createdQuiz.offer.id, title_en: shared.titleEn.trim(), title_es: shared.titleEs.trim(), pass_pct: 80, cooldown_minutes: 0, is_required: false, show_score: true, reveal_answers: 'after_pass', is_published: false, sort_order: 1 }}
      offer={createdQuiz.offer} lessons={[]}
      onClose={() => void navigate({ to: '/offer/$id', params: { id: createdQuiz.offer.id }, search: { panel: 'quiz' } })} />;
  }

  return <>
    <Link to="/learn/create" className="back-link"><ArrowLeft />{t('resources.create.chooseAnother')}</Link>
    <div className="page-heading"><div><span className="eyebrow">{t('resources.create.title')}</span><h1>{t(`resources.create.types.${type}.name`)}</h1><p>{t(`resources.create.types.${type}.example`)}</p></div></div>

    <section className="panel builder-panel">
      <Field id="rb-type" label={t('resources.builder.typeLabel')}>
        <select id="rb-type" className="field-input" value={type} onChange={e => void pickType(e.target.value as CreateType)}>
          {CREATE_TYPES.map(ct => <option key={ct} value={ct}>{t(`resources.create.types.${ct}.name`)}</option>)}
        </select>
      </Field>

      <LangFields idPrefix="rb" titleEn={shared.titleEn} titleEs={shared.titleEs} descEn={shared.descEn} descEs={shared.descEs}
        onChange={p => setShared(s => ({ ...s, titleEn: p.titleEn ?? s.titleEn, titleEs: p.titleEs ?? s.titleEs, descEn: p.descEn ?? s.descEn, descEs: p.descEs ?? s.descEs }))}
        titleLabel={t('templates.title')} descLabel={t('templates.description')} titlePlaceholder={t(`resources.preset.track.${isTrackFlow(type) ? type : 'video'}`)} />

      {type !== 'quiz' && <CoverPicker teamId={teamId} path={shared.coverPath} styleIdx={shared.coverStyle} title={shared.titleEn || shared.titleEs}
        onPath={p => setShared(s => ({ ...s, coverPath: p }))} onStyle={n => setShared(s => ({ ...s, coverStyle: n }))} />}

      {/* ---- type-specific sections ---- */}
      {isTrackFlow(type) && cfg && <>
        {cfg.uploadAccept && <div className="form-field"><span className="field-label">{t(type === 'video' ? 'learnHub.uploadVideo' : type === 'audio' ? 'learnHub.uploadAudio' : 'learnHub.uploadPdf')}</span>
          <label className="file-button"><Upload />{t('learnHub.chooseFile')}<input type="file" accept={cfg.uploadAccept} hidden onChange={e => { const x = e.target.files?.[0]; if (x) void uploadLessonFile(x); }} /></label>
          {progress !== null && <div className="upload-progress"><span>{fileName}</span><progress value={progress} max={100} aria-label={t('learnHub.uploading')} /><small>{progress < 100 ? t('learnHub.uploadingPct', { pct: progress }) : t('learnHub.uploaded')}</small></div>}
          {progress === null && draft.lesson.storagePath && <p className="field-hint">{t('learnHub.fileAttached')} <button type="button" className="text-link" onClick={() => patchLesson({ storagePath: null })}>{t('learnHub.removeFile')}</button></p>}
          <p className="field-hint">{t(type === 'video' ? 'learnHub.videoHint' : type === 'audio' ? 'learnHub.audioHint' : 'learnHub.pdfHint')}</p></div>}
        {cfg.showsUrl && !draft.lesson.storagePath && <Field id="rb-url" label={t(type === 'video' ? 'learnHub.videoLink' : type === 'guide' ? 'learnHub.pdfLink' : type === 'audio' ? 'learnHub.audioLink' : 'learnHub.link')}>
          <Input id="rb-url" type="url" inputMode="url" className="field-input" placeholder="https://" value={draft.lesson.url} onChange={e => patchLesson({ url: e.target.value })} aria-invalid={!validUrl(draft.lesson.url)} />
        </Field>}
        {type === 'live' && <>
          <Field id="rb-live" label={t('learnHub.liveStarts')}><Input id="rb-live" type="datetime-local" className="field-input" value={draft.lesson.live} onChange={e => patchLesson({ live: e.target.value })} /></Field>
          <Field id="rb-meet" label={t('learnHub.meetingLink')}><Input id="rb-meet" type="url" className="field-input" placeholder="https://" value={draft.lesson.meeting} onChange={e => patchLesson({ meeting: e.target.value })} /></Field>
          <Field id="rb-replay" label={t('learnHub.replayLink')}><Input id="rb-replay" type="url" className="field-input" placeholder="https://" value={draft.lesson.replay} onChange={e => patchLesson({ replay: e.target.value })} /></Field>
        </>}
      </>}

      {type === 'recipe' && <>
        <Field id="rb-prep" label={t('learnHub.prepLabel')}><Input id="rb-prep" type="number" min={1} max={600} className="field-input" value={draft.recipe.prep} onChange={e => patchRecipe({ prep: e.target.value })} /></Field>
        <div className="form-field"><span className="field-label">{t('learnHub.tagsLabel')}</span><div className="filter-chips">{RECIPE_TAGS.map(tag => { const on = draft.recipe.tags.includes(tag); return <button type="button" key={tag} className={`filter-chip ${on ? 'is-active' : ''}`} aria-pressed={on} onClick={() => patchRecipe({ tags: on ? draft.recipe.tags.filter(x => x !== tag) : [...draft.recipe.tags, tag] })}>{t(`learnHub.tags.${tag}`)}</button>; })}</div></div>
        <p className="field-hint">{t('learnHub.onePerLine')}</p>
        <Field id="rb-ing" label={t('learnHub.ingredients')}><textarea id="rb-ing" rows={5} className="field-textarea" value={lang === 'es' ? draft.recipe.ingEs : draft.recipe.ingEn} onChange={e => patchRecipe(lang === 'es' ? { ingEs: e.target.value } : { ingEn: e.target.value })} /></Field>
        <Field id="rb-steps" label={t('learnHub.steps')}><textarea id="rb-steps" rows={5} className="field-textarea" value={lang === 'es' ? draft.recipe.stepsEs : draft.recipe.stepsEn} onChange={e => patchRecipe(lang === 'es' ? { stepsEs: e.target.value } : { stepsEn: e.target.value })} /></Field>
      </>}

      {offerKindFor(type) && <>
        {(type === 'file' || type === 'bundle') && <div className="form-field"><span className="field-label">{t('offers.file')}</span>
          <label className="file-button"><Upload />{draft.offer.filePath ? t('offers.replaceFile') : t('offers.uploadFile')}
            <input type="file" accept="application/pdf,.pdf,.epub,.zip" hidden onChange={e => { const x = e.target.files?.[0]; if (x) void uploadOfferFileAction(x); }} /></label>
          {draft.offer.filePath && <small className="muted-small"><Check className="inline-icon" />{t('offers.fileAttached')}</small>}
          {type === 'bundle' && <p className="field-hint">{t('resources.preset.bundle.hint')}</p>}</div>}
        <Field id="rb-price" label={type === 'course' ? t('offers.priceMonthly') : t('offers.price')}>
          <Input id="rb-price" className="field-input" inputMode="decimal" value={draft.offer.price} placeholder="0" onChange={e => patchOffer({ price: e.target.value.replace(/[^0-9.]/g, '') })} />
        </Field>
        {priceCents > 0 && <RefundSelect id="rb-refund" value={refund} onChange={setRefund} />}
        <p className="muted-small">{t('offers.feeNote')}</p>
        {type === 'course' && <>
          <Field id="rb-drip" label={t('offers.drip')}><Input id="rb-drip" type="number" min={0} max={60} className="field-input" value={drip} onChange={e => setDrip(Math.max(0, Math.min(60, Number(e.target.value) || 0)))} /></Field>
          <p className="muted-small">{t('resources.builder.courseNote')}</p>
        </>}
      </>}

      {type === 'quiz' && <div className="form-field"><span className="field-label">{t('resources.builder.pickCourse')}</span>
        {courses.length ? <select className="field-input" value={courseId} onChange={e => setCourseId(e.target.value)} aria-label={t('resources.builder.pickCourse')}>
          <option value="">{t('resources.builder.pickCoursePlaceholder')}</option>
          {courses.map(o => <option key={o.id} value={o.id}>{offerTitle(o, lang) || t('offers.untitled')}</option>)}
        </select> : <p className="muted-small">{t('resources.builder.noCourses')}</p>}
        <Button asChild variant="secondary" size="sm"><Link to="/offers" search={{ new: 'course' }}><GraduationCap />{t('resources.create.quizParent.new')}</Link></Button>
      </div>}

      {(isTrackFlow(type) || offerKindFor(type)) && <label className="switch-row"><Switch checked={publish} onCheckedChange={setPublish} /><span><strong>{t('offers.publish')}</strong><small>{t(publish ? 'templates.published' : 'templates.draft')} · {t('resources.builder.publishHint')}</small></span></label>}

      <Button className="onboarding-continue" disabled={busy || !valid} onClick={save}>
        {busy ? t('onboarding.saving') : publish ? t('offers.publish') : t('gathering.saveDraft')}
      </Button>
    </section>
  </>;
}
