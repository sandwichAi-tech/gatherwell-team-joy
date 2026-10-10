import { describe, expect, it } from 'vitest';
import { paymentSchedule, tripDays } from './retreat';

describe('retreat payments', () => {
  it('deposit: deposit now, the rest on the balance date', () => {
    const s = paymentSchedule(60000, { mode: 'deposit', deposit_cents: 15000, balance_due: '2027-03-01' });
    expect(s.map(x => x.amount_cents)).toEqual([15000, 45000]);
    expect(s[0]!.due).toBeNull();
  });
  it('plan: 3 installments add up to the full price', () => {
    const s = paymentSchedule(10000, { mode: 'plan', installments: 3, balance_due: '2027-03-01' }, new Date('2027-01-01T09:00:00'));
    expect(s.map(x => x.amount_cents)).toEqual([3334, 3334, 3332]);
    expect(s[2]!.due?.toISOString().slice(0, 10)).toBe(new Date('2027-03-01T09:00:00').toISOString().slice(0, 10));
  });
  it('plan installments are capped at 4', () => {
    expect(paymentSchedule(10000, { mode: 'plan', installments: 9, balance_due: '2027-03-01' })).toHaveLength(4);
  });
  it('a Friday to Sunday trip is 3 days', () => {
    expect(tripDays('2027-03-05T16:00:00', '2027-03-07T12:00:00')).toBe(3);
  });
});
