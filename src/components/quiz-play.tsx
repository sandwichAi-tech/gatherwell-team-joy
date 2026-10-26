import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Check, ClipboardCheck, Lock, Sparkles, Trophy } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ListSkeleton, RetryState } from '@/components/launch-states';
import { confirmAction } from '@/components/confirm-dialog';
import { supabase } from '@/integrations/supabase/client';
import { quizImageUrls } from '@/lib/quiz-media.functions';
import { bandFor, mustAnswerAll, outcomeFor, pollPercents, retakeState, unanswered, type QuizMode } from '@/lib/quiz-studio';

const db = supabase as unknown as { rpc: (f: string, a?: Record<string, unknown>) => Promise<{ data: any; error: { message?: string } | null }> };
const pick = (lang: string, en?: string | null, es?: string | null) => (lang === 'es' ? es || en : en || es) ?? '';

export type PlayOption = { id: string; label_en: string; label_es: string; image_path: string | null; image_alt: string | null };
export type PlayQuestion = { id: string; type: 'single' | 'multi' | 'truefalse' | 'short'; prompt_en: string; prompt_es: string; image_path: string | null; image_alt: string | null; options: PlayOption[] | null };
type Answer = { selected: string[] | null; text_answer: string | null };
type Payload = {
  error?: string;
  quiz: { id: string; mode: QuizMode; title_en: string; title_es: string; instructions_en: string | null; instructions_es: string | null; attempts_allowed: number | null; cooldown_minutes: number; show_score: boolean; pass_pct: number; is_editor: boolean };
  questions: PlayQuestion[]; attempts_used: number; last_attempt_id: string | null; cooldown_until: string | null; can_start: boolean;
  active_attempt: { id: string; attempt_no: number; responses: Record<string, Answer> } | null;
};
export type QuizResult = {
  error?: string; mode: QuizMode; attempt_no: number; status: string; score_pct: number | null; passed: boolean | null; pass_pct: number;
  attempts_used: number; attempts_allowed: number | null;
  band: { title_en: string; title_es: string; body_en: string | null; body_es: string | null } | null;
  outcome: { title_en: string; title_es: string; body_en: string | null; body_es: string | null; image_path: string | null; image_alt: string | null } | null;
  respondents: number | null;
  poll: { question_id: string; prompt_en: string; prompt_es: string; answered: number; options: { id: string; label_en: string; label_es: string; count: number }[] }[] | null;
};

/** Image from a signed-URL map; missing signatures render nothing rather than a broken image. */
function QImg({ path, alt, urls, className }: { path: string | null; alt: string | null; urls: Record<string, string>; className: string }) {
  const src = path ? urls[path] : null;
  return src ? <img src={src} alt={alt ?? ''} className={className} loading="lazy" decoding="async" /> : null;
}

/** One question at a time with large choice targets, Back/Next and a progress bar. Shared by player and coach preview. */
export function QuestionStep({ q, index, total, answer, onAnswer, urls, lang }: { q: PlayQuestion; index: number; total: number; answer: Answer | undefined; onAnswer: (a: Answer) => void; urls: Record<string, string>; lang: string }) {
  const { t } = useTranslation();
  const sel = answer?.selected ?? [];
  const multi = q.type === 'multi';
  const toggle = (id: string) => onAnswer({ selected: multi ? (sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id]) : [id], text_answer: null });
  const imageChoices = (q.options ?? []).some(o => o.image_path);
  return <fieldset className="quiz-step">
    <div className="quiz-progress" aria-hidden="true"><span style={{ width: `${Math.round(((index + 1) / total) * 100)}%` }} /></div>
    <p className="eyebrow">{t('quizPlay.progress', { n: index + 1, total })}</p>
    <legend className="quiz-prompt">{pick(lang, q.prompt_en, q.prompt_es)}</legend>
    <QImg path={q.image_path} alt={q.image_alt} urls={urls} className="quiz-question-image" />
    {multi && <p className="field-hint">{t('quizPlay.pickAll')}</p>}
    {q.type === 'short'
      ? <Input className="field-input" aria-label={t('quizPlay.yourAnswer')} maxLength={500} value={answer?.text_answer ?? ''} onChange={e => onAnswer({ selected: null, text_answer: e.target.value })} />
      : <div className={`quiz-choices ${imageChoices ? 'has-images' : ''}`} role={multi ? 'group' : 'radiogroup'}>
        {(q.options ?? []).map(o => { const on = sel.includes(o.id);
          return <button key={o.id} type="button" role={multi ? 'checkbox' : 'radio'} aria-checked={on} className={`quiz-choice ${on ? 'is-selected' : ''}`} onClick={() => toggle(o.id)}>
            <QImg path={o.image_path} alt={o.image_alt} urls={urls} className="quiz-choice-image" />
            <span className="quiz-choice-label">{pick(lang, o.label_en, o.label_es) || o.image_alt}</span>
            <span className="quiz-choice-mark" aria-hidden="true">{on && <Check />}</span>
          </button>; })}
      </div>}
  </fieldset>;
}

export function PollBars({ poll, lang }: { poll: NonNullable<QuizResult['poll']>; lang: string }) {
  const { t } = useTranslation();
  return <div className="quiz-poll">{poll.map(p => { const pct = pollPercents(p.options.map(o => o.count), p.answered);
    return <section key={p.question_id} className="quiz-poll-q"><h3>{pick(lang, p.prompt_en, p.prompt_es)}</h3>
      <ul>{p.options.map((o, i) => <li key={o.id}><span className="quiz-poll-label">{pick(lang, o.label_en, o.label_es)}</span>
        <span className="quiz-poll-bar" aria-hidden="true"><span style={{ width: `${pct[i]}%` }} /></span><strong>{t('quizPlay.pct', { pct: pct[i] })}</strong></li>)}</ul>
      <small className="muted">{t('quizPlay.answeredCount', { count: p.answered })}</small></section>; })}</div>;
}

export function ResultCard({ r, urls, lang }: { r: Pick<QuizResult, 'mode' | 'score_pct' | 'passed' | 'pass_pct' | 'band' | 'outcome' | 'poll' | 'respondents' | 'status'>; urls: Record<string, string>; lang: string }) {
  const { t } = useTranslation();
  if (r.mode === 'outcome' && r.outcome) return <div className="quiz-result" role="status"><Sparkles /><p className="eyebrow">{t('quizPlay.yourResult')}</p>
    <h2>{pick(lang, r.outcome.title_en, r.outcome.title_es)}</h2><QImg path={r.outcome.image_path} alt={r.outcome.image_alt} urls={urls} className="quiz-outcome-image" />
    {pick(lang, r.outcome.body_en, r.outcome.body_es) && <p>{pick(lang, r.outcome.body_en, r.outcome.body_es)}</p>}</div>;
  if (r.mode === 'poll') return <div className="quiz-result" role="status"><ClipboardCheck /><h2>{t('quizPlay.pollThanks')}</h2>
    {r.poll ? <PollBars poll={r.poll} lang={lang} /> : <p className="muted">{t('quizPlay.pollHidden', { count: 3 })}</p>}</div>;
  if (r.status === 'awaiting_manual') return <div className="quiz-result" role="status"><ClipboardCheck /><h2>{t('quizPlay.awaitingReview')}</h2></div>;
  return <div className="quiz-result" role="status"><Trophy /><p className="eyebrow">{t('quizPlay.yourScore')}</p>
    {r.score_pct !== null ? <h2>{t('quizPlay.pct', { pct: Math.round(Number(r.score_pct)) })}</h2> : <h2>{t('quizPlay.submitted')}</h2>}
    {r.passed !== null && <p className={r.passed ? 'success-text' : 'muted'}>{t(r.passed ? 'quizPlay.passed' : 'quizPlay.notPassed', { pct: r.pass_pct })}</p>}
    {r.band && <div className="quiz-band"><strong>{pick(lang, r.band.title_en, r.band.title_es)}</strong>{pick(lang, r.band.body_en, r.band.body_es) && <p>{pick(lang, r.band.body_en, r.band.body_es)}</p>}</div>}</div>;
}

/** Participant flow: intro, one question at a time (saved as you go), confirm, result, retake per policy. */
export function QuizPlay({ quizId }: { quizId: string }) {
  const { t, i18n } = useTranslation(); const lang = i18n.resolvedLanguage ?? 'en';
  const qc = useQueryClient();
  const sign = useServerFn(quizImageUrls);
  const q = useQuery({ queryKey: ['quiz-play', quizId], queryFn: async () => { const { data, error } = await db.rpc('get_quiz_for_taker', { _quiz: quizId }); if (error) throw error; return data as Payload; } });
  const urls = useQuery({ queryKey: ['quiz-images', quizId], enabled: !!q.data && !q.data.error, staleTime: 50 * 60 * 1000, queryFn: () => sign({ data: { quizId } }) });
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [step, setStep] = useState(0);
  const [resultId, setResultId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false); const submitting = useRef(false);
  useEffect(() => {
    const d = q.data; if (!d || d.error) return;
    if (d.active_attempt) { setAttemptId(d.active_attempt.id); setAnswers(d.active_attempt.responses ?? {}); setResultId(null); }
    else if (d.last_attempt_id && !attemptId) setResultId(d.last_attempt_id);
  }, [q.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const result = useQuery({ queryKey: ['quiz-result', resultId], enabled: !!resultId, queryFn: async () => (await db.rpc('quiz_result', { _attempt: resultId })).data as QuizResult });

  if (q.isPending) return <ListSkeleton rows={2} />;
  if (q.isError) return <RetryState retry={() => void q.refetch()} />;
  const d = q.data;
  if (d.error) return <section className="panel empty-state" role="status"><Lock /><p>{t(`quizPlay.errors.${d.error}`, { defaultValue: t('quizPlay.errors.not_found') })}</p></section>;
  const questions = d.questions; const total = questions.length; const map = urls.data ?? {};
  const title = pick(lang, d.quiz.title_en, d.quiz.title_es);
  const retake = retakeState(d.quiz.attempts_allowed, d.attempts_used);

  const start = async () => {
    if (busy) return; setBusy(true);
    const { data, error } = await db.rpc('start_quiz_attempt', { _quiz: quizId }); setBusy(false);
    if (error) { toast.error(t(`quizPlay.errors.${(error.message ?? '').includes('cooldown') ? 'cooldown' : (error.message ?? '').includes('attempts_exhausted') ? 'attempts_exhausted' : 'generic'}`)); return; }
    setAttemptId(data.attempt_id); setResultId(null); setStep(0); if (!data.resumed) setAnswers({});
  };
  const answer = async (qid: string, a: Answer) => {
    setAnswers(prev => ({ ...prev, [qid]: a }));
    if (!attemptId) return;
    const { error } = await db.rpc('save_quiz_response', { _attempt: attemptId, _question: qid, _selected: a.selected, _text: a.text_answer });
    if (error) toast.error(t('quizPlay.errors.saveFailed'));
  };
  const submit = async () => {
    if (submitting.current || !attemptId) return;
    const missing = unanswered(questions.map(x => x.id), answers);
    if (missing.length && mustAnswerAll(d.quiz.mode)) { toast.error(t('quizPlay.answerAll')); setStep(questions.findIndex(x => x.id === missing[0])); return; }
    if (!(await confirmAction({ title: t('quizPlay.confirmTitle'), body: missing.length ? t('quizPlay.confirmBlank', { count: missing.length }) : t('quizPlay.confirmBody'), confirmLabel: t('quizPlay.submit') }))) return;
    submitting.current = true; setBusy(true);
    const { data, error } = await db.rpc('submit_quiz', { _attempt: attemptId });
    submitting.current = false; setBusy(false);
    if (error) { toast.error(t(error.message?.includes('incomplete') ? 'quizPlay.answerAll' : 'quizPlay.errors.generic')); return; }
    toast.success(t('quizPlay.saved'));
    setAttemptId(null); setResultId(data.attempt_id);
    void qc.invalidateQueries({ queryKey: ['quiz-play', quizId] });
  };

  if (resultId && !attemptId) return <section className="panel quiz-player" aria-label={title}>
    <h1 className="manage-title">{title}</h1>
    {result.isPending ? <ListSkeleton rows={1} /> : result.data && !result.data.error ? <ResultCard r={result.data} urls={map} lang={lang} /> : <RetryState retry={() => void result.refetch()} />}
    <p className="muted-small">{t(`quizPlay.retake.${retake.key}`, { count: retake.left })}</p>
    {d.can_start && <Button variant="secondary" disabled={busy} onClick={start}>{t('quizPlay.retakeButton')}</Button>}
    {!d.can_start && d.cooldown_until && retake.key !== 'none' && <p className="muted-small">{t('quizPlay.cooldownUntil', { time: new Date(d.cooldown_until).toLocaleTimeString(lang, { hour: 'numeric', minute: '2-digit' }) })}</p>}
  </section>;

  if (!attemptId) return <section className="panel quiz-player" aria-label={title}>
    <span className="chip"><ClipboardCheck aria-hidden="true" />{t(`quizStudio.mode.${d.quiz.mode}`)}</span>
    <h1 className="manage-title">{title}</h1>
    {pick(lang, d.quiz.instructions_en, d.quiz.instructions_es) && <p>{pick(lang, d.quiz.instructions_en, d.quiz.instructions_es)}</p>}
    <p className="muted-small">{t('quizPlay.questionsCount', { count: total })} · {t(`quizPlay.retake.${retake.key}`, { count: retake.left })}</p>
    {d.quiz.mode === 'poll' && <p className="muted-small">{t('quizPlay.pollPrivacy')}</p>}
    {total === 0 ? <p className="muted">{t('quizPlay.noQuestions')}</p> : d.can_start
      ? <Button className="onboarding-continue" disabled={busy} onClick={start}>{t('quizPlay.start')}<ArrowRight /></Button>
      : <p className="muted">{t(retake.key === 'none' ? 'quizPlay.errors.attempts_exhausted' : 'quizPlay.errors.cooldown')}</p>}
  </section>;

  const cur = questions[Math.min(step, total - 1)]!;
  const last = step >= total - 1;
  const curAnswered = !unanswered([cur.id], answers).length;
  return <section className="panel quiz-player" aria-label={title}>
    <h1 className="manage-title">{title}</h1>
    <QuestionStep q={cur} index={step} total={total} answer={answers[cur.id]} onAnswer={a => void answer(cur.id, a)} urls={map} lang={lang} />
    <div className="quiz-nav">
      <Button variant="ghost" disabled={step === 0} onClick={() => setStep(s => s - 1)}><ArrowLeft />{t('common.back')}</Button>
      {last ? <Button disabled={busy} onClick={submit}>{busy ? t('onboarding.saving') : t('quizPlay.submit')}</Button>
        : <Button disabled={mustAnswerAll(d.quiz.mode) && !curAnswered} onClick={() => setStep(s => s + 1)}>{t('quizPlay.next')}<ArrowRight /></Button>}
    </div>
    <p className="muted-small" aria-live="polite">{t('quizPlay.autosaved')}</p>
  </section>;
}

/** Coach preview of the current draft: same screens, nothing saved; result computed with the same rules. */
export function QuizPreview({ mode, title, questions, outcomes, bands, keys, outcomeOf, urls, passPct }: {
  mode: QuizMode; title: string; questions: PlayQuestion[]; passPct: number;
  outcomes: { id: string; title_en: string; title_es: string; body_en: string | null; body_es: string | null; image_path: string | null; image_alt: string | null }[];
  bands: { min_pct: number; title_en: string; title_es: string; body_en: string | null; body_es: string | null }[];
  keys: Record<string, string[]>; outcomeOf: Record<string, string | null>; urls: Record<string, string>;
}) {
  const { t, i18n } = useTranslation(); const lang = i18n.resolvedLanguage ?? 'en';
  const [step, setStep] = useState(0); const [answers, setAnswers] = useState<Record<string, Answer>>({}); const [done, setDone] = useState(false);
  const result = useMemo(() => {
    if (!done) return null;
    if (mode === 'outcome') { const win = outcomeFor(outcomes.map(o => o.id), Object.values(answers).flatMap(a => (a.selected ?? []).map(id => outcomeOf[id] ?? null))); return { mode, outcome: outcomes.find(o => o.id === win) ?? null } as const; }
    if (mode === 'poll') return { mode, poll: null } as const;
    const scored = questions.filter(x => x.type !== 'short'); const ok = scored.filter(x => { const s = [...(answers[x.id]?.selected ?? [])].sort().join(); return s === [...(keys[x.id] ?? [])].sort().join(); }).length;
    const pct = scored.length ? Math.round((ok / scored.length) * 100) : null;
    return { mode, score_pct: pct, passed: pct === null ? null : pct >= passPct, band: bandFor(bands, pct) } as const;
  }, [done]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!questions.length) return <p className="muted">{t('quizPlay.noQuestions')}</p>;
  const cur = questions[Math.min(step, questions.length - 1)]!;
  return <div className="quiz-player is-preview">
    <p className="not-connected" role="status">{t('quizStudio.previewNote')}</p>
    <h2 className="manage-title">{title || t('resources.untitled')}</h2>
    {result ? <>
      <ResultCard r={{ status: 'graded', pass_pct: passPct, respondents: null, score_pct: null, passed: null, band: null, outcome: null, poll: null, ...result } as never} urls={urls} lang={lang} />
      {mode === 'poll' && <p className="muted-small">{t('quizStudio.previewPoll')}</p>}
      <Button variant="secondary" onClick={() => { setDone(false); setAnswers({}); setStep(0); }}>{t('quizStudio.previewAgain')}</Button>
    </> : <>
      <QuestionStep q={cur} index={step} total={questions.length} answer={answers[cur.id]} onAnswer={a => setAnswers(p => ({ ...p, [cur.id]: a }))} urls={urls} lang={lang} />
      <div className="quiz-nav"><Button variant="ghost" disabled={step === 0} onClick={() => setStep(s => s - 1)}><ArrowLeft />{t('common.back')}</Button>
        {step >= questions.length - 1 ? <Button onClick={() => setDone(true)}>{t('quizStudio.previewSee')}</Button> : <Button onClick={() => setStep(s => s + 1)}>{t('quizPlay.next')}<ArrowRight /></Button>}</div>
    </>}
  </div>;
}
