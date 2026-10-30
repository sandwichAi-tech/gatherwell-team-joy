/** Minimum amount of real text before a summary is attempted; shorter input would force the model to invent. */
export const SUMMARY_MIN_CHARS = 200;

export type SummarySource =
  | { ok: true; text: string; from: 'pasted' | 'lesson' }
  | { ok: false; error: 'no_source' | 'too_short' };

/** Picks the text a summary may be based on: pasted notes first, else the lesson's own notes. Never the title. */
export function summarySource(pasted: string, lessonNotes: (string | null | undefined)[]): SummarySource {
  const own = pasted.trim();
  const text = own || lessonNotes.map(n => (n ?? '').trim()).filter(Boolean).join('\n\n');
  if (!text) return { ok: false, error: 'no_source' };
  if (text.replace(/\s+/g, ' ').length < SUMMARY_MIN_CHARS) return { ok: false, error: 'too_short' };
  return { ok: true, text, from: own ? 'pasted' : 'lesson' };
}
