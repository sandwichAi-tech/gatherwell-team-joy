import { describe, expect, it } from 'vitest';
import { assessmentRangesValid, rangeProblem } from '@/lib/wellness-assessment';
const r = (min: number, max: number) => ({ id: `${min}`, min, max, title: 't', body: 'b', url: '' });
describe('assessment result ranges', () => {
  it('accepts 0–49 and 50–100', () => { expect(rangeProblem([r(0, 49), r(50, 100)])).toBeNull(); expect(assessmentRangesValid([r(0, 49), r(50, 100)])).toBe(true); });
  it('reports the exact gap', () => expect(rangeProblem([r(0, 40), r(60, 100)])).toEqual({ kind: 'gap', from: 41, to: 59 }));
  it('reports overlap', () => expect(rangeProblem([r(0, 60), r(50, 100)])).toEqual({ kind: 'overlap', from: 50, to: 60 }));
  it('reports missing start and end', () => {
    expect(rangeProblem([r(10, 100)])).toEqual({ kind: 'start', from: 0, to: 9 });
    expect(rangeProblem([r(0, 90)])).toEqual({ kind: 'end', from: 91, to: 100 });
  });
  it('reports empty and reversed ranges', () => { expect(rangeProblem([])?.kind).toBe('empty'); expect(rangeProblem([r(0, 100), r(80, 20)])?.kind).toBe('invalid'); });
  it('agrees with assessmentRangesValid', () => {
    for (const set of [[r(0, 40), r(60, 100)], [r(0, 60), r(50, 100)], [r(0, 100)]]) expect(rangeProblem(set) === null).toBe(assessmentRangesValid(set));
  });
});
