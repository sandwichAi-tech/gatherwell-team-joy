import { describe, expect, it } from 'vitest';
import { noLimitsPhase, planSaving } from './plan-savings';
const s = { free: { monthly_price: 0, fee_percent: 7 }, growth: { monthly_price: 4900, fee_percent: 2 }, pro: { monthly_price: 9900, fee_percent: 0 } };
describe('plan savings', () => {
  it('Free host with $2,000 sales would pay $51 less on Advanced', () => expect(planSaving('free', 200000, s)).toEqual({ plan: 'growth', cents: 5100 }));
  it('Free host with $500 sales sees no saving', () => expect(planSaving('free', 50000, s)).toBeNull());
  it('Advanced host with $5,000 sales would pay $50 less on Pro', () => expect(planSaving('growth', 500000, s)).toEqual({ plan: 'pro', cents: 5000 }));
  it('Advanced host at exactly break-even sees nothing', () => expect(planSaving('growth', 250000, s)).toBeNull());
  it('Pro has no next plan', () => expect(planSaving('pro', 900000, s)).toBeNull());
});
describe('first 30 days', () => {
  const now = Date.parse('2026-10-14T00:00:00Z');
  it('active with 10 days left', () => expect(noLimitsPhase('2026-10-24T00:00:00Z', now)).toBe('active'));
  it('ending with 3 days left', () => expect(noLimitsPhase('2026-10-17T00:00:00Z', now)).toBe('ending'));
  it('gone once passed', () => expect(noLimitsPhase('2026-10-13T00:00:00Z', now)).toBeNull());
});
