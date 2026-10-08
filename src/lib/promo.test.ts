import { describe, it, expect } from 'vitest';
import { promoDiscount, normalizeCode } from './promo';
describe('promo codes', () => {
  it('percent off the subtotal', () => expect(promoDiscount(4000, { kind: 'percent', amount: 25 })).toBe(1000));
  it('fixed amount off', () => expect(promoDiscount(4000, { kind: 'flat', amount: 500 })).toBe(500));
  it('never discounts below 50 cents to charge', () => expect(promoDiscount(1000, { kind: 'flat', amount: 5000 })).toBe(950));
  it('100 percent still leaves 50 cents', () => expect(promoDiscount(2000, { kind: 'percent', amount: 100 })).toBe(1950));
  it('normalizes typed codes', () => expect(normalizeCode(' save-20 ')).toBe('SAVE20'));
});
