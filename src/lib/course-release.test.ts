import { describe, expect, it } from 'vitest';
import { accessStart, formatUnlock, isUnlocked, unlockAt } from './course-release';

const start = new Date('2026-11-01T15:00:00Z');

describe('course lesson release schedule', () => {
  it('opens lesson 1 at access start and lesson 2 after 7 days, lesson 3 after 14 days', () => {
    expect(unlockAt(start, 0, 7)).toBeNull();
    expect(unlockAt(start, 1, 7)?.toISOString()).toBe('2026-11-08T15:00:00.000Z');
    expect(unlockAt(start, 2, 7)?.toISOString()).toBe('2026-11-15T15:00:00.000Z');
  });
  it('a course without a schedule opens every lesson immediately', () => {
    expect(unlockAt(start, 5, 0)).toBeNull();
  });
  it('locks until the exact release instant, independent of time zone', () => {
    const at = unlockAt(start, 1, 7)!;
    expect(isUnlocked(at, at.getTime() - 1)).toBe(false);
    expect(isUnlocked(at, at.getTime())).toBe(true);
    expect(formatUnlock(at.toISOString(), 'en', 'Pacific/Kiritimati')).toContain('Nov 9');
    expect(formatUnlock(at.toISOString(), 'en', 'Pacific/Pago_Pago')).toContain('Nov 8');
  });
  it('uses the earliest grant and never starts before activation', () => {
    expect(accessStart(['2026-11-03T00:00:00Z', '2026-11-01T00:00:00Z'])?.toISOString()).toBe('2026-11-01T00:00:00.000Z');
    expect(accessStart(['2026-11-01T00:00:00Z'], '2026-12-01T00:00:00Z')?.toISOString()).toBe('2026-12-01T00:00:00.000Z');
    expect(accessStart([])).toBeNull();
  });
});
