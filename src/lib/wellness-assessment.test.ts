import { describe, expect, it } from 'vitest';
import { assessmentIssues, assessmentRangesValid, assessmentResult, assessmentScore, emptyAssessment, reorderedIds, safeExternalUrl } from './wellness-assessment';
describe('wellness assessment rules', () => {
  it('requires complete non-overlapping integer results from 0 through 100', () => {
    const result = { id: 'r', title: 'Result', body: 'Support', url: '' };
    expect(assessmentRangesValid([{ ...result, min: 0, max: 49 }, { ...result, min: 50, max: 100 }])).toBe(true);
    expect(assessmentRangesValid([{ ...result, min: 1, max: 100 }])).toBe(false);
    expect(assessmentRangesValid([{ ...result, min: 0, max: 49 }, { ...result, min: 51, max: 100 }])).toBe(false);
    expect(assessmentRangesValid([{ ...result, min: 0, max: 50 }, { ...result, min: 50, max: 100 }])).toBe(false);
  });
  it('never scores free text', () => {
    const d = emptyAssessment(); d.questions = [{ id: 't', type: 'text', prompt: 'Note', scored: false, weight: 1, options: [] }];
    expect(assessmentScore(d, { t: ['anything'] })).toBeNull();
    d.questions[0] = { ...d.questions[0], id: 't', type: 'text', prompt: 'Note', scored: true, weight: 1, options: [] };
    expect(assessmentIssues(d)).toContain('textScore');
  });
  it('normalizes weighted choices to 0–100 without correctness', () => {
    const d = emptyAssessment(); d.questions = [1, 3].map((weight, i) => ({ id: String(i), type: 'single', prompt: 'Choice', scored: true, weight, options: [{ id: 'low', label: 'Low', value: 2 }, { id: 'high', label: 'High', value: 6 }] }));
    expect(assessmentScore(d, { '0': ['low'], '1': ['high'] })).toBe(75);
    expect(assessmentScore(d, { '0': ['high'] })).toBeNull();
    d.results = [{ id: 'r', min: 50, max: 100, title: 'Result', body: 'Support', url: '' }];
    expect(assessmentResult(d, 75)?.id).toBe('r');
  });
  it('rejects unsafe links and credentials while allowing HTTPS', () => {
    for (const u of ['javascript:alert(1)', 'http://example.com', '//example.com', 'https://user:pass@example.com', 'https://example.com/a b']) expect(safeExternalUrl(u)).toBe(false);
    expect(safeExternalUrl('https://example.com/path?x=1')).toBe(true);
  });
  it('moves exact IDs even when saved order values tie', () => {
    expect(reorderedIds([{ id: 'a' }, { id: 'b' }, { id: 'c' }], 1, -1)).toEqual(['b', 'a', 'c']);
    expect(reorderedIds([{ id: 'a' }, { id: 'b' }], 0, -1)).toEqual(['a', 'b']);
  });
});