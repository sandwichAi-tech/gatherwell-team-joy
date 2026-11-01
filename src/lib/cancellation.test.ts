import { describe, expect, it } from 'vitest';
import { cancelConfirmMatches, isRefunded, missingBackendFunction, refundDeadline, refundEligibility, refundableCents } from './cancellation';
const start = '2026-12-10T18:00:00.000Z';
describe('cancellation and refund rules', () => {
  it('24h policy: full refund until exactly 24 hours before, none after', () => {
    expect(refundDeadline('24h', start)?.toISOString()).toBe('2026-12-09T18:00:00.000Z');
    expect(refundEligibility('24h', start, { paid: true, now: new Date('2026-12-09T18:00:00.000Z') })).toBe('full');
    expect(refundEligibility('24h', start, { paid: true, now: new Date('2026-12-09T18:00:01.000Z') })).toBe('none');
  });
  it('7d policy cutoff is 7 days before', () => {
    expect(refundDeadline('7d', start)?.toISOString()).toBe('2026-12-03T18:00:00.000Z');
  });
  it('no-refund policy never refunds an attendee cancellation; custom goes to host review', () => {
    expect(refundEligibility('none', start, { paid: true, now: new Date('2026-01-01') })).toBe('none');
    expect(refundEligibility('custom', start, { paid: true })).toBe('review');
  });
  it('host cancellation always opens a full refund request; free bookings need none', () => {
    expect(refundEligibility('none', start, { paid: true, hostCancelled: true })).toBe('full');
    expect(refundEligibility('24h', start, { paid: false })).toBe('free');
  });
  it('booking fee is excluded from the refundable amount', () => {
    expect(refundableCents(3500, 300)).toBe(3200);
    expect(refundableCents(200, 300)).toBe(0);
  });
  it('only provider-confirmed succeeded reads as refunded', () => {
    expect(isRefunded('pending')).toBe(false); expect(isRefunded('submitted')).toBe(false); expect(isRefunded('succeeded')).toBe(true);
  });
  it('event cancel needs the exact title typed', () => {
    expect(cancelConfirmMatches(' zz-test yoga ', 'ZZ-TEST Yoga')).toBe(true);
    expect(cancelConfirmMatches('yes', 'ZZ-TEST Yoga')).toBe(false);
    expect(cancelConfirmMatches('', '')).toBe(false);
  });
  it('detects a backend function that is not installed yet', () => {
    expect(missingBackendFunction({ code: 'PGRST202', message: '' })).toBe(true);
    expect(missingBackendFunction({ code: 'P0001', message: 'confirm_mismatch' })).toBe(false);
  });
});
