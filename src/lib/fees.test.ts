import { describe, expect, it } from 'vitest';
import { platformFeeCents, annualPriceCents, ACTIVE_FEE_RULE } from './fees';

describe('Blueprint v4 platform fee', () => {
  it('is a flat 5% on a paid offering', () => {
    expect(platformFeeCents(10000)).toBe(500);
  });
  it('is zero for free offerings', () => {
    expect(platformFeeCents(0)).toBe(0);
  });
  it('has no cap on large sales', () => {
    expect(platformFeeCents(1000000)).toBe(50000);
  });
  it('is the active rule', () => {
    expect(ACTIVE_FEE_RULE).toBe('v4_flat_5');
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
