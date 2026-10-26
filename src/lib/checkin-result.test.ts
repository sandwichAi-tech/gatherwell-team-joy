import { describe, expect, it } from 'vitest';
import { checkinErrorResult, confirmedAttendance, normalizeCheckinCode } from './checkin-result';

describe('server-confirmed admission feedback', () => {
  it('accepts grouped manual codes without changing their binding', () => expect(normalizeCheckinCode(' AB12-CD34-EF ')).toBe('ab12cd34ef'));
  it('rejects URLs instead of stripping them into codes', () => expect(normalizeCheckinCode('https://example.invalid/ab12cd34')).toBeNull());
  it('never counts duplicate admission as a new attendance', () => expect(confirmedAttendance({ result: 'already' })).toBe(false));
  it('never confirms queued offline admission', () => expect(confirmedAttendance({ result: 'pending' })).toBe(false));
  it('counts only server-confirmed success', () => expect(confirmedAttendance({ result: 'ok' })).toBe(true));
  it('preserves a required waiver blocker', () => expect(checkinErrorResult({ message: 'waiver_required' })).toEqual({ result: 'waiver_required' }));
  it('never treats cancelled registration as success', () => expect(checkinErrorResult({ message: 'cancelled' })).toEqual({ result: 'cancelled' }));
});