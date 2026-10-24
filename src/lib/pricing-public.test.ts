import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import en from '@/locales/en.json';
import es from '@/locales/es.json';
import { HOME_PLANS, annualPrice } from './homepage';

const src = readFileSync('src/components/landing/marketing-pages.tsx', 'utf8');
const pricingPage = src.slice(src.indexOf('export function PricingPage'), src.indexOf('\n', src.indexOf('export function PricingPage')));
const approved = readFileSync('src/components/landing/approved-pricing.tsx', 'utf8');
const comparison = readFileSync('src/components/landing/plan-comparison.tsx', 'utf8');

describe('public pricing (approved 2026-10-24 model)', () => {
  it('exact monthly prices', () => expect(Object.fromEntries(HOME_PLANS.map(p => [p.id, p.monthly]))).toEqual({ free: 0, advanced: 49, pro: 99, team25: 199, organization: 499 }));
  it('annual is 10x monthly', () => expect(HOME_PLANS.map(p => annualPrice(p.monthly))).toEqual([0, 490, 990, 1990, 4990]));
  it('per-plan fee ladder copy, Stripe separate, free has no fee', () => {
    expect(en.pricingV4.feeDisclosure).toMatch(/5% Free.*3% Advanced.*2% Pro.*1% Team 25.*0\.5% Organization.*Free offerings have no fee.*Stripe processing is separate/);
    expect(es.pricingV4.feeDisclosure).toMatch(/5% Gratis.*3% Avanzado.*2% Pro.*1% Equipo 25.*0\.5% Organización.*Stripe/);
  });
  it('founding terms are complete and non-stacking', () => {
    for (const s of ['six months', 'no card', 'no automatic conversion', '30 days', '20% off your first paid year', 'by the end of access', 'does not stack']) expect(en.home.pricing.founding).toContain(s);
    for (const s of ['seis meses', 'sin tarjeta', '30 días', '20%', 'no se combina']) expect(es.home.pricing.founding).toContain(s);
  });
  it('no retired flat-fee, cap or guest service fee claims in public pricing copy', () => {
    for (const l of [en, es]) {
      const text = JSON.stringify([l.pricingV4, l.home.pricing, l.marketing.pricingSub]);
      expect(text).not.toMatch(/flat 5%|tarifa fija/i);
      expect(text).not.toMatch(/\b7\s?%|0[.,]49|\bcap\b|tope/i);
    }
  });
  it('pricing page uses the approved plans, comparison chart and which-plan guide', () => {
    expect(pricingPage).toContain('ApprovedPlans');
    expect(pricingPage).toContain('BuilderSeatExplainer');
    expect(pricingPage).toContain('PlanComparison');
    expect(pricingPage).toContain('WhichPlan');
    expect(pricingPage).not.toMatch(/PricingCards|WhatYouPay|pricingFaq/);
  });
  it('plan cards have a billing toggle and per-plan fee and seat lines', () => {
    expect(approved).toContain('BillingToggle');
    expect(approved).toContain('pricingV4.feeLine');
    expect(approved).toContain('pricingV4.seatsLine');
  });
  it('Organization uses a truthful contact-sales path, never checkout', () => {
    expect(approved).toContain("CONTACT_SALES_HREF = 'mailto:");
    expect(approved).toContain('pricingV4.contactSales');
    expect(approved).not.toMatch(/organization[\s\S]{0,200}startPlanCheckout/);
  });
  it('comparison chart covers the required rows with text, not color alone', () => {
    for (const k of ['seats', 'fee', 'events', 'courses', 'memberships', 'tickets', 'checkin', 'roles', 'analytics', 'exports', 'support', 'sms', 'payments']) {
      expect(comparison).toContain(`key: '${k}'`);
      expect(en.pricingV4.compare.rows[k as keyof typeof en.pricingV4.compare.rows]).toBeTruthy();
    }
    expect(comparison).toContain('pricingV4.compare.included');
    expect(comparison).toContain('note_setup');
    expect(comparison).toContain('note_usage');
  });
  it('provider-dependent rows are honest in both languages', () => {
    expect(en.pricingV4.compare.note_setup).toBe('Setup required');
    expect(en.pricingV4.compare.note_usage).toBe('Usage priced separately');
    expect(es.pricingV4.compare.note_setup).toBeTruthy();
    expect(es.pricingV4.compare.note_usage).toBeTruthy();
  });
  it('Start hosting CTA targets host sign-in', () => {
    expect(approved).toContain(`to="/login" search={{ intent: 'host' }}`);
  });
  it('pricing keys match between languages', () => {
    const keys = (o: unknown, p = ''): string[] => o && typeof o === 'object' ? Object.entries(o).flatMap(([k, v]) => keys(v, `${p}.${k}`)) : [p];
    expect(keys(es.pricingV4)).toEqual(keys(en.pricingV4));
  });
});
