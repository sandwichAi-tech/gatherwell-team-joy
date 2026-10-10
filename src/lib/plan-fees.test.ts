import { describe, expect, it } from 'vitest';
import { cappedFee, serviceFee } from './plan-fees';

const sumFees = (sales: number[], pct: number, cap: number | null) => sales.reduce((paid, s) => paid + cappedFee(s, pct, cap, paid), 0);

describe('Free plan: 7% capped at $99 per month', () => {
  it('a coach with $2,000 in sales pays $99, not $140', () => {
    expect(sumFees(Array(40).fill(5000), 7, 9900)).toBe(9900);
  });
  it('charges 7% while under the cap', () => {
    expect(cappedFee(10000, 7, 9900, 0)).toBe(700);
  });
  it('charges only the remainder on the sale that reaches the cap', () => {
    expect(cappedFee(10000, 7, 9900, 9500)).toBe(400);
  });
  it('charges 0% once $99 has been paid this month', () => {
    expect(cappedFee(10000, 7, 9900, 9900)).toBe(0);
  });
});

describe('Pro plan: 0% platform fee', () => {
  it('never charges a platform fee', () => {
    expect(cappedFee(200000, 0, null, 0)).toBe(0);
  });
});

describe('Guest service fee: 3% + $0.49 on paid tickets', () => {
  it('a $20 ticket has a $1.09 fee, $21.09 total', () => {
    expect(serviceFee(2000, 3, 49)).toBe(109);
    expect(2000 + serviceFee(2000, 3, 49)).toBe(2109);
  });
  it('a free gathering has no fee', () => {
    expect(serviceFee(0, 3, 49)).toBe(0);
  });
});
