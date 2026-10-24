import { supabase } from '@/integrations/supabase/client';

/* ---------- Types matching the 0062 schema ---------- */
export type QuizType = 'single' | 'multi' | 'truefalse' | 'short';

export interface Quiz {
  id: string; offer_id: string; lesson_id: string | null;
  title_en: string; title_es: string; instructions_en: string | null; instructions_es: string | null;
  pass_pct: number; attempts_allowed: number | null; cooldown_minutes: number; time_limit_minutes: number | null;
  is_required: boolean; show_score: boolean; reveal_answers: 'never' | 'after_pass' | 'always';
  randomize_questions: boolean; randomize_answers: boolean; is_published: boolean; sort_order: number;
}
export interface QuizQuestion {
  id: string; quiz_id: string; type: QuizType; prompt_en: string; prompt_es: string;
  points: number; sort_order: number; accepted_answers: string[] | null; allow_manual: boolean;
  explanation_en: string | null; explanation_es: string | null;
}
export interface QuizOption { id: string; question_id: string; label_en: string; label_es: string; is_correct: boolean; sort_order: number }

export interface TakerQuestion {
  id: string; type: QuizType; points: number; prompt_en: string; prompt_es: string;
  options: { id: string; label_en: string; label_es: string }[] | null;
}
export interface TakerPayload {
  error?: string;
  quiz: Pick<Quiz, 'id' | 'offer_id' | 'lesson_id' | 'title_en' | 'title_es' | 'instructions_en' | 'instructions_es' | 'pass_pct' | 'attempts_allowed' | 'cooldown_minutes' | 'time_limit_minutes' | 'is_required' | 'show_score'>;
  questions: TakerQuestion[];
  attempts_used: number;
  cooldown_until: string | null;
  can_start: boolean;
  active_attempt: { id: string; attempt_no: number; deadline: string | null; responses: Record<string, { selected: string[] | null; text_answer: string | null }> } | null;
}
export interface SubmitResult { attempt_id: string; status: 'awaiting_manual' | 'graded'; score_pct: number | null; passed: boolean | null; idempotent: boolean }
export interface AttemptRow { id: string; attempt_no: number; started_at: string; submitted_at: string | null; status: string; score_pct: number | null; passed: boolean | null }
export interface CourseProgress { error?: string; lessons: number; lessons_done: number; quizzes_required: number; quizzes_passed: number; percent: number; complete: boolean; last_activity: string | null }
export interface Certificate { id: string; offer_id: string; user_id: string; cert_number: string; learner_name: string; course_title: string; issuer_name: string; signer_name: string | null; signer_title: string | null; statement: string | null; issued_at: string; expires_at: string | null; revoked_at: string | null; revoke_reason: string | null }
export interface VerifyResult { valid: boolean; learner_name?: string; course_title?: string; issuer_name?: string; issued_at?: string; expires_at?: string | null; revoked?: boolean; expired?: boolean }

/* ---------- Pure helpers (mirrors of SQL rules, unit-tested) ---------- */

/** Normalization used by short-answer auto-grading (mirrors submit_quiz SQL). */
export function normalizeAnswer(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Score percentage with the same rounding as submit_quiz (round half away from zero, 2dp). */
export function scorePct(earned: number, total: number): number | null {
  if (total <= 0) return null;
  return Math.round((earned / total) * 10000) / 100;
}

export function passedQuiz(pct: number | null, passPct: number): boolean | null {
  if (pct === null) return null;
  return pct >= passPct;
}

/** Milliseconds remaining on a server-issued deadline; 0 when expired. */
export function timeLeftMs(deadline: string | null, nowMs: number): number | null {
  if (!deadline) return null;
  return Math.max(0, new Date(deadline).getTime() - nowMs);
}

/** Cooldown end must be in the future to block a retry (mirrors start_quiz_attempt). */
export function cooldownActive(cooldownUntil: string | null, nowMs: number): boolean {
  if (!cooldownUntil) return false;
  return new Date(cooldownUntil).getTime() > nowMs;
}

export function attemptsExhausted(allowed: number | null, used: number): boolean {
  return allowed !== null && used >= allowed;
}

/** Certificate numbers are ZW- plus 12 uppercase hex chars (from gen_random_uuid). */
export const CERT_NUMBER_PATTERN = /^ZW-[0-9A-F]{12}$/;

/** Course completion mirror of course_progress(). */
export function courseComplete(opts: { requireLessons: boolean; lessons: number; lessonsDone: number; requireQuizzes: boolean; quizzesRequired: number; quizzesPassed: number }): boolean {
  const lessonsOk = !opts.requireLessons || opts.lessons === 0 || opts.lessonsDone >= opts.lessons;
  const quizzesOk = !opts.requireQuizzes || opts.quizzesRequired === 0 || opts.quizzesPassed >= opts.quizzesRequired;
  return lessonsOk && quizzesOk && (opts.lessons > 0 || opts.quizzesRequired > 0);
}

export function coursePercent(opts: { requireLessons: boolean; lessons: number; lessonsDone: number; requireQuizzes: boolean; quizzesRequired: number; quizzesPassed: number }): number {
  const parts = (opts.requireLessons ? opts.lessons : 0) + (opts.requireQuizzes ? opts.quizzesRequired : 0);
  if (parts === 0) return 0;
  const done = (opts.requireLessons ? opts.lessonsDone : 0) + (opts.requireQuizzes ? opts.quizzesPassed : 0);
  return Math.round((done / parts) * 100);
}

/* ---------- RPC wrappers ---------- */

export async function getQuizForTaker(quizId: string): Promise<{ data: TakerPayload | null; error: unknown }> {
  const { data, error } = await supabase.rpc('get_quiz_for_taker', { _quiz: quizId });
  return { data: data as TakerPayload | null, error };
}
export async function startQuizAttempt(quizId: string) {
  return supabase.rpc('start_quiz_attempt', { _quiz: quizId }) as Promise<{ data: { attempt_id: string; attempt_no: number; deadline: string | null; resumed: boolean } | null; error: { message?: string } | null }>;
}
export async function saveQuizResponse(attemptId: string, questionId: string, selected: string[] | null, text: string | null) {
  return supabase.rpc('save_quiz_response', { _attempt: attemptId, _question: questionId, _selected: selected, _text: text });
}
export async function submitQuiz(attemptId: string) {
  return supabase.rpc('submit_quiz', { _attempt: attemptId }) as Promise<{ data: SubmitResult | null; error: unknown }>;
}
export async function myQuizAttempts(quizId: string): Promise<AttemptRow[]> {
  const { data } = await supabase.rpc('my_quiz_attempts', { _quiz: quizId });
  return (data as AttemptRow[] | null) ?? [];
}
export async function setLessonProgress(lessonId: string, completed: boolean) {
  return supabase.rpc('set_lesson_progress', { _lesson: lessonId, _completed: completed });
}
export async function getCourseProgress(offerId: string): Promise<CourseProgress | null> {
  const { data } = await supabase.rpc('course_progress', { _offer: offerId });
  return data as CourseProgress | null;
}
export async function issueCertificate(offerId: string) {
  return supabase.rpc('issue_certificate', { _offer: offerId }) as Promise<{ data: { certificate_id: string; cert_number: string; idempotent: boolean; revoked: boolean } | null; error: { message?: string } | null }>;
}
export async function revokeCertificate(certId: string, reason: string) {
  return supabase.rpc('revoke_certificate', { _cert: certId, _reason: reason });
}
export async function verifyCertificate(number: string): Promise<VerifyResult> {
  const { data } = await supabase.rpc('verify_certificate', { _number: number });
  return (data as VerifyResult | null) ?? { valid: false };
}
