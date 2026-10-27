import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ArrowDown, ArrowLeft, ArrowUp, Eye, Plus, Save, Trash2 } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { ListSkeleton, RetryState } from '@/components/launch-states';
import { ResourceAccessFields } from '@/components/resource-access-fields';
import { confirmAction } from '@/components/confirm-dialog';
import { useLearn } from '@/components/learn';
import { supabase } from '@/integrations/supabase/client';
import { myOffersQuery, offerTitle } from '@/lib/offers';
import { resourceAccessPrice, savedPlacement, type ResourcePlacement } from '@/lib/resource-placement';
import { assessmentIssues, assessmentResult, assessmentScore, emptyAssessment, reorderedIds, safeExternalUrl, type AssessmentDraft, type AssessmentQuestion } from '@/lib/wellness-assessment';

const STEPS = ['presentation', 'questions', 'results', 'preview'] as const;
export function WellnessAssessmentBuilder({ id, course, track, onSaved }: { id?: string | undefined; course?: string | undefined; track?: string; onSaved?: () => void }) {
  const { t, i18n } = useTranslation(); const lang = i18n.resolvedLanguage === 'es' ? 'es' : 'en';
  const { teamId, userId } = useLearn(); const navigate = useNavigate(); const qc = useQueryClient();
  const [draft, setDraft] = useState<AssessmentDraft>(() => ({ ...emptyAssessment(), language: lang }));
  const [savedId, setSavedId] = useState(id); const [revision, setRevision] = useState(0);
  const [step, setStep] = useState<(typeof STEPS)[number]>('presentation');
  const [placement, setPlacement] = useState<ResourcePlacement>(course ? 'course' : 'team'); const [courseId, setCourseId] = useState(course ?? '');
  const [price, setPrice] = useState({ free: true, price: '' }); const [busy, setBusy] = useState(false); const lock = useRef(false);
  const [answers, setAnswers] = useState<Record<string, string[]>>({}); const baseline = useRef('');
  const offers = useQuery(myOffersQuery(userId));
  const load = useQuery({ queryKey: ['assessment-draft', userId, id], enabled: !!id, queryFn: async () => {
    const { data, error } = await supabase.from('quizzes').select('*').eq('id', id ?? '').maybeSingle();
    if (error) throw error; if (!data?.assessment_config || data.host_id !== userId) throw new Error('not_allowed');
    const cents = data.commerce_offer_id ? (await supabase.from('offers').select('price_cents').eq('id', data.commerce_offer_id).maybeSingle()).data?.price_cents ?? 0 : 0;
    return { data, cents };
  } });
  useEffect(() => {
    if (!load.data) return;
    const { data, cents } = load.data; const d = data.assessment_config as unknown as AssessmentDraft;
    setDraft(d); baseline.current = JSON.stringify(d); setRevision(data.assessment_revision); setSavedId(data.id); setPlacement(savedPlacement(data)); setCourseId(data.offer_id ?? ''); setPrice({ free: !cents, price: cents ? String(cents / 100) : '' });
  }, [load.data]);
  const patch = (p: Partial<AssessmentDraft>) => setDraft(d => ({ ...d, ...p }));
  const editQuestion = (qid: string, p: Partial<AssessmentQuestion>) => setDraft(d => ({ ...d, questions: d.questions.map(q => q.id === qid ? { ...q, ...p } : q) }));
  const save = async () => {
    if (lock.current) return; const cents = resourceAccessPrice(placement, price.free, price.price);
    if (cents === null || (placement === 'course' && !courseId)) { toast.error(t('resources.item.saveFailed')); return; }
    lock.current = true; setBusy(true);
    try {
      const { data, error } = await supabase.rpc('save_wellness_assessment', { _id: savedId ?? null, _team: teamId, _config: draft as never, _placement: placement, _course: courseId || null, _price: cents, _revision: revision } as never);
      if (error) throw error; const result = data as { id: string; revision: number };
      setSavedId(result.id); setRevision(result.revision); baseline.current = JSON.stringify(draft);
      if (track) { const bound = await supabase.rpc('bind_course_assessment', { _quiz: result.id, _track: track }); if (bound.error) throw bound.error; await qc.invalidateQueries({ queryKey: ['curriculum', course] }); }
      await qc.invalidateQueries({ queryKey: ['team-quizzes'] }); toast.success(t('resources.item.draftToast'));
      onSaved?.();
      if (!id && !track) void navigate({ to: '/learn/create', search: { type: 'assessment', id: result.id }, replace: true });
    } catch { toast.error(t('assessment.saveError')); } finally { lock.current = false; setBusy(false); }
  };
  const addQuestion = () => patch({ questions: [...draft.questions, { id: crypto.randomUUID(), type: 'single', prompt: '', scored: true, weight: 1, options: [0, 100].map(value => ({ id: crypto.randomUUID(), label: '', value })) }] });
  const move = (i: number, direction: -1 | 1) => { const ids = reorderedIds(draft.questions, i, direction); patch({ questions: ids.flatMap(qid => { const q = draft.questions.find(q => q.id === qid); return q ? [q] : []; }) }); };
  const remove = async (qid: string) => { if (await confirmAction({ title: t('quiz.confirmDeleteQuestion'), destructive: true })) patch({ questions: draft.questions.filter(q => q.id !== qid) }); };
  const changeLanguage = async (language: 'en' | 'es') => { if (language === draft.language) return; if (draft.questions.length && !(await confirmAction({ title: t('assessment.languageChange') }))) return; patch({ language }); };
  const issues = assessmentIssues(draft); const score = assessmentScore(draft, answers); const result = assessmentResult(draft, score);
  if (id && load.isPending) return <ListSkeleton />;
  if (load.isError) return <RetryState retry={() => void load.refetch()} />;
  return <article className="assessment-builder">
    <Link to="/learn" search={{ tab: 'mine' }} className="back-link"><ArrowLeft />{t('resources.title')}</Link>
    <div className="page-heading"><div><span className="eyebrow">{t('resources.create.types.assessment.name')}</span><h1>{draft[`title_${lang}`] || t('resources.untitled')}</h1></div><span className="chip">{t('templates.draft')}</span></div>
    <div className="scroll-row"><div className="segmented" role="tablist" aria-label={t('resources.item.sections')}>{STEPS.map(s => <Button key={s} role="tab" variant="ghost" aria-selected={step === s} disabled={busy} onClick={() => setStep(s)}>{s === 'preview' && <Eye />}{t(`assessment.steps.${s}`)}</Button>)}</div></div>
    <section className="edit-form assessment-body" aria-label={t(`assessment.steps.${step}`)}>
      {step === 'presentation' && <>
        <label className="field-label" htmlFor="wa-title">{t('templates.title')}</label><Input id="wa-title" value={draft[`title_${lang}`]} maxLength={160} onChange={e => patch({ [`title_${lang}`]: e.target.value })} />
        <label className="field-label" htmlFor="wa-description">{t('templates.description')}</label><Textarea id="wa-description" value={draft[`description_${lang}`]} maxLength={2000} onChange={e => patch({ [`description_${lang}`]: e.target.value })} />
        <label className="field-label" htmlFor="wa-language">{t('assessment.language')}</label><select id="wa-language" className="field-input" value={draft.language} onChange={e => void changeLanguage(e.target.value === 'es' ? 'es' : 'en')}><option value="en">{t('me.english')}</option><option value="es">{t('me.spanish')}</option></select>
        <ResourceAccessFields type="assessment" placement={placement} onPlacement={setPlacement} free={price.free} price={price.price} onAccess={(free, value) => setPrice({ free, price: value })} courseId={courseId} onCourse={setCourseId} courses={(offers.data ?? []).filter(o => o.kind === 'course' && o.status !== 'archived').map(o => ({ id: o.id, title: offerTitle(o, lang) }))} ready={false} prefix="wa" />
        <label className="switch-row"><Switch checked={draft.allow_retake} onCheckedChange={allow_retake => patch({ allow_retake })} /><span>{t('assessment.allowRetake')}</span></label>
      </>}
      {step === 'questions' && <><Button variant="secondary" onClick={addQuestion}><Plus />{t('quiz.addQuestion')}</Button><ol className="assessment-list">{draft.questions.map((q, i) => <li key={q.id} className="edit-form">
        <div className="row-actions"><strong>{i + 1}</strong><Button size="icon" variant="ghost" aria-label={t('templates.moveUp')} disabled={!i} onClick={() => move(i, -1)}><ArrowUp /></Button><Button size="icon" variant="ghost" aria-label={t('templates.moveDown')} disabled={i === draft.questions.length - 1} onClick={() => move(i, 1)}><ArrowDown /></Button><Button size="icon" variant="ghost" aria-label={t('quiz.deleteQuestion')} onClick={() => void remove(q.id)}><Trash2 /></Button></div>
        <label className="field-label" htmlFor={`wa-q-${q.id}`}>{t('quiz.prompt')}</label><Textarea id={`wa-q-${q.id}`} value={q.prompt} maxLength={500} onChange={e => editQuestion(q.id, { prompt: e.target.value })} />
        <select className="field-input" aria-label={t('quiz.questionType')} value={q.type} onChange={e => { const type = e.target.value as AssessmentQuestion['type']; editQuestion(q.id, { type, scored: type === 'text' ? false : q.scored, options: type === 'text' ? [] : q.options.length ? q.options : [0, 100].map(value => ({ id: crypto.randomUUID(), label: '', value })) }); }}>{(['single', 'multi', 'scale', 'text'] as const).map(type => <option key={type} value={type}>{t(`assessment.types.${type}`)}</option>)}</select>
        <label className="switch-row"><Switch checked={q.scored} disabled={q.type === 'text'} onCheckedChange={scored => editQuestion(q.id, { scored })} /><span>{t(q.type === 'text' ? 'assessment.unscoredText' : 'assessment.scored')}</span></label>
        {q.scored && <><label className="field-label" htmlFor={`wa-weight-${q.id}`}>{t('assessment.weight')}</label><Input id={`wa-weight-${q.id}`} type="number" min={0.1} max={100} step={0.1} value={q.weight} onChange={e => editQuestion(q.id, { weight: Number(e.target.value) })} /></>}
        {q.options.map((o, oi) => <div key={o.id} className="assessment-option"><Input aria-label={t('assessment.option', { n: oi + 1 })} maxLength={200} value={o.label} onChange={e => editQuestion(q.id, { options: q.options.map(x => x.id === o.id ? { ...x, label: e.target.value } : x) })} />{q.scored && <Input aria-label={t('assessment.value', { n: oi + 1 })} type="number" min={0} max={100} value={o.value} onChange={e => editQuestion(q.id, { options: q.options.map(x => x.id === o.id ? { ...x, value: Number(e.target.value) } : x) })} />}<Button variant="ghost" size="icon" disabled={q.options.length <= 2} aria-label={t('quiz.removeOption')} onClick={() => editQuestion(q.id, { options: q.options.filter(x => x.id !== o.id) })}><Trash2 /></Button></div>)}
        {q.type !== 'text' && q.options.length < 8 && <Button variant="secondary" onClick={() => editQuestion(q.id, { options: [...q.options, { id: crypto.randomUUID(), label: '', value: 0 }] })}><Plus />{t('quiz.addOption')}</Button>}
      </li>)}</ol></>}
      {step === 'results' && <><p className="field-hint">{t('assessment.rangesHint')}</p><Button variant="secondary" onClick={() => patch({ results: [...draft.results, { id: crypto.randomUUID(), min: draft.results.length ? Math.min(100, (draft.results.at(-1)?.max ?? -1) + 1) : 0, max: 100, title: '', body: '', url: '' }] })}><Plus />{t('quizStudio.addBand')}</Button><ol className="assessment-list">{draft.results.map(r => { const update = (p: Partial<typeof r>) => patch({ results: draft.results.map(x => x.id === r.id ? { ...x, ...p } : x) }); return <li key={r.id} className="edit-form">
        <div className="assessment-option"><Input aria-label={t('assessment.from')} type="number" min={0} max={100} value={r.min} onChange={e => update({ min: Number(e.target.value) })} /><Input aria-label={t('assessment.to')} type="number" min={0} max={100} value={r.max} onChange={e => update({ max: Number(e.target.value) })} /></div>
        <Input aria-label={t('quizStudio.bandTitle')} maxLength={160} value={r.title} onChange={e => update({ title: e.target.value })} /><Textarea aria-label={t('quizStudio.bandBody')} maxLength={2000} value={r.body} onChange={e => update({ body: e.target.value })} />
        <Input type="url" placeholder="https://" aria-label={t('assessment.nextLink')} aria-invalid={!!r.url && !safeExternalUrl(r.url)} value={r.url} onChange={e => update({ url: e.target.value })} /><Button variant="ghost" onClick={() => patch({ results: draft.results.filter(x => x.id !== r.id) })}><Trash2 />{t('quizStudio.removeBand')}</Button>
      </li>; })}</ol></>}
      {step === 'preview' && <><p className="field-hint">{t('assessment.previewOnly')}</p>{draft.questions.map(q => <fieldset key={q.id}><legend>{q.prompt}</legend>{q.type === 'text' ? <Textarea aria-label={t('quizPlay.yourAnswer')} /> : q.options.map(o => <label className="guest-consent" key={o.id}><input type={q.type === 'multi' ? 'checkbox' : 'radio'} name={q.id} checked={answers[q.id]?.includes(o.id) ?? false} onChange={() => setAnswers(a => ({ ...a, [q.id]: q.type === 'multi' ? a[q.id]?.includes(o.id) ? (a[q.id] ?? []).filter(x => x !== o.id) : [...(a[q.id] ?? []), o.id] : [o.id] }))} />{o.label}</label>)}</fieldset>)}<p role="status">{score !== null ? `${score} / 100` : t('assessment.unscored')}</p>{result && <div><h2>{result.title}</h2><p>{result.body}</p>{safeExternalUrl(result.url) && <a href={result.url} target="_blank" rel="noopener noreferrer">{t('assessment.nextLink')} ↗</a>}</div>}{issues.length > 0 && <ul role="status">{issues.map(issue => <li key={issue}>{t(`assessment.issues.${issue}`)}</li>)}</ul>}</>}
      <p className="field-hint" role="status">{t('assessment.approvedRequired')}</p>
      <div className="sheet-actions"><Button variant="secondary" disabled={busy} aria-busy={busy} onClick={() => void save()}><Save />{busy ? t('onboarding.saving') : t('gathering.saveDraft')}</Button><Button disabled title={t('assessment.approvedRequired')}>{t('offers.publish')}</Button></div>
    </section>
  </article>;
}