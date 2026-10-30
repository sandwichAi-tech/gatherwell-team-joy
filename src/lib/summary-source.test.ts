import { describe, expect, it } from 'vitest';
import { summarySource, SUMMARY_MIN_CHARS } from '@/lib/summary-source';

const long = 'Breathing practice notes. '.repeat(12);

describe('summary source', () => {
  it('refuses when there is no notes text at all (title alone is never summarized)', () => expect(summarySource('  ', [null, ''])).toEqual({ ok: false, error: 'no_source' }));
  it('refuses text too short to summarize faithfully', () => expect(summarySource('Short note.', [])).toEqual({ ok: false, error: 'too_short' }));
  it('prefers pasted notes over lesson notes', () => { const r = summarySource(long, ['other']); expect(r).toMatchObject({ ok: true, from: 'pasted', text: long.trim() }); });
  it('falls back to English and Spanish lesson notes', () => { const r = summarySource('', [long, 'Notas en español']); expect(r).toMatchObject({ ok: true, from: 'lesson' }); expect(r.ok && r.text.includes('Notas en español')).toBe(true); });
  it('uses a 200 character minimum', () => expect(SUMMARY_MIN_CHARS).toBe(200));
});
