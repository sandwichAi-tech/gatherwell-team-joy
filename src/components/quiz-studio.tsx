import { removeResource } from '@/components/confirm-resource-removal';
import { BuilderStepFooter } from '@/components/builder-step-footer';
import { DestinationSummary, ResourceAccessFields } from '@/components/resource-access-fields';
import { myOffersQuery, offerTitle } from '@/lib/offers';
import { getPaymentsReadiness } from '@/lib/billing.functions';
import { canSellPaid } from '@/lib/payments-readiness';
import { destinationIssues, destinationsPrice, fromSavedDestinations, hasDestination, newDestinations, saveDestinations, type Destinations } from '@/lib/resource-placement';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { AlertCircle, ArrowDown, ArrowLeft, ArrowUp, BarChart3, CopyPlus, Eye, ImagePlus, Pencil, Plus, Trash2, X } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { ResponsiveSheet } from '@/components/responsive-sheet';
import { ListSkeleton, RetryState } from '@/components/launch-states';
import { confirmAction } from '@/components/confirm-dialog';
import { LangPair } from '@/components/lang-fields';
import { supabase } from '@/integrations/supabase/client';
import { useGatherwell } from '@/components/gatherwell-shell';
import { mediaUrl, uploadMedia } from '@/lib/account';
import { PollBars, QuizPreview, type PlayQuestion } from '@/components/quiz-play';
import {
  MAX_CHOICES, MIN_CHOICES, QUIZ_MODES, emptyOption, moveItem, questionProblems, quizBlockers, trueFalseOptions, typesForMode,
  type QuizMode, type StudioBand, type StudioOption, type StudioOutcome, type StudioQuestion,
} from '@/lib/quiz-studio';

const db = supabase as any;
const pick = (lang: string, en?: string | null, es?: string | null) => (lang === 'es' ? es || en : en || es) ?? '';
type Q = StudioQuestion & { id: string; sort_order: number };
type QuizRow = { id: string; offer_id: string | null; team_id: string | null; mode: QuizMode; title_en: string; title_es: string; instructions_en: string | null; instructions_es: string | null;
  pass_pct: number; attempts_allowed: number | null; cooldown_minutes: number; show_score: boolean; is_published: boolean };

function useSigned(paths: (string | null | undefined)[]) {
  const key = paths.filter(Boolean).sort().join('|');
  return useQuery({ queryKey: ['quiz-own-images', key], enabled: !!key, staleTime: 50 * 60 * 1000, queryFn: async () => {
    const out: Record<string, string> = {};
    await Promise.all(paths.filter((p): p is string => !!p).map(async p => { const u = await mediaUrl(p); if (u) out[p] = u; }));
    return out;
  } }).data ?? {};
}

/** Private image picker: uploads into the coach's own media folder, keeps alt text next to it. */
function ImageField({ id, path, alt, onChange, urls, label }: { id: string; path: string | null; alt: string; onChange: (p: { path: string | null; alt: string }) => void; urls: Record<string, string>; label: string }) {
  const { t } = useTranslation(); const { userId } = useGatherwell();
  const [busy, setBusy] = useState(false);
  const upload = async (f: File) => {
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { toast.error(t('quizStudio.imageType')); return; }
    if (f.size > 8 * 1024 * 1024) { toast.error(t('quizStudio.imageSize')); return; }
    setBusy(true);
    try { const p = await uploadMedia(userId!, f, 'quiz'); onChange({ path: p, alt }); } catch { toast.error(t('quizStudio.imageFailed')); }
    setBusy(false);
  };
  return <div className="quiz-image-field">
    {path ? <div className="quiz-image-thumb">{urls[path] ? <img src={urls[path]} alt={alt} /> : <span className="muted-small">{t('publicEvent.loading')}</span>}
      <Button variant="ghost" size="icon" aria-label={t('quizStudio.removeImage')} onClick={() => onChange({ path: null, alt: '' })}><X /></Button></div>
      : <label className="file-button"><ImagePlus />{busy ? t('learnHub.uploading') : label}<input type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={busy} onChange={e => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ''; }} /></label>}
    {path && <div className="form-field"><label className="field-label" htmlFor={id}>{t('quizStudio.altLabel')}</label>
      <Input id={id} className="field-input" maxLength={200} value={alt} aria-invalid={!alt.trim()} onChange={e => onChange({ path, alt: e.target.value })} placeholder={t('quizStudio.altPlaceholder')} />
      <small className="field-hint">{t('quizStudio.altHint')}</small></div>}
  </div>;
}

function QuestionSheet({ quiz, question, outcomes, onClose, nextOrder }: { quiz: QuizRow; question: Q | null; outcomes: StudioOutcome[]; onClose: (saved: boolean) => void; nextOrder: number }) {
  const { t, i18n } = useTranslation(); const lang = i18n.resolvedLanguage ?? 'en';
  const types = typesForMode(quiz.mode);
  const [f, setF] = useState<StudioQuestion>(() => question ?? { type: types[0]!, prompt_en: '', prompt_es: '', points: 1, image_path: null, image_alt: '', accepted: [], allow_manual: false,
    options: quiz.mode === 'scored' ? [{ ...emptyOption(), is_correct: true }, emptyOption()] : [emptyOption(), emptyOption()] });
  const [busy, setBusy] = useState(false); const [tried, setTried] = useState(false);
  const urls = useSigned([f.image_path, ...f.options.map(o => o.image_path)]);
  const single = f.type === 'single' || f.type === 'truefalse';
  const setOpt = (i: number, p: Partial<StudioOption>) => setF(x => ({ ...x, options: x.options.map((o, j) => j === i ? { ...o, ...p } : single && p.is_correct ? { ...o, is_correct: false } : o) }));
  const problems = questionProblems(f, quiz.mode).filter(p => p !== 'placeholder');
  const save = async () => {
    setTried(true);
    if (problems.length) { toast.error(t('quizStudio.fixQuestion')); return; }
    setBusy(true);
    const row = { type: f.type, prompt_en: f.prompt_en.trim(), prompt_es: f.prompt_es.trim(), points: quiz.mode === 'scored' ? Math.max(0.5, Number(f.points) || 1) : 1,
      image_path: f.image_path, image_alt: f.image_alt.trim() || null,
      accepted_answers: f.type === 'short' ? f.accepted.map(a => a.trim()).filter(Boolean) : null, allow_manual: f.type === 'short' ? f.allow_manual : false };
    let qid = question?.id;
    const res = qid ? await db.from('quiz_questions').update(row).eq('id', qid) : await db.from('quiz_questions').insert({ ...row, quiz_id: quiz.id, sort_order: nextOrder }).select('id').single();
    if (res.error) { setBusy(false); toast.error(t('profile.saveError')); return; }
    qid = qid ?? res.data.id;
    if (f.type !== 'short') {
      // Keep option ids stable (saved answers point at them): update existing, insert new, delete removed.
      const keep = f.options.filter(o => o.id).map(o => o.id!);
      const del = (question?.options ?? []).filter(o => o.id && !keep.includes(o.id)).map(o => o.id!);
      if (del.length) await db.from('quiz_options').delete().in('id', del);
      for (const [i, o] of f.options.entries()) {
        const r = { label_en: o.label_en.trim(), label_es: o.label_es.trim(), is_correct: quiz.mode === 'scored' && o.is_correct, sort_order: i + 1,
          image_path: o.image_path, image_alt: o.image_alt.trim() || null, outcome_id: quiz.mode === 'outcome' ? o.outcome_id : null };
        const e = o.id ? (await db.from('quiz_options').update(r).eq('id', o.id)).error : (await db.from('quiz_options').insert({ ...r, question_id: qid })).error;
        if (e) { setBusy(false); toast.error(t('profile.saveError')); return; }
      }
    } else if (question?.options.length) await db.from('quiz_options').delete().eq('question_id', qid);
    setBusy(false); toast.success(t('quizStudio.questionSaved')); onClose(true);
  };
  const remove = async () => {
    if (!question || !(await confirmAction({ title: t('quiz.confirmDeleteQuestion'), destructive: true }))) return;
    const { error } = await db.from('quiz_questions').delete().eq('id', question.id);
    if (error) { toast.error(t('profile.saveError')); return; }
    onClose(true);
  };
  return <ResponsiveSheet open onOpenChange={o => !o && onClose(false)} title={question ? t('quiz.editQuestion') : t('quiz.addQuestion')}
    footer={<div className="guest-button-row"><Button disabled={busy} onClick={save}>{busy ? t('onboarding.saving') : t('quizStudio.saveQuestion')}</Button>{question && <Button variant="ghost" className="danger-text" onClick={remove}><Trash2 />{t('quizStudio.deleteQuestion')}</Button>}</div>}>
    <div className="edit-form">
      {types.length > 1 && <div className="form-field"><label className="field-label" htmlFor="qs-type">{t('quiz.questionType')}</label>
        <select id="qs-type" className="field-input" value={f.type} onChange={e => { const ty = e.target.value as StudioQuestion['type']; setF(x => ({ ...x, type: ty, options: ty === 'truefalse' ? trueFalseOptions() : ty === 'short' ? [] : x.options.length >= 2 ? x.options : [emptyOption(), emptyOption()] })); }}>
          {types.map(ty => <option key={ty} value={ty}>{t(`quiz.type.${ty}`)}</option>)}</select></div>}
      <LangPair id="qs-prompt" label={t('quiz.prompt')} en={f.prompt_en} es={f.prompt_es} onEn={v => setF(x => ({ ...x, prompt_en: v }))} onEs={v => setF(x => ({ ...x, prompt_es: v }))} multiline rows={2} maxLength={500} />
      <ImageField id="qs-img-alt" path={f.image_path} alt={f.image_alt} urls={urls} label={t('quizStudio.addQuestionImage')} onChange={p => setF(x => ({ ...x, image_path: p.path, image_alt: p.alt }))} />
      {quiz.mode === 'scored' && <div className="form-field"><label className="field-label" htmlFor="qs-pts">{t('quiz.pointsLabel')}</label><Input id="qs-pts" type="number" min={0.5} step={0.5} className="field-input" value={f.points} onChange={e => setF(x => ({ ...x, points: Number(e.target.value) }))} /></div>}
      {f.type === 'short' ? <>
        <div className="form-field"><label className="field-label" htmlFor="qs-acc">{t('quiz.acceptedAnswers')}</label><Textarea id="qs-acc" rows={3} maxLength={1000} value={f.accepted.join('\n')} onChange={e => setF(x => ({ ...x, accepted: e.target.value.split('\n') }))} /></div>
        <label className="switch-row"><Switch checked={f.allow_manual} onCheckedChange={v => setF(x => ({ ...x, allow_manual: v }))} /><span><strong>{t('quiz.manualGrading')}</strong><small>{t('quiz.manualGradingText')}</small></span></label>
      </> : <div className="form-field"><span className="field-label">{t('quizStudio.choices', { min: MIN_CHOICES })}</span>
        {quiz.mode === 'scored' && <p className="field-hint">{t(f.type === 'multi' ? 'quizStudio.markAllCorrect' : 'quizStudio.markCorrect')}</p>}
        {quiz.mode === 'outcome' && <p className="field-hint">{t('quizStudio.mapHint')}</p>}
        <ol className="quiz-option-list">{f.options.map((o, i) => <li key={o.id ?? `n${i}`} className="quiz-option-edit">
          <div className="quiz-option-row">
            {quiz.mode === 'scored' && <label className="quiz-option-correct"><input type={f.type === 'multi' ? 'checkbox' : 'radio'} name="qs-correct" checked={o.is_correct} onChange={e => setOpt(i, { is_correct: f.type === 'multi' ? e.target.checked : true })} aria-label={t('quizStudio.correctFor', { n: i + 1 })} /></label>}
            <span className="order-title"><Input className="field-input" maxLength={200} aria-label={t('quizStudio.choiceEn', { n: i + 1 })} placeholder={`${t('quiz.option')} ${i + 1} · EN`} value={o.label_en} disabled={f.type === 'truefalse'} onChange={e => setOpt(i, { label_en: e.target.value })} />
              <Input className="field-input" maxLength={200} aria-label={t('quizStudio.choiceEs', { n: i + 1 })} placeholder={`${t('quiz.option')} ${i + 1} · ES`} value={o.label_es} disabled={f.type === 'truefalse'} onChange={e => setOpt(i, { label_es: e.target.value })} /></span>
            <Button variant="ghost" size="icon" disabled={i === 0} aria-label={t('templates.moveUp')} onClick={() => setF(x => ({ ...x, options: moveItem(x.options, i, -1) }))}><ArrowUp /></Button>
            <Button variant="ghost" size="icon" disabled={i === f.options.length - 1} aria-label={t('templates.moveDown')} onClick={() => setF(x => ({ ...x, options: moveItem(x.options, i, 1) }))}><ArrowDown /></Button>
            {f.options.length > MIN_CHOICES && f.type !== 'truefalse' && <Button variant="ghost" size="icon" aria-label={t('quiz.removeOption')} onClick={() => setF(x => ({ ...x, options: x.options.filter((_, j) => j !== i) }))}><Trash2 /></Button>}
          </div>
          {quiz.mode === 'outcome' && <select className="field-input" aria-label={t('quizStudio.mapTo', { n: i + 1 })} value={o.outcome_id ?? ''} aria-invalid={tried && !o.outcome_id} onChange={e => setOpt(i, { outcome_id: e.target.value || null })}>
            <option value="">{t('quizStudio.pickOutcome')}</option>{outcomes.map(oc => <option key={oc.id} value={oc.id}>{pick(lang, oc.title_en, oc.title_es) || t('quizStudio.untitledOutcome')}</option>)}</select>}
          {f.type !== 'truefalse' && <ImageField id={`qs-opt-alt-${i}`} path={o.image_path} alt={o.image_alt} urls={urls} label={t('quizStudio.addChoiceImage')} onChange={p => setOpt(i, { image_path: p.path, image_alt: p.alt })} />}
        </li>)}</ol>
        {f.type !== 'truefalse' && f.options.length < MAX_CHOICES && <Button variant="secondary" size="sm" onClick={() => setF(x => ({ ...x, options: [...x.options, emptyOption()] }))}><Plus />{t('quiz.addOption')}</Button>}
      </div>}
      {tried && problems.length > 0 && <ul className="offer-includes" role="alert">{problems.map(p => <li key={p}><AlertCircle />{t(`quiz.blocker.${p}`)}</li>)}</ul>}
    </div>
  </ResponsiveSheet>;
}

/** Coach quiz studio: settings, questions, outcomes / score bands, preview, publish/update, duplicate, results. */
export function QuizStudio({ quizId }: { quizId: string }) {
  const { t, i18n } = useTranslation(); const lang = i18n.resolvedLanguage ?? 'en';
  const qc = useQueryClient(); const navigate = useNavigate();
  const { userId } = useGatherwell();
  const offers = useQuery(myOffersQuery(userId));
  const readiness = useQuery({ queryKey: ['payments-readiness'], queryFn: () => getPaymentsReadiness() });
  const [dest, setDest] = useState<Destinations>(newDestinations());
  const [destSnap, setDestSnap] = useState('');
  const [pricing, setPricing] = useState({ free: true, price: '' });
  const [tab, setTab] = useState<'build' | 'preview' | 'results'>('build');
  const goTab = (k: 'build' | 'preview' | 'results') => { setTab(k); requestAnimationFrame(() => document.getElementById('qs-step-heading')?.focus()); };
  const load = useQuery({ queryKey: ['quiz-studio', quizId], queryFn: async () => {
    const z = await db.from('quizzes').select('*').eq('id', quizId).maybeSingle();
    if (z.error) throw z.error; if (!z.data) return null;
    const [qs, oc, bd] = await Promise.all([
      db.from('quiz_questions').select('*, quiz_options(*)').eq('quiz_id', quizId).order('sort_order'),
      db.from('quiz_outcomes').select('*').eq('quiz_id', quizId).order('sort_order'),
      db.from('quiz_bands').select('*').eq('quiz_id', quizId).order('min_pct'),
    ]);
    const questions: Q[] = (qs.data ?? []).map((r: any) => ({ id: r.id, sort_order: r.sort_order, type: r.type, prompt_en: r.prompt_en, prompt_es: r.prompt_es, points: Number(r.points), image_path: r.image_path, image_alt: r.image_alt ?? '',
      accepted: r.accepted_answers ?? [], allow_manual: r.allow_manual,
      options: [...(r.quiz_options ?? [])].sort((a: any, b: any) => a.sort_order - b.sort_order).map((o: any) => ({ id: o.id, label_en: o.label_en, label_es: o.label_es, is_correct: o.is_correct, image_path: o.image_path, image_alt: o.image_alt ?? '', outcome_id: o.outcome_id })) }));
    return { quiz: z.data as QuizRow, questions, outcomes: (oc.data ?? []).map((o: any) => ({ ...o, body_en: o.body_en ?? '', body_es: o.body_es ?? '', image_alt: o.image_alt ?? '' })) as (StudioOutcome & { image_path: string | null; image_alt: string; sort_order: number })[], bands: (bd.data ?? []) as (StudioBand & { id: string; body_en: string | null; body_es: string | null })[] };
  } });
  const [s, setS] = useState<QuizRow | null>(null);
  useEffect(() => { if (load.data?.quiz) { setS(load.data.quiz); const q = load.data.quiz as any; void (supabase as any).rpc('resource_destinations', { _kind: 'quiz', _id: quizId }).then((r: any) => { const d = fromSavedDestinations(r.data); if (d) { setDest(d); setDestSnap(JSON.stringify(d)); } }); if (q.commerce_offer_id) void db.from('offers').select('price_cents').eq('id', q.commerce_offer_id).maybeSingle().then((r: any) => setPricing({ free: !r.data?.price_cents, price: r.data?.price_cents ? String(r.data.price_cents / 100) : '' })); } }, [load.data?.quiz]);
  const [editing, setEditing] = useState<Q | 'new' | null>(null);
  const [outs, setOuts] = useState<(StudioOutcome & { image_path: string | null; image_alt: string })[]>([]);
  const [bands, setBands] = useState<(StudioBand & { body_en: string; body_es: string })[]>([]);
  useEffect(() => { if (load.data) { setOuts(load.data.outcomes); setBands(load.data.bands.map(b => ({ ...b, body_en: b.body_en ?? '', body_es: b.body_es ?? '' }))); } }, [load.data]);
  const serverBlockers = useQuery({ queryKey: ['quiz-blockers', quizId], queryFn: async () => ((await db.rpc('quiz_blockers', { _quiz: quizId })).data ?? []) as string[] });
  const summary = useQuery({ queryKey: ['quiz-summary', quizId], queryFn: async () => (await db.rpc('quiz_host_summary', { _quiz: quizId })).data });
  const urls = useSigned([...(load.data?.questions ?? []).flatMap(q => [q.image_path, ...q.options.map(o => o.image_path)]), ...outs.map(o => o.image_path)]);
  const [busy, setBusy] = useState(false);
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ['quiz-studio', quizId] }), qc.invalidateQueries({ queryKey: ['quiz-blockers', quizId] }), qc.invalidateQueries({ queryKey: ['team-quizzes'] })]);
  const dirty = useMemo(() => (!!s && !!load.data && JSON.stringify(s) !== JSON.stringify(load.data.quiz)) || (!!destSnap && JSON.stringify(dest) !== destSnap), [s, load.data, dest, destSnap]);

  if (load.isPending) return <ListSkeleton />;
  if (load.isError) return <RetryState retry={() => void load.refetch()} />;
  if (!load.data || !s) return <section className="panel empty-state" role="status"><p>{t('quizPlay.errors.not_found')}</p><Button asChild variant="secondary"><Link to="/learn" search={{ tab: 'mine' }}>{t('quizStudio.backToResources')}</Link></Button></section>;
  const data = load.data; const { questions } = data;
  const placeable = (offers.data ?? []).filter(o => o.kind === 'course' && o.status !== 'archived' && o.team_id === (s.team_id ?? (offers.data ?? []).find(x => x.id === s.offer_id)?.team_id));
  const courseOptions = placeable.map(o => ({ id: o.id, title: offerTitle(o, lang) }));
  const courseIds = placeable.map(o => o.id);
  const blockers = [...destinationIssues(dest, courseIds).map(i => `dest_${i}`), ...new Set([...quizBlockers({ mode: s.mode, title_en: s.title_en, title_es: s.title_es, instructions_en: s.instructions_en ?? '', instructions_es: s.instructions_es ?? '' }, questions, outs, bands), ...(serverBlockers.data ?? [])])];
  const hasAttempts = (summary.data?.attempts ?? 0) > 0;

  const saveSettings = async (extra: Partial<QuizRow> = {}) => {
    const cents = destinationsPrice(dest, pricing.free, pricing.price);
    if ((extra.is_published || s.is_published) && extra.is_published !== false && !hasDestination(dest)) { toast.error(t('resourcePlacement.needOne')); return false; }
    if (cents === null || (extra.is_published && cents > 0 && (!readiness.data || !canSellPaid(readiness.data)))) { toast.error(t('resources.item.paidBlocked')); return false; }
    setBusy(true);
    try { await saveDestinations((fn, args) => (supabase as any).rpc(fn, args), 'quiz', quizId, dest, courseIds, cents); setDestSnap(JSON.stringify(dest)); }
    catch { setBusy(false); toast.error(t('resources.item.saveFailed')); return false; }
    const row = { mode: s.mode, title_en: s.title_en.trim(), title_es: s.title_es.trim(), instructions_en: s.instructions_en?.trim() || null, instructions_es: s.instructions_es?.trim() || null,
      pass_pct: Math.min(100, Math.max(1, Math.round(Number(s.pass_pct) || 80))), attempts_allowed: s.attempts_allowed ? Math.max(1, Math.round(Number(s.attempts_allowed))) : null,
      cooldown_minutes: Math.max(0, Math.round(Number(s.cooldown_minutes) || 0)), show_score: s.show_score, ...extra };
    const { error } = await db.from('quizzes').update(row).eq('id', quizId);
    setBusy(false);
    if (error) { toast.error(t(String(error.message).includes('quiz_not_ready') ? 'quiz.notReady' : 'profile.saveError')); return false; }
    await refresh(); return true;
  };
  const saveOutcomes = async () => {
    setBusy(true);
    const ids = outs.map(o => o.id);
    const gone = data.outcomes.filter(o => !ids.includes(o.id)).map(o => o.id);
    if (gone.length) await db.from('quiz_outcomes').delete().in('id', gone);
    for (const [i, o] of outs.entries()) {
      const r = { id: o.id, quiz_id: quizId, title_en: o.title_en.trim(), title_es: o.title_es.trim(), body_en: o.body_en.trim() || null, body_es: o.body_es.trim() || null, image_path: o.image_path, image_alt: o.image_alt.trim() || null, sort_order: i + 1 };
      const { error } = await db.from('quiz_outcomes').upsert(r); if (error) { setBusy(false); toast.error(t('profile.saveError')); return; }
    }
    setBusy(false); toast.success(t('quizStudio.outcomesSaved')); await refresh();
  };
  const saveBands = async () => {
    setBusy(true);
    await db.from('quiz_bands').delete().eq('quiz_id', quizId);
    const rows = bands.map(b => ({ quiz_id: quizId, min_pct: Math.min(100, Math.max(0, Math.round(Number(b.min_pct) || 0))), title_en: b.title_en.trim(), title_es: b.title_es.trim(), body_en: b.body_en.trim() || null, body_es: b.body_es.trim() || null }));
    const { error } = rows.length ? await db.from('quiz_bands').insert(rows) : { error: null };
    setBusy(false); if (error) { toast.error(t('profile.saveError')); return; }
    toast.success(t('quizStudio.bandsSaved')); await refresh();
  };
  const publish = async () => {
    if (blockers.length) { toast.error(t('quizStudio.fixFirst')); return; }
    if (dirty && !(await saveSettings())) return;
    if (await saveSettings({ is_published: true })) { toast.success(t('quizStudio.published')); }
  };
  const update = async () => { if (await saveSettings()) toast.success(t('quizStudio.updated')); };
  const unpublish = async () => { if (await confirmAction({ title: t('quizStudio.unpublishConfirm') }) && await saveSettings({ is_published: false })) toast.success(t('quizStudio.unpublished')); };
  const duplicate = async () => {
    const { data, error } = await db.rpc('duplicate_quiz', { _quiz: quizId });
    if (error) { toast.error(t('profile.saveError')); return; }
    const src = await db.rpc('resource_destinations', { _kind: 'quiz', _id: quizId });
    const omitted = ((src.data?.courses ?? []) as { available?: boolean }[]).filter(c => c.available === false).length;
    toast.success(t('quizStudio.duplicated'));
    if (omitted) toast.info(t('resources.removal.copyOmitted', { count: omitted }));
    void navigate({ to: '/learn/quiz/$id', params: { id: data } });
  };
  const remove = async () => {
    if (!(await removeResource(t, 'quiz', quizId))) return;
    await qc.invalidateQueries({ queryKey: ['team-quizzes'] });
    void navigate({ to: '/learn', search: { tab: 'mine' } });
  };
  const exit = async () => {
    if (dirty && !(await confirmAction({ title: t('quizStudio.leaveUnsaved'), destructive: true }))) return;
    if (s.offer_id) void navigate({ to: '/offer/$id', params: { id: s.offer_id }, search: { panel: 'quiz' } }); else void navigate({ to: '/learn', search: { tab: 'mine' } });
  };
  const move = async (i: number, dir: -1 | 1) => {
    const a = questions[i]!, b = questions[i + dir]; if (!b) return;
    const r = await Promise.all([db.from('quiz_questions').update({ sort_order: b.sort_order === a.sort_order ? a.sort_order + dir : b.sort_order }).eq('id', a.id), db.from('quiz_questions').update({ sort_order: a.sort_order }).eq('id', b.id)]);
    if (r.some((x: any) => x.error)) toast.error(t('profile.saveError'));
    await refresh();
  };
  const changeMode = async (m: QuizMode) => {
    if (m === s.mode) return;
    if (questions.length && !(await confirmAction({ title: t('quizStudio.modeChangeTitle'), body: t('quizStudio.modeChangeBody') }))) return;
    setS({ ...s, mode: m });
  };

  const playQs: PlayQuestion[] = questions.map(q => ({ id: q.id, type: q.type, prompt_en: q.prompt_en, prompt_es: q.prompt_es, image_path: q.image_path, image_alt: q.image_alt,
    options: q.options.map(o => ({ id: o.id!, label_en: o.label_en, label_es: o.label_es, image_path: o.image_path, image_alt: o.image_alt })) }));
  const status = s.is_published ? (dirty ? 'publishedChanges' : 'published') : 'draft';

  return <article className="quiz-studio">
    <div className="page-heading"><div>
      <button type="button" className="auth-link" onClick={() => void exit()}><ArrowLeft />{t(s.offer_id ? 'quizStudio.backToCourse' : 'quizStudio.backToResources')}</button>
      <span className="eyebrow">{t('quizStudio.eyebrow')}</span>
      <h1>{pick(lang, s.title_en, s.title_es) || t('resources.untitled')}</h1>
      <p><span className="chip">{t(`quizStudio.status.${status}`)}</span> <span className="chip">{t(`quizStudio.mode.${s.mode}`)}</span></p>
    </div></div>
    <div className="scroll-row"><div className="segmented" role="tablist" aria-label={t('quizStudio.eyebrow')}>{(['build', 'preview', 'results'] as const).map(k =>
      <Button key={k} role="tab" variant="ghost" aria-selected={tab === k} className={tab === k ? 'selected' : ''} onClick={() => goTab(k)}>{k === 'preview' ? <Eye /> : k === 'results' ? <BarChart3 /> : <Pencil />}{t(`quizStudio.tabs.${k}`)}</Button>)}</div></div>
    <h2 id="qs-step-heading" tabIndex={-1} className="builder-step-heading">{t(`quizStudio.tabs.${tab}`)}</h2>

    {tab === 'build' && <>
      <section className="panel edit-form" aria-labelledby="qs-basics"><h2 id="qs-basics">{t('quizStudio.basics')}</h2>
        <div className="form-field"><span className="field-label">{t('quizStudio.modeLabel')}</span>
          <div className="filter-chips" role="radiogroup" aria-label={t('quizStudio.modeLabel')}>{QUIZ_MODES.map(m => <button key={m} type="button" role="radio" aria-checked={s.mode === m} disabled={hasAttempts && s.mode !== m}
            className={`filter-chip ${s.mode === m ? 'is-active' : ''}`} onClick={() => void changeMode(m)}>{t(`quizStudio.mode.${m}`)}</button>)}</div>
          <small className="field-hint">{t(`quizStudio.modeHint.${s.mode}`)}</small></div>
        <LangPair id="qs-title" label={t('templates.title')} en={s.title_en} es={s.title_es} onEn={v => setS({ ...s, title_en: v })} onEs={v => setS({ ...s, title_es: v })} maxLength={160} />
        <LangPair id="qs-instr" label={t('quiz.instructions')} en={s.instructions_en ?? ''} es={s.instructions_es ?? ''} onEn={v => setS({ ...s, instructions_en: v })} onEs={v => setS({ ...s, instructions_es: v })} multiline rows={2} maxLength={600} />
        <div className="bilingual">
          {s.mode === 'scored' && <div className="form-field"><label className="field-label" htmlFor="qs-pass">{t('quiz.passPct')}</label><Input id="qs-pass" type="number" min={1} max={100} className="field-input" value={s.pass_pct} onChange={e => setS({ ...s, pass_pct: Number(e.target.value) })} /></div>}
          <div className="form-field"><label className="field-label" htmlFor="qs-att">{t('quiz.attemptsAllowed')}</label><Input id="qs-att" type="number" min={1} className="field-input" placeholder={t('quiz.unlimited')} value={s.attempts_allowed ?? ''} onChange={e => setS({ ...s, attempts_allowed: e.target.value ? Number(e.target.value) : null })} /></div>
          <div className="form-field"><label className="field-label" htmlFor="qs-cool">{t('quiz.cooldown')}</label><Input id="qs-cool" type="number" min={0} className="field-input" value={s.cooldown_minutes} onChange={e => setS({ ...s, cooldown_minutes: Number(e.target.value) })} /></div>
        </div>
        <ResourceAccessFields type="quiz" dest={dest} onDest={setDest} free={pricing.free} price={pricing.price} onAccess={(free, price) => setPricing({ free, price })} courses={courseOptions} ready={!!readiness.data && canSellPaid(readiness.data)} prefix="qs-access" />
        <small className="field-hint">{t('quizStudio.retakeHint')}</small>
        {s.mode === 'scored' && <label className="switch-row"><Switch checked={s.show_score} onCheckedChange={v => setS({ ...s, show_score: v })} /><span><strong>{t('quiz.showScore')}</strong><small>{t('quiz.showScoreText')}</small></span></label>}
        <Button variant="secondary" disabled={busy} onClick={() => void saveSettings().then(ok => ok && toast.success(t('quizStudio.draftSaved')))}>{t('quizStudio.saveDraft')}</Button>
      </section>

      {s.mode === 'outcome' && <section className="panel edit-form" aria-labelledby="qs-out"><div className="section-heading"><h2 id="qs-out">{t('quizStudio.outcomes')}</h2>
        <Button variant="secondary" size="sm" onClick={() => setOuts([...outs, { id: crypto.randomUUID(), title_en: '', title_es: '', body_en: '', body_es: '', image_path: null, image_alt: '' }])}><Plus />{t('quizStudio.addOutcome')}</Button></div>
        <p className="field-hint">{t('quizStudio.outcomesHint')}</p>
        {outs.map((o, i) => <div key={o.id} className="quiz-outcome-edit">
          <LangPair id={`qs-oc-${i}`} label={t('quizStudio.outcomeTitle', { n: i + 1 })} en={o.title_en} es={o.title_es} onEn={v => setOuts(outs.map((x, j) => j === i ? { ...x, title_en: v } : x))} onEs={v => setOuts(outs.map((x, j) => j === i ? { ...x, title_es: v } : x))} maxLength={120} />
          <LangPair id={`qs-ocb-${i}`} label={t('quizStudio.outcomeBody')} en={o.body_en} es={o.body_es} onEn={v => setOuts(outs.map((x, j) => j === i ? { ...x, body_en: v } : x))} onEs={v => setOuts(outs.map((x, j) => j === i ? { ...x, body_es: v } : x))} multiline rows={2} maxLength={800} />
          <ImageField id={`qs-oc-alt-${i}`} path={o.image_path} alt={o.image_alt} urls={urls} label={t('quizStudio.addOutcomeImage')} onChange={p => setOuts(outs.map((x, j) => j === i ? { ...x, image_path: p.path, image_alt: p.alt } : x))} />
          <Button variant="ghost" size="sm" className="danger-text" onClick={() => setOuts(outs.filter((_, j) => j !== i))}><Trash2 />{t('quizStudio.removeOutcome')}</Button>
        </div>)}
        <Button disabled={busy} onClick={saveOutcomes}>{t('quizStudio.saveOutcomes')}</Button></section>}

      {s.mode === 'scored' && <section className="panel edit-form" aria-labelledby="qs-bands"><div className="section-heading"><h2 id="qs-bands">{t('quizStudio.bands')}</h2>
        <Button variant="secondary" size="sm" onClick={() => setBands([...bands, { min_pct: bands.length ? Math.min(100, Math.max(...bands.map(b => b.min_pct)) + 20) : 0, title_en: '', title_es: '', body_en: '', body_es: '' }])}><Plus />{t('quizStudio.addBand')}</Button></div>
        <p className="field-hint">{t('quizStudio.bandsHint')}</p>
        {bands.map((b, i) => <div key={i} className="quiz-outcome-edit">
          <div className="form-field"><label className="field-label" htmlFor={`qs-bmin-${i}`}>{t('quizStudio.bandFrom')}</label><Input id={`qs-bmin-${i}`} type="number" min={0} max={100} className="field-input" value={b.min_pct} onChange={e => setBands(bands.map((x, j) => j === i ? { ...x, min_pct: Number(e.target.value) } : x))} /></div>
          <LangPair id={`qs-bt-${i}`} label={t('quizStudio.bandTitle')} en={b.title_en} es={b.title_es} onEn={v => setBands(bands.map((x, j) => j === i ? { ...x, title_en: v } : x))} onEs={v => setBands(bands.map((x, j) => j === i ? { ...x, title_es: v } : x))} maxLength={120} />
          <LangPair id={`qs-bb-${i}`} label={t('quizStudio.bandBody')} en={b.body_en} es={b.body_es} onEn={v => setBands(bands.map((x, j) => j === i ? { ...x, body_en: v } : x))} onEs={v => setBands(bands.map((x, j) => j === i ? { ...x, body_es: v } : x))} multiline rows={2} maxLength={600} />
          <Button variant="ghost" size="sm" className="danger-text" onClick={() => setBands(bands.filter((_, j) => j !== i))}><Trash2 />{t('quizStudio.removeBand')}</Button>
        </div>)}
        <Button disabled={busy} onClick={saveBands}>{t('quizStudio.saveBands')}</Button></section>}

      <section className="panel" aria-labelledby="qs-qs"><div className="section-heading"><h2 id="qs-qs">{t('quiz.questions')}</h2>
        <Button variant="secondary" size="sm" disabled={dirty} onClick={() => setEditing('new')}><Plus />{t('quiz.addQuestion')}</Button></div>
        {dirty && <p className="field-hint">{t('quizStudio.saveSettingsFirst')}</p>}
        {!questions.length ? <p className="muted-small">{t('quiz.noQuestions')}</p> :
          <ol className="order-list">{questions.map((q, i) => { const probs = questionProblems(q, s.mode); return <li key={q.id}>
            <span className="order-title"><strong>{pick(lang, q.prompt_en, q.prompt_es) || t('quiz.untitledQuestion')}</strong>
              <small>{t(`quiz.type.${q.type}`)} · {t('quizStudio.choiceCount', { count: q.options.length })}{probs.length ? ` · ${t('quizStudio.needsWork')}` : ''}</small></span>
            <Button variant="ghost" size="icon" disabled={i === 0} aria-label={t('templates.moveUp')} onClick={() => void move(i, -1)}><ArrowUp /></Button>
            <Button variant="ghost" size="icon" disabled={i === questions.length - 1} aria-label={t('templates.moveDown')} onClick={() => void move(i, 1)}><ArrowDown /></Button>
            <Button variant="ghost" size="icon" aria-label={t('quizStudio.editQuestionN', { n: i + 1 })} disabled={dirty} onClick={() => setEditing(q)}><Pencil /></Button>
          </li>; })}</ol>}
      </section>

      <section className="panel" aria-labelledby="qs-pub"><h2 id="qs-pub">{t(s.is_published ? 'quizStudio.liveTitle' : 'quizStudio.readyTitle')}</h2>
        <DestinationSummary paid={!pricing.free} dest={dest} courses={courseOptions} onFix={() => document.getElementById('qs-access-destinations')?.focus()} />
        {blockers.length ? <ul className="offer-includes" role="status">{blockers.map(b => <li key={b}><AlertCircle />{b.startsWith('dest_') ? t(`resources.item.issue.${b.slice(5)}`) : t(`quiz.blocker.${b}`)}</li>)}</ul> : <p className="muted-small">{t('quizStudio.allGood')}</p>}
        <div className="guest-button-row">
          {!s.is_published ? <Button disabled={busy || blockers.length > 0} onClick={publish}>{t('quiz.publish')}</Button>
            : <><Button disabled={busy || !dirty} onClick={update}>{t('quizStudio.update')}</Button><Button variant="secondary" disabled={busy} onClick={unpublish}>{t('quiz.unpublish')}</Button></>}
          <Button variant="secondary" onClick={() => setTab('preview')}><Eye />{t('quizStudio.tabs.preview')}</Button>
          <Button variant="ghost" onClick={duplicate}><CopyPlus />{t('quizStudio.duplicate')}</Button>
          <Button variant="ghost" className="danger-text" onClick={remove}><Trash2 />{t('quiz.delete')}</Button>
        </div>
        <Button variant="ghost" onClick={() => void exit()}>{t('quizStudio.exit')}</Button>
      </section>
      <BuilderStepFooter onSave={() => void saveSettings().then(ok => { if (ok) toast.success(t('resources.item.draftToast')); })} saveDisabled={!dirty} saving={busy}
        onNext={() => goTab('preview')} />
    </>}

    {tab === 'preview' && <section className="panel"><QuizPreview mode={s.mode} title={pick(lang, s.title_en, s.title_es)} questions={playQs} outcomes={outs.map(o => ({ ...o, body_en: o.body_en || null, body_es: o.body_es || null }))}
      bands={bands.map(b => ({ ...b, body_en: b.body_en || null, body_es: b.body_es || null }))} passPct={s.pass_pct} urls={urls}
      keys={Object.fromEntries(questions.map(q => [q.id, q.options.filter(o => o.is_correct).map(o => o.id!)]))}
      outcomeOf={Object.fromEntries(questions.flatMap(q => q.options.map(o => [o.id!, o.outcome_id])))} /><BuilderStepFooter onBack={() => goTab('build')} saving={busy}
        final={!s.is_published ? <Button className="builder-footer-primary" disabled={busy || blockers.length > 0} aria-busy={busy} onClick={publish}>{busy ? t('onboarding.saving') : t('quiz.publish')}</Button>
          : <Button className="builder-footer-primary" disabled={busy || !dirty} aria-busy={busy} onClick={update}>{busy ? t('onboarding.saving') : t('quizStudio.update')}</Button>} /></section>}

    {tab === 'results' && <section className="panel" aria-labelledby="qs-res"><h2 id="qs-res">{t('quizStudio.tabs.results')}</h2>
      {summary.isPending ? <ListSkeleton rows={2} /> : summary.isError || !summary.data ? <RetryState retry={() => void summary.refetch()} /> : summary.data.respondents === 0 ? <p className="muted">{t('quizStudio.noResponses')}</p> : <>
        <dl className="quiz-stats">
          <div><dt>{t('quizStudio.respondents')}</dt><dd>{summary.data.respondents}</dd></div>
          <div><dt>{t('quizStudio.attempts')}</dt><dd>{summary.data.attempts}</dd></div>
          {s.mode === 'scored' && <><div><dt>{t('quizStudio.avgScore')}</dt><dd>{summary.data.avg_score ?? '—'}%</dd></div><div><dt>{t('quizStudio.passRate')}</dt><dd>{summary.data.pass_rate ?? '—'}%</dd></div></>}
        </dl>
        {s.mode === 'outcome' && <ul className="settings-list">{summary.data.outcomes.map((o: any) => <li key={o.id} className="settings-row"><span className="settings-label">{pick(lang, o.title_en, o.title_es)}</span><strong>{o.count}</strong></li>)}</ul>}
        {summary.data.poll_hidden ? <p className="muted-small">{t('quizPlay.pollHidden', { count: 3 })}</p> : <PollBars poll={summary.data.questions} lang={lang} />}
        {s.mode === 'poll' ? <p className="muted-small">{t('quizStudio.pollAnonymous')}</p> : summary.data.recent.length > 0 && <><h3>{t('quizStudio.recent')}</h3>
          <ul className="settings-list">{summary.data.recent.map((r: any, i: number) => <li key={i} className="settings-row"><span className="settings-label"><strong>{r.name || t('quizStudio.member')}</strong>
            <small className="muted">{t('quizStudio.attemptN', { n: r.attempt_no })} · {new Date(r.submitted_at).toLocaleDateString(lang, { month: 'short', day: 'numeric' })}</small></span>
            <strong>{s.mode === 'scored' ? `${Math.round(Number(r.score_pct ?? 0))}%` : pick(lang, r.outcome_en, r.outcome_es)}</strong></li>)}</ul></>}
      </>}</section>}

    {editing && <QuestionSheet quiz={s} question={editing === 'new' ? null : editing} outcomes={outs.filter(o => data.outcomes.some(x => x.id === o.id))} nextOrder={(questions.at(-1)?.sort_order ?? 0) + 1}
      onClose={saved => { setEditing(null); if (saved) void refresh(); }} />}
  </article>;
}
