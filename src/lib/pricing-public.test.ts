import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import en from '@/locales/en.json';
import es from '@/locales/es.json';
import { HOME_PLANS, annualPrice, PLATFORM_FEE_PERCENT } from './homepage';

const src = readFileSync('src/components/landing/marketing-pages.tsx', 'utf8');
const pricingPage = src.slice(src.indexOf('export function PricingPage'), src.indexOf('\n', src.indexOf('export function PricingPage')));

describe('public pricing (Blueprint v4)', () => {
  it('exact monthly prices', () => expect(Object.fromEntries(HOME_PLANS.map(p => [p.id, p.monthly]))).toEqual({ free: 0, advanced: 49, pro: 99, team25: 199, team100: 499 }));
  it('annual is 10x monthly', () => expect(HOME_PLANS.map(p => annualPrice(p.monthly))).toEqual([0, 490, 990, 1990, 4990]));
  it('5% fee copy, Stripe separate, free has no fee', () => {
    expect(PLATFORM_FEE_PERCENT).toBe(5);
    expect(en.home.pricing.fee).toMatch(/\{\{pct\}\}%.*Free offerings have no fee.*Stripe processing is separate/);
    expect(es.home.pricing.fee).toMatch(/\{\{pct\}\}%.*Stripe/);
  });
  it('founding terms are complete', () => {
    for (const s of ['six months', 'no card', 'no automatic conversion', '30 days', '20% off your first paid year', 'by the end of access', 'does not stack']) expect(en.home.pricing.founding).toContain(s);
    for (const s of ['seis meses', 'sin tarjeta', '30 días', '20%', 'no se combina']) expect(es.home.pricing.founding).toContain(s);
  });
  it('no old fee ladder, caps or guest service fee in public pricing copy', () => {
    for (const l of [en, es]) {
      const text = JSON.stringify([l.pricingV4, l.home.pricing, l.marketing.pricingSub]);
      expect(text).not.toMatch(/\b(7|2|0|3)\s?%|0[.,]49|\bcap\b|tope/i);
    }
  });
  it('pricing page no longer uses the old plan table/cards', () => {
    expect(pricingPage).not.toMatch(/PricingCards|WhatYouPay|pricingFaq/);
    expect(pricingPage).toContain('ApprovedPlans');
  });
  it('Start hosting CTA targets host sign-in', () => {
    const c = readFileSync('src/components/landing/approved-pricing.tsx', 'utf8');
    expect(c).toContain(`to="/login" search={{ intent: 'host' }}`);
  });
  it('pricing keys match between languages', () => {
    const keys = (o: unknown, p = ''): string[] => o && typeof o === 'object' ? Object.entries(o).flatMap(([k, v]) => keys(v, `${p}.${k}`)) : [p];
    expect(keys(es.pricingV4)).toEqual(keys(en.pricingV4));
  });
});
