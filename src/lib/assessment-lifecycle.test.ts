import { describe, expect, it } from 'vitest';
import { assessmentIssues, assessmentScore, emptyAssessment } from './wellness-assessment';
describe('assessment lifecycle score vectors', () => {
  const d = { ...emptyAssessment(), title_en: 'ZZ-TEST', questions: [{ id: 'q', type: 'multi' as const, prompt: 'Choice', scored: true, weight: 1, options: [{ id: 'a', label: 'A', value: 0 }, { id: 'b', label: 'B', value: 100 }] }], results: [{ id: 'r', title: 'Result', body: 'ZZ-TEST', min: 0, max: 100, url: '' }] };
  it('averages supported multiple choices to 50 of 100', () => expect(assessmentScore(d, { q: ['a', 'b'] })).toBe(50));
  it('retakes default off without erasing prior result configuration', () => expect(emptyAssessment().allow_retake).toBe(false));
  it('accepts complete 0–100 result coverage', () => expect(assessmentIssues(d)).toEqual([]));
  it('rejects result gaps', () => expect(assessmentIssues({ ...d, results: [{ ...d.results[0], min: 1 }] })).toContain('ranges'));
  it('rejects unsafe result destinations', () => expect(assessmentIssues({ ...d, results: [{ ...d.results[0], url: 'javascript:alert(1)' }] })).toContain('url'));
});