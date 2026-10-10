import { describe, expect, it } from 'vitest';
import { DAY60_SAMPLE, dayCount, evaluateDay60, verdict } from './day60';

describe('day-60 scoreboard', () => {
  it('7+ go, 4-6 adjust, 3 or fewer rethink', () => {
    expect(verdict(7)).toBe('go'); expect(verdict(6)).toBe('adjust'); expect(verdict(4)).toBe('adjust'); expect(verdict(3)).toBe('rethink');
  });
  it('counts days from the start date, capped at 60', () => {
    expect(dayCount('2026-10-01', new Date('2026-10-23T12:00:00Z'))).toBe(23);
    expect(dayCount('2026-01-01', new Date('2026-10-23T12:00:00Z'))).toBe(60);
  });
  it('150 paying members meets the target, 149 does not', () => {
    expect(evaluateDay60({ start_date: 'x', paying_members: 150 }).find(t => t.key === 'paying')!.met).toBe(true);
    expect(evaluateDay60({ start_date: 'x', paying_members: 149 }).find(t => t.key === 'paying')!.met).toBe(false);
  });
  it('60% check-in meets, 59% does not', () => {
    expect(evaluateDay60({ start_date: 'x', rsvps: 100, checked_in: 60 }).find(t => t.key === 'checkin')!.met).toBe(true);
    expect(evaluateDay60({ start_date: 'x', rsvps: 100, checked_in: 59 }).find(t => t.key === 'checkin')!.met).toBe(false);
  });
  it('sample data scores 6 of 10 (adjust)', () => {
    expect(evaluateDay60(DAY60_SAMPLE).filter(t => t.met).length).toBe(6);
  });
});
