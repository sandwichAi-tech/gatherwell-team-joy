import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUp, ArrowDown, Check, Pencil, Plus, Trash2, Award, Printer, AlertCircle } from '@/components/icons';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { ResponsiveSheet } from '@/components/responsive-sheet';
import { ListSkeleton, RetryState } from '@/components/launch-states';
import { confirmAction } from '@/components/confirm-dialog';

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return <div className="form-field"><label className="field-label" htmlFor={id}>{label}</label>{children}</div>;
}
import { toast } from 'sonner';
import {
  getQuizForTaker, startQuizAttempt, saveQuizResponse, submitQuiz, myQuizAttempts,
  getCourseProgress, issueCertificate, revokeCertificate, timeLeftMs,
  type Quiz, type QuizQuestion, type QuizOption, type TakerPayload, type Certificate,
} from '@/lib/quizzes';
import type { Offer } from '@/lib/offers';

const quizTitle = (q: Pick<Quiz, 'title_en' | 'title_es'>, lang: string) => (lang === 'es' ? q.title_es || q.title_en : q.title_en || q.title_es);

/* ================= Host: quiz list + editor ================= */

export function QuizPanel({ offer }: { offer: Offer }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? 'en';
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<Quiz> | null>(null);
  const q = useQuery({
    queryKey: ['quizzes', offer.id],
    queryFn: async () => (await supabase.from('quizzes').select('*').eq('offer_id', offer.id).order('sort_order')).data ?? [],
  });
  const lessonsQ = useQuery({
    queryKey: ['quiz-lessons', offer.id],
    queryFn: async () => (await supabase.from('lessons').select('id, title_en, title_es, tracks!inner(offer_id)').eq('tracks.offer_id', offer.id)).data ?? [],
  });
  const lessons = lessonsQ.data ?? [];

/** Learner-facing list of published quizzes for an entitled offer. */
export function LearnerQuizList({ offerId }: { offerId: string }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? 'en';
  const [open, setOpen] = useState<string | null>(null);
  // Learners cannot read the quizzes table (answer-key secrecy); discover published
  // quizzes through the public-offer payload's quiz list.
  const q = useQuery({
    queryKey: ['learner-quizzes', offerId],
    queryFn: async () => (await supabase.rpc('get_public_offer', { _offer: offerId })).data as { quizzes?: { id: string; title_en: string; title_es: string; is_required: boolean }[] } | null,
  });
  const list = q.data?.quizzes ?? [];
  if (!list.length) return null;
  return <section className="panel" aria-label={t('quiz.panel')}>
    <div className="section-heading"><h2>{t('quiz.panel')}</h2></div>
    <ul className="offer-list">{list.map(z => <li key={z.id} className="offer-row">
      <div className="offer-row-main"><strong>{lang === 'es' ? z.title_es || z.title_en : z.title_en || z.title_es}</strong>
        {z.is_required && <small>{t('quiz.required')}</small>}</div>
      <div className="offer-row-actions"><Button variant="secondary" size="sm" onClick={() => setOpen(open === z.id ? null : z.id)}>{t(open === z.id ? 'quiz.close' : 'quiz.open')}</Button></div>
      {open === z.id && <QuizTaker quizId={z.id} />}
    </li>)}</ul>
  </section>;
}
  const lessonName = (id: string | null) => {
    if (!id) return t('quiz.finalQuiz');
    const l = lessons.find(x => x.id === id);
    return l ? (lang === 'es' ? l.title_es || l.title_en : l.title_en || l.title_es) : '';
  };
  return <section className="panel" aria-label={t('quiz.panel')}>
    <div className="section-heading"><div><h2>{t('quiz.panel')}</h2><p className="muted-small">{t('quiz.panelText')}</p></div>
      <Button variant="secondary" size="sm" onClick={() => setEditing({ offer_id: offer.id, lesson_id: null, pass_pct: 80, cooldown_minutes: 0, is_required: false, show_score: true, reveal_answers: 'after_pass', randomize_questions: false, randomize_answers: false, is_published: false, sort_order: (q.data?.length ?? 0) + 1 })}><Plus />{t('quiz.new')}</Button></div>
    {q.isPending ? <ListSkeleton /> : q.isError ? <RetryState retry={() => void q.refetch()} /> : !q.data.length ? <p className="muted-small">{t('quiz.empty')}</p> :
      <ul className="offer-list">{q.data.map(z => <li key={z.id} className="panel offer-row">
        <div className="offer-row-main"><strong>{quizTitle(z, lang) || t('quiz.untitled')}</strong>
          <small>{lessonName(z.lesson_id)} · {t(z.is_published ? 'templates.published' : 'templates.draft')}{z.is_required ? ` · ${t('quiz.required')}` : ''}</small></div>
        <div className="offer-row-actions"><Button variant="secondary" size="icon" aria-label={t('quiz.edit')} onClick={() => setEditing(z)}><Pencil /></Button></div>
      </li>)}</ul>}
    {editing && <QuizEditor quiz={editing} offer={offer} lessons={lessons} onClose={() => { setEditing(null); void qc.invalidateQueries({ queryKey: ['quizzes', offer.id] }); }} />}
  </section>;
}

function QuizEditor({ quiz, offer, lessons, onClose }: { quiz: Partial<Quiz>; offer: Offer; lessons: { id: string; title_en: string | null; title_es: string | null }[]; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [f, setF] = useState({
    title_en: quiz.title_en ?? '', title_es: quiz.title_es ?? '', instructions_en: quiz.instructions_en ?? '', instructions_es: quiz.instructions_es ?? '',
    lesson_id: quiz.lesson_id ?? '', pass_pct: String(quiz.pass_pct ?? 80), attempts_allowed: quiz.attempts_allowed ? String(quiz.attempts_allowed) : '',
    cooldown_minutes: String(quiz.cooldown_minutes ?? 0), time_limit_minutes: quiz.time_limit_minutes ? String(quiz.time_limit_minutes) : '',
    is_required: !!quiz.is_required, show_score: quiz.show_score ?? true, reveal_answers: quiz.reveal_answers ?? 'after_pass',
    randomize_questions: !!quiz.randomize_questions, randomize_answers: !!quiz.randomize_answers,
  });
  const [busy, setBusy] = useState(false);
  const [editQuestion, setEditQuestion] = useState<Partial<QuizQuestion> | null>(null);
  const isNew = !quiz.id;
  const questions = useQuery({
    queryKey: ['quiz-questions', quiz.id], enabled: !!quiz.id,
    queryFn: async () => (await supabase.from('quiz_questions').select('*').eq('quiz_id', quiz.id!).order('sort_order')).data ?? [],
  });
  const blockers = useQuery({
    queryKey: ['quiz-blockers', quiz.id], enabled: !!quiz.id,
    queryFn: async () => (await supabase.rpc('quiz_blockers', { _quiz: quiz.id! })).data as string[] | null,
  });
  const passPct = Number(f.pass_pct);
  const valid = !!(f.title_en.trim() || f.title_es.trim()) && Number.isInteger(passPct) && passPct >= 1 && passPct <= 100;
  const save = async () => {
    setBusy(true);
    const row = {
      title_en: f.title_en.trim(), title_es: f.title_es.trim(), instructions_en: f.instructions_en.trim() || null, instructions_es: f.instructions_es.trim() || null,
      lesson_id: f.lesson_id || null, pass_pct: passPct, attempts_allowed: f.attempts_allowed ? Math.max(1, parseInt(f.attempts_allowed, 10)) : null,
      cooldown_minutes: Math.max(0, parseInt(f.cooldown_minutes, 10) || 0), time_limit_minutes: f.time_limit_minutes ? Math.max(1, parseInt(f.time_limit_minutes, 10)) : null,
      is_required: f.is_required, show_score: f.show_score, reveal_answers: f.reveal_answers,
      randomize_questions: f.randomize_questions, randomize_answers: f.randomize_answers,
    };
    const res = quiz.id
      ? await supabase.from('quizzes').update(row).eq('id', quiz.id)
      : await supabase.from('quizzes').insert({ ...row, offer_id: offer.id, sort_order: quiz.sort_order ?? 0, created_by: offer.host_id });
    setBusy(false);
    if (res.error) { toast.error(t('profile.saveError')); return; }
    toast.success(t('templates.saved'));
    await qc.invalidateQueries({ queryKey: ['quizzes', offer.id] });
    if (isNew) onClose();
  };
  const togglePublish = async () => {
    if (!quiz.id) return;
    const res = await supabase.from('quizzes').update({ is_published: !quiz.is_published }).eq('id', quiz.id);
    if (res.error) { toast.error(t('quiz.notReady')); return; }
    toast.success(t('templates.saved'));
    await qc.invalidateQueries({ queryKey: ['quizzes', offer.id] });
    onClose();
  };
  const remove = async () => {
    if (!quiz.id || !(await confirmAction({ title: t('quiz.confirmDelete'), destructive: true }))) return;
    await supabase.from('quizzes').delete().eq('id', quiz.id);
    await qc.invalidateQueries({ queryKey: ['quizzes', offer.id] });
    onClose();
  };
  const move = async (qq: QuizQuestion, dir: -1 | 1) => {
    const list = questions.data ?? []; const i = list.findIndex(x => x.id === qq.id); const j = i + dir;
    if (j < 0 || j >= list.length) return;
    await Promise.all([supabase.from('quiz_questions').update({ sort_order: list[j]!.sort_order }).eq('id', list[i]!.id), supabase.from('quiz_questions').update({ sort_order: list[i]!.sort_order }).eq('id', list[j]!.id)]);
    await qc.invalidateQueries({ queryKey: ['quiz-questions', quiz.id] });
  };
  return <ResponsiveSheet open onOpenChange={o => !o && onClose()} title={quiz.id ? t('quiz.edit') : t('quiz.new')}>
    <div className="edit-form">
      <div className="bilingual">
        {Field({ id: 'qz-en', label: `${t('templates.title')} · EN`, children: <Input id="qz-en" className="field-input" maxLength={120} value={f.title_en} onChange={e => setF({ ...f, title_en: e.target.value })} /> })}
        {Field({ id: 'qz-es', label: `${t('templates.title')} · ES`, children: <Input id="qz-es" className="field-input" maxLength={120} value={f.title_es} onChange={e => setF({ ...f, title_es: e.target.value })} /> })}
      </div>
      <div className="bilingual">
        {Field({ id: 'qz-ien', label: `${t('quiz.instructions')} · EN`, children: <Textarea id="qz-ien" rows={2} className="field-textarea" maxLength={600} value={f.instructions_en} onChange={e => setF({ ...f, instructions_en: e.target.value })} /> })}
        {Field({ id: 'qz-ies', label: `${t('quiz.instructions')} · ES`, children: <Textarea id="qz-ies" rows={2} className="field-textarea" maxLength={600} value={f.instructions_es} onChange={e => setF({ ...f, instructions_es: e.target.value })} /> })}
      </div>
      <div className="form-field"><span className="field-label">{t('quiz.attachTo')}</span>
        <select className="field-input" value={f.lesson_id} onChange={e => setF({ ...f, lesson_id: e.target.value })}>
          <option value="">{t('quiz.finalQuiz')}</option>
          {lessons.map(l => <option key={l.id} value={l.id}>{l.title_en || l.title_es}</option>)}
        </select></div>
      <div className="bilingual">
        {Field({ id: 'qz-pass', label: t('quiz.passPct'), children: <Input id="qz-pass" type="number" min={1} max={100} className="field-input" value={f.pass_pct} onChange={e => setF({ ...f, pass_pct: e.target.value })} /> })}
        {Field({ id: 'qz-att', label: t('quiz.attemptsAllowed'), children: <Input id="qz-att" type="number" min={1} className="field-input" placeholder={t('quiz.unlimited')} value={f.attempts_allowed} onChange={e => setF({ ...f, attempts_allowed: e.target.value })} /> })}
      </div>
      <div className="bilingual">
        {Field({ id: 'qz-cool', label: t('quiz.cooldown'), children: <Input id="qz-cool" type="number" min={0} className="field-input" value={f.cooldown_minutes} onChange={e => setF({ ...f, cooldown_minutes: e.target.value })} /> })}
        {Field({ id: 'qz-time', label: t('quiz.timeLimit'), children: <Input id="qz-time" type="number" min={1} className="field-input" placeholder={t('quiz.none')} value={f.time_limit_minutes} onChange={e => setF({ ...f, time_limit_minutes: e.target.value })} /> })}
      </div>
      <label className="switch-row"><Switch checked={f.is_required} onCheckedChange={v => setF({ ...f, is_required: v })} /><span><strong>{t('quiz.required')}</strong><small>{t('quiz.requiredText')}</small></span></label>
      <label className="switch-row"><Switch checked={f.show_score} onCheckedChange={v => setF({ ...f, show_score: v })} /><span><strong>{t('quiz.showScore')}</strong><small>{t('quiz.showScoreText')}</small></span></label>
      <div className="form-field"><span className="field-label">{t('quiz.reveal')}</span>
        <select className="field-input" value={f.reveal_answers} onChange={e => setF({ ...f, reveal_answers: e.target.value as Quiz['reveal_answers'] })}>
          <option value="never">{t('quiz.revealNever')}</option>
          <option value="after_pass">{t('quiz.revealAfterPass')}</option>
          <option value="always">{t('quiz.revealAlways')}</option>
        </select></div>
      <label className="switch-row"><Switch checked={f.randomize_questions} onCheckedChange={v => setF({ ...f, randomize_questions: v })} /><span><strong>{t('quiz.randomQ')}</strong></span></label>
      <label className="switch-row"><Switch checked={f.randomize_answers} onCheckedChange={v => setF({ ...f, randomize_answers: v })} /><span><strong>{t('quiz.randomA')}</strong></span></label>
      <Button className="onboarding-continue" disabled={busy || !valid} onClick={save}>{busy ? t('onboarding.saving') : t('profile.save')}</Button>

      {quiz.id && <>
        <div className="section-heading"><h3>{t('quiz.questions')}</h3>
          <Button variant="secondary" size="sm" onClick={() => setEditQuestion({ quiz_id: quiz.id, type: 'single', points: 1, sort_order: (questions.data?.length ?? 0) + 1 })}><Plus />{t('quiz.addQuestion')}</Button></div>
        {questions.isPending ? <ListSkeleton /> : !questions.data?.length ? <p className="muted-small">{t('quiz.noQuestions')}</p> :
          <ol className="order-list">{questions.data.map(qq => <li key={qq.id}>
            <span className="order-title"><strong>{qq.prompt_en || qq.prompt_es || t('quiz.untitledQuestion')}</strong>
              <small>{t(`quiz.type.${qq.type}`)} · {t('quiz.points', { count: qq.points })}</small></span>
            <Button variant="ghost" size="icon" disabled={qq.sort_order <= Math.min(...questions.data!.map(x => x.sort_order))} aria-label={t('templates.moveUp')} onClick={() => void move(qq, -1)}><ArrowUp /></Button>
            <Button variant="ghost" size="icon" aria-label={t('templates.moveDown')} onClick={() => void move(qq, 1)}><ArrowDown /></Button>
            <Button variant="ghost" size="icon" aria-label={t('templates.edit')} onClick={() => setEditQuestion(qq)}><Pencil /></Button>
          </li>)}</ol>}
        {blockers.data && blockers.data.length > 0 && <div className="panel" role="status"><h3>{t('quiz.blockers')}</h3>
          <ul className="offer-includes">{blockers.data.map(b => <li key={b}><AlertCircle />{t(`quiz.blocker.${b}`, { defaultValue: b })}</li>)}</ul></div>}
        <Button variant={quiz.is_published ? 'secondary' : 'default'} onClick={togglePublish}>{t(quiz.is_published ? 'quiz.unpublish' : 'quiz.publish')}</Button>
        <Button variant="ghost" className="danger-link" onClick={remove}><Trash2 />{t('quiz.delete')}</Button>
      </>}
    </div>
    {editQuestion && <QuestionEditor question={editQuestion} onClose={() => { setEditQuestion(null); void qc.invalidateQueries({ queryKey: ['quiz-questions', quiz.id] }); void qc.invalidateQueries({ queryKey: ['quiz-blockers', quiz.id] }); }} />}
  </ResponsiveSheet>;
}

function QuestionEditor({ question, onClose }: { question: Partial<QuizQuestion>; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [f, setF] = useState({
    type: question.type ?? 'single' as QuizQuestion['type'],
    prompt_en: question.prompt_en ?? '', prompt_es: question.prompt_es ?? '',
    points: String(question.points ?? 1),
    accepted: (question.accepted_answers ?? []).join('\n'), allow_manual: !!question.allow_manual,
    explanation_en: question.explanation_en ?? '', explanation_es: question.explanation_es ?? '',
  });
  const [options, setOptions] = useState<{ id?: string; label_en: string; label_es: string; is_correct: boolean }[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!question.id) { setOptions([{ label_en: '', label_es: '', is_correct: true }, { label_en: '', label_es: '', is_correct: false }]); return; }
    void supabase.from('quiz_options').select('*').eq('question_id', question.id).order('sort_order').then(({ data }) => {
      setOptions((data ?? []).map(o => ({ id: o.id, label_en: o.label_en, label_es: o.label_es, is_correct: o.is_correct })));
    });
  }, [question.id]);
  useEffect(() => {
    if (f.type === 'truefalse') setOptions([{ label_en: 'True', label_es: 'Verdadero', is_correct: true }, { label_en: 'False', label_es: 'Falso', is_correct: false }]);
  }, [f.type]);
  const points = Number(f.points);
  const valid = !!(f.prompt_en.trim() || f.prompt_es.trim()) && points > 0
    && (f.type === 'short' ? (f.allow_manual || f.accepted.split('\n').some(x => x.trim())) : options.filter(o => o.label_en.trim() || o.label_es.trim()).length >= 2 && options.some(o => o.is_correct));
  const save = async () => {
    setBusy(true);
    const row = {
      type: f.type, prompt_en: f.prompt_en.trim(), prompt_es: f.prompt_es.trim(), points,
      accepted_answers: f.type === 'short' ? f.accepted.split('\n').map(x => x.trim()).filter(Boolean) : null,
      allow_manual: f.type === 'short' ? f.allow_manual : false,
      explanation_en: f.explanation_en.trim() || null, explanation_es: f.explanation_es.trim() || null,
    };
    let qid = question.id;
    const res = qid
      ? await supabase.from('quiz_questions').update(row).eq('id', qid)
      : await supabase.from('quiz_questions').insert({ ...row, quiz_id: question.quiz_id!, sort_order: question.sort_order ?? 0 }).select('id').single();
    if (res.error) { setBusy(false); toast.error(t('profile.saveError')); return; }
    if (!qid && 'data' in res && res.data) qid = res.data.id;
    if (f.type !== 'short' && qid) {
      await supabase.from('quiz_options').delete().eq('question_id', qid);
      const rows = options.filter(o => o.label_en.trim() || o.label_es.trim()).map((o, i) => ({ question_id: qid!, label_en: o.label_en.trim(), label_es: o.label_es.trim(), is_correct: f.type === 'single' || f.type === 'truefalse' ? o.is_correct && options.findIndex(x => x.is_correct) === options.indexOf(o) : o.is_correct, sort_order: i + 1 }));
      if (rows.length) await supabase.from('quiz_options').insert(rows);
    }
    setBusy(false);
    toast.success(t('templates.saved'));
    await qc.invalidateQueries({ queryKey: ['quiz-questions', question.quiz_id] });
    onClose();
  };
  const remove = async () => {
    if (!question.id || !(await confirmAction({ title: t('quiz.confirmDeleteQuestion'), destructive: true }))) return;
    await supabase.from('quiz_questions').delete().eq('id', question.id);
    await qc.invalidateQueries({ queryKey: ['quiz-questions', question.quiz_id] });
    onClose();
  };
  const setOpt = (i: number, patch: Partial<(typeof options)[number]>) => setOptions(options.map((o, j) => j === i ? { ...o, ...patch } : (f.type === 'single' || f.type === 'truefalse') && patch.is_correct ? { ...o, is_correct: false } : o));
  const moveOpt = (i: number, dir: -1 | 1) => { const j = i + dir; if (j < 0 || j >= options.length) return; const next = [...options]; [next[i], next[j]] = [next[j]!, next[i]!]; setOptions(next); };
  return <ResponsiveSheet open onOpenChange={o => !o && onClose()} title={question.id ? t('quiz.editQuestion') : t('quiz.addQuestion')}>
    <div className="edit-form">
      <div className="form-field"><span className="field-label">{t('quiz.questionType')}</span>
        <select className="field-input" value={f.type} onChange={e => setF({ ...f, type: e.target.value as QuizQuestion['type'] })}>
          {(['single', 'multi', 'truefalse', 'short'] as const).map(tp => <option key={tp} value={tp}>{t(`quiz.type.${tp}`)}</option>)}
        </select></div>
      <div className="bilingual">
        {Field({ id: 'qq-en', label: `${t('quiz.prompt')} · EN`, children: <Textarea id="qq-en" rows={2} className="field-textarea" maxLength={500} value={f.prompt_en} onChange={e => setF({ ...f, prompt_en: e.target.value })} /> })}
        {Field({ id: 'qq-es', label: `${t('quiz.prompt')} · ES`, children: <Textarea id="qq-es" rows={2} className="field-textarea" maxLength={500} value={f.prompt_es} onChange={e => setF({ ...f, prompt_es: e.target.value })} /> })}
      </div>
      {Field({ id: 'qq-pts', label: t('quiz.pointsLabel'), children: <Input id="qq-pts" type="number" min={0.5} step={0.5} className="field-input" value={f.points} onChange={e => setF({ ...f, points: e.target.value })} /> })}
      {f.type !== 'short' ? <div className="form-field"><span className="field-label">{t('quiz.options')}</span>
        <ol className="order-list">{options.map((o, i) => <li key={i}>
          <label className="quiz-option-correct"><input type={f.type === 'multi' ? 'checkbox' : 'radio'} name="correct" checked={o.is_correct} onChange={() => setOpt(i, { is_correct: true })} aria-label={t('quiz.correctAnswer')} /></label>
          <span className="order-title"><Input className="field-input" maxLength={200} placeholder={`${t('quiz.option')} · EN`} value={o.label_en} onChange={e => setOpt(i, { label_en: e.target.value })} />
            <Input className="field-input" maxLength={200} placeholder={`${t('quiz.option')} · ES`} value={o.label_es} onChange={e => setOpt(i, { label_es: e.target.value })} /></span>
          <Button variant="ghost" size="icon" disabled={i === 0} aria-label={t('templates.moveUp')} onClick={() => moveOpt(i, -1)}><ArrowUp /></Button>
          <Button variant="ghost" size="icon" disabled={i === options.length - 1} aria-label={t('templates.moveDown')} onClick={() => moveOpt(i, 1)}><ArrowDown /></Button>
          {options.length > 2 && f.type !== 'truefalse' && <Button variant="ghost" size="icon" aria-label={t('quiz.removeOption')} onClick={() => setOptions(options.filter((_, j) => j !== i))}><Trash2 /></Button>}
        </li>)}</ol>
        {f.type !== 'truefalse' && <Button variant="secondary" size="sm" onClick={() => setOptions([...options, { label_en: '', label_es: '', is_correct: false }])}><Plus />{t('quiz.addOption')}</Button>}
      </div> : <>
        {Field({ id: 'qq-acc', label: t('quiz.acceptedAnswers'), children: <Textarea id="qq-acc" rows={3} className="field-textarea" maxLength={1000} value={f.accepted} onChange={e => setF({ ...f, accepted: e.target.value })} /> })}
        <label className="switch-row"><Switch checked={f.allow_manual} onCheckedChange={v => setF({ ...f, allow_manual: v })} /><span><strong>{t('quiz.manualGrading')}</strong><small>{t('quiz.manualGradingText')}</small></span></label>
      </>}
      <div className="bilingual">
        {Field({ id: 'qq-xen', label: `${t('quiz.explanation')} · EN`, children: <Textarea id="qq-xen" rows={2} className="field-textarea" maxLength={500} value={f.explanation_en} onChange={e => setF({ ...f, explanation_en: e.target.value })} /> })}
        {Field({ id: 'qq-xes', label: `${t('quiz.explanation')} · ES`, children: <Textarea id="qq-xes" rows={2} className="field-textarea" maxLength={500} value={f.explanation_es} onChange={e => setF({ ...f, explanation_es: e.target.value })} /> })}
      </div>
      <Button className="onboarding-continue" disabled={busy || !valid} onClick={save}>{busy ? t('onboarding.saving') : t('profile.save')}</Button>
      {question.id && <Button variant="ghost" className="danger-link" onClick={remove}><Trash2 />{t('quiz.deleteQuestion')}</Button>}
    </div>
  </ResponsiveSheet>;
}

/* ================= Learner: quiz taker ================= */

export function QuizTaker({ quizId, onDone }: { quizId: string; onDone?: () => void }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? 'en';
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['quiz-taker', quizId], queryFn: async () => (await getQuizForTaker(quizId)).data });
  const [attempt, setAttempt] = useState<{ id: string; deadline: string | null } | null>(null);
  const [answers, setAnswers] = useState<Record<string, { selected: string[]; text: string }>>({});
  const [result, setResult] = useState<{ status: string; score_pct: number | null; passed: boolean | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());
  const data: TakerPayload | null | undefined = q.data;

  useEffect(() => {
    if (data?.active_attempt) {
      setAttempt({ id: data.active_attempt.id, deadline: data.active_attempt.deadline });
      const restored: Record<string, { selected: string[]; text: string }> = {};
      for (const [qid, r] of Object.entries(data.active_attempt.responses)) restored[qid] = { selected: r.selected ?? [], text: r.text_answer ?? '' };
      setAnswers(restored);
    }
  }, [data?.active_attempt?.id]);
  useEffect(() => {
    if (!attempt?.deadline) return;
    const iv = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [attempt?.deadline]);

  if (q.isPending) return <ListSkeleton />;
  if (q.isError) return <RetryState retry={() => void q.refetch()} />;
  if (!data || data.error) return <p className="muted-small" role="status">{t(`quiz.error.${data?.error ?? 'not_found'}`, { defaultValue: t('quiz.error.not_found') })}</p>;
  const z = data.quiz;
  const left = timeLeftMs(attempt?.deadline ?? null, nowMs);
  const expired = left !== null && left <= 0;

  const start = async () => {
    setBusy(true);
    const r = await startQuizAttempt(quizId);
    setBusy(false);
    if (r.error || !r.data) { toast.error(t(`quiz.error.${r.error?.message ?? 'not_found'}`, { defaultValue: t('quiz.error.not_found') })); return; }
    setAttempt({ id: r.data.attempt_id, deadline: r.data.deadline });
  };
  const record = (questionId: string, selected: string[] | null, text: string | null) => {
    if (!attempt) return;
    setAnswers(a => ({ ...a, [questionId]: { selected: selected ?? a[questionId]?.selected ?? [], text: text ?? a[questionId]?.text ?? '' } }));
    void saveQuizResponse(attempt.id, questionId, selected, text);
  };
  const submit = async () => {
    if (!attempt || busy) return;
    setBusy(true);
    const r = await submitQuiz(attempt.id);
    setBusy(false);
    if (r.error || !r.data) { toast.error(t('quiz.error.submit')); return; }
    setResult(r.data);
    await qc.invalidateQueries({ queryKey: ['quiz-taker', quizId] });
    await qc.invalidateQueries({ queryKey: ['course-progress'] });
    onDone?.();
  };

  if (result) return <section className="panel quiz-result" role="status">
    <h3>{result.status === 'awaiting_manual' ? t('quiz.awaitingManual') : result.passed ? t('quiz.passed') : t('quiz.failed')}</h3>
    {z.show_score && result.score_pct !== null && <p className="offer-price">{t('quiz.score', { score: result.score_pct, pass: z.pass_pct })}</p>}
    {!z.show_score && <p className="muted-small">{t('quiz.scoreHidden')}</p>}
    <AttemptHistory quizId={quizId} showScore={z.show_score} />
    {!result.passed && data.can_start && <Button onClick={() => { setResult(null); setAttempt(null); void start(); }}>{t('quiz.retry')}</Button>}
    {!result.passed && !data.can_start && <p className="muted-small">{data.cooldown_until ? t('quiz.cooldownWait') : t('quiz.noAttemptsLeft')}</p>}
  </section>;

  if (!attempt) return <section className="panel">
    <h3>{lang === 'es' ? z.title_es || z.title_en : z.title_en || z.title_es}</h3>
    {(lang === 'es' ? z.instructions_es || z.instructions_en : z.instructions_en || z.instructions_es) && <p className="muted-small">{lang === 'es' ? z.instructions_es || z.instructions_en : z.instructions_en || z.instructions_es}</p>}
    <p className="muted-small">{t('quiz.meta', { count: data.questions.length, pass: z.pass_pct })}{z.time_limit_minutes ? ` · ${t('quiz.timeLimitMin', { count: z.time_limit_minutes })}` : ''}{z.attempts_allowed ? ` · ${t('quiz.attemptsLeft', { left: Math.max(0, z.attempts_allowed - data.attempts_used), count: z.attempts_allowed })}` : ''}</p>
    <AttemptHistory quizId={quizId} showScore={z.show_score} />
    {data.can_start ? <Button className="onboarding-continue" disabled={busy} onClick={start}>{t(data.attempts_used > 0 ? 'quiz.retry' : 'quiz.start')}</Button>
      : <p className="muted-small" role="status">{data.cooldown_until ? t('quiz.cooldownWait') : t('quiz.noAttemptsLeft')}</p>}
  </section>;

  return <section className="panel quiz-taker">
    <h3>{lang === 'es' ? z.title_es || z.title_en : z.title_en || z.title_es}</h3>
    {left !== null && <p className={`quiz-timer ${left < 60_000 ? 'is-low' : ''}`} role="timer">{t('quiz.timeLeft', { time: `${Math.floor(left / 60000)}:${String(Math.floor((left % 60000) / 1000)).padStart(2, '0')}` })}</p>}
    <ol className="quiz-questions">{data.questions.map((qq, i) => {
      const a = answers[qq.id] ?? { selected: [], text: '' };
      const prompt = lang === 'es' ? qq.prompt_es || qq.prompt_en : qq.prompt_en || qq.prompt_es;
      return <li key={qq.id} className="quiz-question">
        <fieldset>
          <legend>{i + 1}. {prompt} <span className="muted-small">({t('quiz.points', { count: qq.points })})</span></legend>
          {qq.type === 'short' ? <Input className="field-input" maxLength={2000} value={a.text} disabled={expired} onChange={e => record(qq.id, null, e.target.value)} aria-label={prompt} />
            : (qq.options ?? []).map(o => {
              const label = lang === 'es' ? o.label_es || o.label_en : o.label_en || o.label_es;
              const checked = a.selected.includes(o.id);
              return <label key={o.id} className="quiz-option">
                <input type={qq.type === 'multi' ? 'checkbox' : 'radio'} name={`q-${qq.id}`} checked={checked} disabled={expired}
                  onChange={() => {
                    const next = qq.type === 'multi' ? (checked ? a.selected.filter(x => x !== o.id) : [...a.selected, o.id]) : [o.id];
                    record(qq.id, next, null);
                  }} />
                <span>{label}</span></label>;
            })}
        </fieldset>
      </li>;
    })}</ol>
    {expired ? <p className="field-error" role="alert">{t('quiz.timeExpired')}</p> :
      <Button className="onboarding-continue" disabled={busy} onClick={submit}>{busy ? t('onboarding.saving') : t('quiz.submit')}</Button>}
  </section>;
}

function AttemptHistory({ quizId, showScore }: { quizId: string; showScore: boolean }) {
  const { t } = useTranslation();
  const q = useQuery({ queryKey: ['quiz-attempts', quizId], queryFn: () => myQuizAttempts(quizId) });
  if (!q.data?.length) return null;
  return <details className="quiz-history"><summary>{t('quiz.history', { count: q.data.length })}</summary>
    <ul>{q.data.map(a => <li key={a.id}>{t('quiz.attemptN', { n: a.attempt_no })} — {a.status === 'awaiting_manual' ? t('quiz.awaitingManual') : showScore && a.score_pct !== null ? `${a.score_pct}% · ${t(a.passed ? 'quiz.passed' : 'quiz.failed')}` : t(`quiz.status.${a.status}`)}</li>)}</ul>
  </details>;
}

/* ================= Progress + certificates ================= */

export function CourseProgressPanel({ offerId, isHost }: { offerId: string; isHost: boolean }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['course-progress', offerId], queryFn: () => getCourseProgress(offerId) });
  const [busy, setBusy] = useState(false);
  if (!q.data || q.data.error) return null;
  const p = q.data;
  const getCert = async () => {
    setBusy(true);
    const r = await issueCertificate(offerId);
    setBusy(false);
    if (r.error || !r.data) { toast.error(t('cert.notReady')); return; }
    toast.success(t('cert.issued'));
    await qc.invalidateQueries({ queryKey: ['my-certificates'] });
  };
  return <section className="panel" aria-label={t('progress.title')}>
    <div className="section-heading"><h2>{t('progress.title')}</h2><span className="chip">{p.percent}%</span></div>
    <div className="progress-track" role="progressbar" aria-valuenow={p.percent} aria-valuemin={0} aria-valuemax={100} aria-label={t('progress.title')}>
      <div className="progress-fill" style={{ width: `${p.percent}%` }} /></div>
    <p className="muted-small">{t('progress.summary', { done: p.lessons_done, lessons: p.lessons, qdone: p.quizzes_passed, quizzes: p.quizzes_required })}</p>
    {p.complete && <p className="muted-small" role="status"><Check className="inline-icon" />{t('progress.complete')}</p>}
    {p.complete && !isHost && <Button variant="secondary" disabled={busy} onClick={getCert}><Award />{t('cert.get')}</Button>}
  </section>;
}

export function CertificateList({ userId }: { userId: string | undefined }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? 'en';
  const q = useQuery({
    queryKey: ['my-certificates', userId], enabled: !!userId,
    queryFn: async () => (await supabase.from('certificates').select('*').eq('user_id', userId!).order('issued_at', { ascending: false })).data ?? [],
  });
  if (!q.data?.length) return null;
  return <section className="panel" aria-label={t('cert.mine')}>
    <div className="section-heading"><h2>{t('cert.mine')}</h2></div>
    <ul className="offer-list">{q.data.map(c => <li key={c.id} className="panel offer-row">
      <div className="offer-row-main"><strong>{c.course_title}</strong>
        <small>{c.cert_number} · {new Date(c.issued_at).toLocaleDateString(lang === 'es' ? 'es' : 'en')}{c.revoked_at ? ` · ${t('cert.revoked')}` : ''}</small></div>
      <div className="offer-row-actions"><Button variant="secondary" size="sm" onClick={() => window.print()}><Printer />{t('cert.print')}</Button></div>
      <CertificateCard cert={c} />
    </li>)}</ul>
  </section>;
}

export function CertificateCard({ cert }: { cert: Certificate }) {
  const { t } = useTranslation();
  const verifyUrl = `${window.location.origin}/verify/${cert.cert_number}`;
  return <div className={`certificate-card ${cert.revoked_at ? 'is-revoked' : ''}`}>
    <p className="cert-eyebrow">{cert.statement}</p>
    <h3 className="cert-name">{cert.learner_name}</h3>
    <p className="cert-course">{cert.course_title}</p>
    <p className="cert-issuer">{cert.issuer_name}</p>
    {cert.signer_name && <p className="cert-signer">{cert.signer_name}{cert.signer_title ? `, ${cert.signer_title}` : ''}</p>}
    <p className="cert-meta">{t('cert.number', { number: cert.cert_number })} · {new Date(cert.issued_at).toLocaleDateString()}{cert.expires_at ? ` · ${t('cert.expires', { date: new Date(cert.expires_at).toLocaleDateString() })}` : ''}</p>
    <p className="cert-verify">{t('cert.verifyAt', { url: verifyUrl })}</p>
    {cert.revoked_at && <p className="field-error" role="alert">{t('cert.revoked')}{cert.revoke_reason ? `: ${cert.revoke_reason}` : ''}</p>}
  </div>;
}

/* ================= Host: certificate settings + manual grading ================= */

export function CertificateSettings({ offer }: { offer: Offer }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const o = offer as Offer & { certificate_enabled?: boolean; cert_title?: string | null; cert_issuer?: string | null; cert_signer_name?: string | null; cert_signer_title?: string | null; cert_statement?: string | null; cert_expiry_months?: number | null; completion_require_lessons?: boolean; completion_require_quizzes?: boolean };
  const [f, setF] = useState({
    enabled: !!o.certificate_enabled, title: o.cert_title ?? '', issuer: o.cert_issuer ?? '', signer_name: o.cert_signer_name ?? '', signer_title: o.cert_signer_title ?? '',
    statement: o.cert_statement ?? '', expiry: o.cert_expiry_months ? String(o.cert_expiry_months) : '',
    req_lessons: o.completion_require_lessons ?? true, req_quizzes: o.completion_require_quizzes ?? true,
  });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const res = await supabase.from('offers').update({
      certificate_enabled: f.enabled, cert_title: f.title.trim() || null, cert_issuer: f.issuer.trim() || null,
      cert_signer_name: f.signer_name.trim() || null, cert_signer_title: f.signer_title.trim() || null,
      cert_statement: f.statement.trim() || null, cert_expiry_months: f.expiry ? Math.max(1, parseInt(f.expiry, 10)) : null,
      completion_require_lessons: f.req_lessons, completion_require_quizzes: f.req_quizzes,
    }).eq('id', offer.id);
    setBusy(false);
    if (res.error) { toast.error(t('profile.saveError')); return; }
    toast.success(t('templates.saved'));
    await qc.invalidateQueries({ queryKey: ['offers'] });
  };
  return <section className="panel" aria-label={t('cert.settings')}>
    <div className="section-heading"><div><h2>{t('cert.settings')}</h2><p className="muted-small">{t('cert.settingsText')}</p></div></div>
    <div className="edit-form">
      <label className="switch-row"><Switch checked={f.req_lessons} onCheckedChange={v => setF({ ...f, req_lessons: v })} /><span><strong>{t('cert.reqLessons')}</strong></span></label>
      <label className="switch-row"><Switch checked={f.req_quizzes} onCheckedChange={v => setF({ ...f, req_quizzes: v })} /><span><strong>{t('cert.reqQuizzes')}</strong></span></label>
      <label className="switch-row"><Switch checked={f.enabled} onCheckedChange={v => setF({ ...f, enabled: v })} /><span><strong>{t('cert.enable')}</strong><small>{t('cert.enableText')}</small></span></label>
      {f.enabled && <>
        {Field({ id: 'ct-title', label: t('cert.titleLabel'), children: <Input id="ct-title" className="field-input" maxLength={120} value={f.title} onChange={e => setF({ ...f, title: e.target.value })} /> })}
        {Field({ id: 'ct-issuer', label: t('cert.issuer'), children: <Input id="ct-issuer" className="field-input" maxLength={120} value={f.issuer} onChange={e => setF({ ...f, issuer: e.target.value })} /> })}
        <div className="bilingual">
          {Field({ id: 'ct-sn', label: t('cert.signerName'), children: <Input id="ct-sn" className="field-input" maxLength={120} value={f.signer_name} onChange={e => setF({ ...f, signer_name: e.target.value })} /> })}
          {Field({ id: 'ct-st', label: t('cert.signerTitle'), children: <Input id="ct-st" className="field-input" maxLength={120} value={f.signer_title} onChange={e => setF({ ...f, signer_title: e.target.value })} /> })}
        </div>
        {Field({ id: 'ct-stmt', label: t('cert.statement'), children: <Textarea id="ct-stmt" rows={2} className="field-textarea" maxLength={300} value={f.statement} onChange={e => setF({ ...f, statement: e.target.value })} /> })}
        {Field({ id: 'ct-exp', label: t('cert.expiryMonths'), children: <Input id="ct-exp" type="number" min={1} className="field-input" placeholder={t('quiz.none')} value={f.expiry} onChange={e => setF({ ...f, expiry: e.target.value })} /> })}
      </>}
      <Button className="onboarding-continue" disabled={busy} onClick={save}>{busy ? t('onboarding.saving') : t('profile.save')}</Button>
    </div>
    <HostCertificates offerId={offer.id} />
    <ManualGradingQueue offerId={offer.id} />
  </section>;
}

function HostCertificates({ offerId }: { offerId: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['host-certificates', offerId],
    queryFn: async () => (await supabase.from('certificates').select('*').eq('offer_id', offerId).order('issued_at', { ascending: false })).data ?? [],
  });
  const revoke = async (c: Certificate) => {
    const reason = window.prompt(t('cert.revokeReason'));
    if (reason === null) return;
    const { error } = await revokeCertificate(c.id, reason);
    if (error) { toast.error(t('profile.saveError')); return; }
    toast.success(t('templates.saved'));
    await qc.invalidateQueries({ queryKey: ['host-certificates', offerId] });
  };
  if (!q.data?.length) return null;
  return <div className="form-field"><span className="field-label">{t('cert.issuedList')}</span>
    <ul className="offer-list">{q.data.map(c => <li key={c.id} className="offer-row">
      <div className="offer-row-main"><strong>{c.learner_name}</strong><small>{c.cert_number}{c.revoked_at ? ` · ${t('cert.revoked')}` : ''}</small></div>
      {!c.revoked_at && <Button variant="ghost" size="sm" className="danger-link" onClick={() => void revoke(c)}>{t('cert.revoke')}</Button>}
    </li>)}</ul></div>;
}

function ManualGradingQueue({ offerId }: { offerId: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['grading-queue', offerId],
    queryFn: async () => {
      const { data } = await supabase.from('quiz_responses').select('id, text_answer, points_awarded, question_id, attempt_id, quiz_attempts!inner(quiz_id, quizzes!inner(offer_id))').eq('needs_manual', true).eq('quiz_attempts.quizzes.offer_id', offerId);
      return data ?? [];
    },
  });
  const [points, setPoints] = useState<Record<string, string>>({});
  const grade = async (responseId: string) => {
    const p = Number(points[responseId]);
    if (!Number.isFinite(p) || p < 0) { toast.error(t('quiz.invalidPoints')); return; }
    const { error } = await supabase.rpc('grade_quiz_response', { _response: responseId, _points: p });
    if (error) { toast.error(t('profile.saveError')); return; }
    toast.success(t('templates.saved'));
    await qc.invalidateQueries({ queryKey: ['grading-queue', offerId] });
  };
  if (!q.data?.length) return null;
  return <div className="form-field"><span className="field-label">{t('quiz.gradingQueue')}</span>
    <ul className="offer-list">{q.data.map(r => <li key={r.id} className="offer-row">
      <div className="offer-row-main"><strong>{r.text_answer || '—'}</strong></div>
      <div className="offer-row-actions">
        <Input className="field-input grading-points" type="number" min={0} step={0.5} value={points[r.id] ?? ''} onChange={e => setPoints({ ...points, [r.id]: e.target.value })} aria-label={t('quiz.pointsLabel')} />
        <Button variant="secondary" size="sm" onClick={() => void grade(r.id)}>{t('quiz.grade')}</Button>
      </div>
    </li>)}</ul></div>;
}

/* ================= Host: per-learner progress ================= */

export function LearnerProgressPanel({ offerId }: { offerId: string }) {
  const { t } = useTranslation();
  const q = useQuery({
    queryKey: ['learner-progress', offerId],
    queryFn: async () => (await supabase.rpc('offer_learner_progress', { _offer: offerId })).data as { user_id: string; name: string | null; lessons_done: number; percent: number; last_activity: string | null }[] | null,
  });
  if (!q.data?.length) return null;
  return <section className="panel" aria-label={t('progress.learners')}>
    <div className="section-heading"><h2>{t('progress.learners')}</h2></div>
    <ul className="offer-list">{q.data.map(l => <li key={l.user_id} className="offer-row">
      <div className="offer-row-main"><strong>{l.name || t('progress.unnamed')}</strong>
        <small>{l.percent}%{l.last_activity ? ` · ${new Date(l.last_activity).toLocaleDateString()}` : ''}</small></div>
    </li>)}</ul>
  </section>;
}
