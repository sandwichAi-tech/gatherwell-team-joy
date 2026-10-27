export type AssessmentOption = { id: string; label: string; value: number };
export type AssessmentQuestion = { id: string; type: 'single' | 'multi' | 'scale' | 'text'; prompt: string; scored: boolean; weight: number; options: AssessmentOption[] };
export type AssessmentResult = { id: string; min: number; max: number; title: string; body: string; url: string };
export type AssessmentDraft = { kind: 'wellness_assessment'; title_en: string; title_es: string; description_en: string; description_es: string; language: 'en' | 'es'; allow_retake: boolean; questions: AssessmentQuestion[]; results: AssessmentResult[] };
export const emptyAssessment = (): AssessmentDraft => ({ kind: 'wellness_assessment', title_en: '', title_es: '', description_en: '', description_es: '', language: 'en', allow_retake: false, questions: [], results: [] });
export function safeExternalUrl(value: string): boolean {
  try { const u = new URL(value); return u.protocol === 'https:' && !!u.hostname && !u.username && !u.password && !/\s/.test(value); } catch { return false; }
}
export function assessmentRangesValid(results: AssessmentResult[]): boolean {
  const sorted = [...results].sort((a, b) => a.min - b.min);
  return sorted.length > 0 && sorted[0]?.min === 0 && sorted.at(-1)?.max === 100 && sorted.every((r, i) => Number.isInteger(r.min) && Number.isInteger(r.max) && r.min >= 0 && r.max <= 100 && r.max >= r.min && (i === 0 || r.min === (sorted[i - 1]?.max ?? -2) + 1));
}
export function assessmentIssues(d: AssessmentDraft): string[] {
  const issues = new Set<string>();
  if (!(d.title_en.trim() || d.title_es.trim())) issues.add('title');
  if (!d.questions.length) issues.add('questions');
  for (const q of d.questions) {
    if (!q.prompt.trim()) issues.add('questions');
    if (q.type === 'text' && q.scored) issues.add('textScore');
    if (q.type !== 'text' && (q.options.length < 2 || q.options.some(o => !o.label.trim()))) issues.add('options');
    if (q.scored && (!Number.isFinite(q.weight) || q.weight <= 0 || q.options.some(o => !Number.isFinite(o.value) || o.value < 0 || o.value > 100) || Math.max(...q.options.map(o => o.value)) === Math.min(...q.options.map(o => o.value)))) issues.add('weights');
  }
  if (d.questions.some(q => q.scored) && !assessmentRangesValid(d.results)) issues.add('ranges');
  if (d.results.some(r => !r.title.trim() || !r.body.trim())) issues.add('results');
  if (d.results.some(r => r.url && !safeExternalUrl(r.url))) issues.add('url');
  return [...issues];
}
/** Author-only interpretation preview: no right/wrong keys, no participant write. */
export function assessmentScore(d: AssessmentDraft, answers: Record<string, string[]>): number | null {
  let total = 0; let weights = 0;
  for (const q of d.questions) {
    if (!q.scored || q.type === 'text') continue;
    const chosen = q.options.filter(o => answers[q.id]?.includes(o.id));
    if (!chosen.length) return null;
    const low = Math.min(...q.options.map(o => o.value)); const high = Math.max(...q.options.map(o => o.value));
    if (high <= low || q.weight <= 0) return null;
    const value = chosen.reduce((sum, o) => sum + o.value, 0) / chosen.length;
    total += ((value - low) / (high - low)) * 100 * q.weight; weights += q.weight;
  }
  return weights ? Math.round(total / weights) : null;
}
export function assessmentResult(d: AssessmentDraft, score: number | null): AssessmentResult | null {
  return score === null ? null : d.results.find(r => score >= r.min && score <= r.max) ?? null;
}
export function reorderedIds<T extends { id: string }>(rows: T[], index: number, direction: -1 | 1): string[] {
  const ids = rows.map(r => r.id); const other = index + direction;
  const a = ids[index], b = ids[other];
  if (!a || !b) return ids;
  ids[index] = b; ids[other] = a; return ids;
}