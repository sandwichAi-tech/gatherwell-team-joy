import { describe, expect, it } from 'vitest';
import { platformFeeCents, planFeeCents, feeRuleForPlan, annualPriceCents, ACTIVE_FEE_RULE, PLAN_FEE_RULES } from './fees';

describe('approved per-plan platform fee ladder (2026-10-24)', () => {
  it('Free pays 5% on a paid offering', () => {
    expect(planFeeCents(10000, 'free')).toBe(500);
  });
  it('Advanced pays 3%', () => {
    expect(planFeeCents(10000, 'advanced')).toBe(300);
    expect(planFeeCents(10000, 'growth')).toBe(300);
  });
  it('Pro pays 2%', () => {
    expect(planFeeCents(10000, 'pro')).toBe(200);
  });
  it('Team 25 pays 1%', () => {
    expect(planFeeCents(10000, 'team25')).toBe(100);
  });
  it('Organization pays 0.5%', () => {
    expect(planFeeCents(10000, 'organization')).toBe(50);
    expect(planFeeCents(10000, 'team100')).toBe(50);
  });
  it('is zero for free offerings on every plan', () => {
    for (const p of ['free', 'advanced', 'pro', 'team25', 'organization']) expect(planFeeCents(0, p)).toBe(0);
  });
  it('unknown plans fall back to the Free rate', () => {
    expect(feeRuleForPlan('unknown').id).toBe('v5_free_5');
    expect(ACTIVE_FEE_RULE).toBe('v5_free_5');
  });
  it('the ladder decreases monotonically', () => {
    const order = ['free', 'advanced', 'pro', 'team25', 'organization'];
    const pcts = order.map(p => feeRuleForPlan(p).percent);
    expect(pcts).toEqual([5, 3, 2, 1, 0.5]);
    for (let i = 1; i < pcts.length; i++) expect(pcts[i]!).toBeLessThan(pcts[i - 1]!);
  });
  it('every plan maps to a v5 rule', () => {
    for (const id of Object.values(PLAN_FEE_RULES)) expect(id).toMatch(/^v5_/);
  });
  it('has no cap on large sales', () => {
    expect(platformFeeCents(1000000, 'v5_free_5')).toBe(50000);
  });
});

describe('historical fee rules stay reproducible', () => {
  it('legacy free plan keeps 7% with its $99 cap', () => {
    expect(platformFeeCents(10000, 'legacy_free_7')).toBe(700);
    expect(platformFeeCents(500000, 'legacy_free_7')).toBe(9900);
  });
  it('legacy pro plan stays 0%', () => {
    expect(platformFeeCents(10000, 'legacy_pro_0')).toBe(0);
  });
  it('legacy guest service fee is 3% + 49 cents', () => {
    expect(platformFeeCents(2000, 'legacy_guest_service_3_49')).toBe(109);
  });
});

describe('annual pricing', () => {
  it('equals ten months', () => {
    expect(annualPriceCents(9900)).toBe(99000);
  });
});
