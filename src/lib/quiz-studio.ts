// Quiz studio + player rules (mirrors 0125 SQL: quiz_blockers, submit_quiz outcome tally, quiz_result bands/poll threshold).
export const QUIZ_MODES = ['scored', 'outcome', 'poll'] as const;
export type QuizMode = (typeof QUIZ_MODES)[number];
export type StudioQuestionType = 'single' | 'multi' | 'truefalse' | 'short';

/** Question types each mode may use: outcome quizzes and polls are choice-only. */
export const typesForMode = (mode: QuizMode): StudioQuestionType[] => (mode === 'scored' ? ['single', 'multi', 'truefalse', 'short'] : ['single', 'multi']);

/** Polls stay hidden until this many people answered, so nobody's answer can be inferred. */
export const POLL_MIN_RESPONDENTS = 3;
export const MIN_CHOICES = 2;
export const MAX_CHOICES = 8;

const PLACEHOLDER = /\[[^\]]{1,80}\]/;
export const hasPlaceholder = (...texts: (string | null | undefined)[]) => texts.some(s => !!s && PLACEHOLDER.test(s));

export type StudioOption = { id?: string; label_en: string; label_es: string; is_correct: boolean; image_path: string | null; image_alt: string; outcome_id: string | null };
export type StudioQuestion = { id?: string; type: StudioQuestionType; prompt_en: string; prompt_es: string; points: number; image_path: string | null; image_alt: string; accepted: string[]; allow_manual: boolean; options: StudioOption[] };
export type StudioOutcome = { id: string; title_en: string; title_es: string; body_en: string; body_es: string };
export type StudioBand = { id?: string; min_pct: number; title_en: string; title_es: string };
export type StudioQuiz = { mode: QuizMode; title_en: string; title_es: string; instructions_en: string; instructions_es: string };

const blank = (a?: string | null, b?: string | null) => !(a ?? '').trim() && !(b ?? '').trim();

/** Per-question problems shown inline in the editor (same rules as the publish check). */
export function questionProblems(q: StudioQuestion, mode: QuizMode): string[] {
  const out: string[] = [];
  if (blank(q.prompt_en, q.prompt_es)) out.push('missing_prompt');
  if (!typesForMode(mode).includes(q.type)) out.push('mode_types');
  if (q.image_path && !q.image_alt.trim()) out.push('missing_alt');
  if (q.type !== 'short') {
    if (q.options.length < MIN_CHOICES) out.push('missing_options');
    if (q.options.some(o => blank(o.label_en, o.label_es) && !o.image_path)) out.push('empty_option');
    if (q.options.some(o => o.image_path && !o.image_alt.trim())) out.push('missing_alt');
    if (mode === 'scored') {
      const correct = q.options.filter(o => o.is_correct).length;
      if ((q.type === 'single' || q.type === 'truefalse') ? correct !== 1 : correct < 1) out.push('missing_key');
    }
    if (mode === 'outcome' && q.options.some(o => !o.outcome_id)) out.push('outcome_unmapped');
  } else if (mode === 'scored' && !q.allow_manual && !q.accepted.some(a => a.trim())) out.push('missing_key');
  if (hasPlaceholder(q.prompt_en, q.prompt_es, ...q.options.flatMap(o => [o.label_en, o.label_es]))) out.push('placeholder');
  return [...new Set(out)];
}

/** Whole-quiz publish blockers (client mirror of quiz_blockers; the database check is authoritative). */
export function quizBlockers(quiz: StudioQuiz, questions: StudioQuestion[], outcomes: StudioOutcome[], bands: StudioBand[]): string[] {
  const out = new Set<string>();
  if (blank(quiz.title_en, quiz.title_es)) out.add('missing_title');
  if (!questions.length) out.add('no_questions');
  for (const q of questions) for (const p of questionProblems(q, quiz.mode)) out.add(p);
  if (hasPlaceholder(quiz.title_en, quiz.title_es, quiz.instructions_en, quiz.instructions_es)) out.add('placeholder');
  if (quiz.mode === 'outcome') {
    if (outcomes.length < 2) out.add('outcomes_needed');
    if (outcomes.some(o => blank(o.title_en, o.title_es))) out.add('outcome_title');
    if (outcomes.some(o => hasPlaceholder(o.title_en, o.title_es, o.body_en, o.body_es))) out.add('placeholder');
  }
  if (quiz.mode === 'scored' && bands.some(b => blank(b.title_en, b.title_es))) out.add('band_title');
  return [...out];
}

/** Band for a score: the highest band whose minimum the score reaches. */
export function bandFor<B extends { min_pct: number }>(bands: B[], score: number | null): B | null {
  if (score === null) return null;
  return [...bands].filter(b => b.min_pct <= score).sort((a, b) => b.min_pct - a.min_pct)[0] ?? null;
}

/** Outcome tally: most-picked outcome wins; ties go to the outcome listed first. */
export function outcomeFor(outcomeOrder: string[], picked: (string | null)[]): string | null {
  if (!outcomeOrder.length) return null;
  const counts = new Map<string, number>();
  for (const id of picked) if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  let best = outcomeOrder[0]!; let bestN = counts.get(best) ?? 0;
  for (const id of outcomeOrder) { const n = counts.get(id) ?? 0; if (n > bestN) { best = id; bestN = n; } }
  return best;
}

/** Whole-number percentages for a poll question (0 when nobody answered). */
export const pollPercents = (counts: number[], answered: number) => counts.map(c => (answered > 0 ? Math.round((c / answered) * 100) : 0));

export const pollVisible = (respondents: number, isEditor: boolean) => isEditor || respondents >= POLL_MIN_RESPONDENTS;

/** Questions still without an answer. */
export function unanswered(questionIds: string[], answers: Record<string, { selected: string[] | null; text_answer: string | null } | undefined>): string[] {
  return questionIds.filter(id => { const a = answers[id]; return !(a && ((a.selected?.length ?? 0) > 0 || !!a.text_answer?.trim())); });
}
/** Outcome quizzes and polls need every question answered (enforced by submit_quiz); scored quizzes allow blanks after a confirm. */
export const mustAnswerAll = (mode: QuizMode) => mode !== 'scored';

/** Retake policy text key: unlimited, n left, or none left. */
export function retakeState(allowed: number | null, used: number): { key: 'unlimited' | 'left' | 'none'; left: number } {
  if (allowed === null) return { key: 'unlimited', left: Infinity };
  const left = Math.max(0, allowed - used);
  return { key: left > 0 ? 'left' : 'none', left };
}

/** Option rows for the default true/false pair. */
export const trueFalseOptions = (): StudioOption[] => [
  { label_en: 'True', label_es: 'Verdadero', is_correct: true, image_path: null, image_alt: '', outcome_id: null },
  { label_en: 'False', label_es: 'Falso', is_correct: false, image_path: null, image_alt: '', outcome_id: null },
];
export const emptyOption = (): StudioOption => ({ label_en: '', label_es: '', is_correct: false, image_path: null, image_alt: '', outcome_id: null });

export function moveItem<T>(list: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir; if (j < 0 || j >= list.length) return list;
  const next = [...list]; [next[i], next[j]] = [next[j]!, next[i]!]; return next;
}
