import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import en from '@/locales/en.json';
import es from '@/locales/es.json';
import { HOME_PLANS, PLATFORM_FEE_PERCENT } from './homepage';

const planPage = readFileSync('src/components/plan-page.tsx', 'utf8');
const marketing = readFileSync('src/components/landing/marketing-pages.tsx', 'utf8');
const approved = readFileSync('src/components/landing/approved-pricing.tsx', 'utf8');

describe('pricing consistency (Blueprint v4)', () => {
  it('hosts and studios pages show the approved fee disclosure', () => {
    const hosts = marketing.slice(marketing.indexOf('export function HostsPage'), marketing.indexOf('export function PricingPage'));
    const studios = marketing.slice(marketing.indexOf('function StudiosPricing'), marketing.indexOf('export function StudiosPage'));
    expect(hosts).toContain('<FeeDisclosure/>');
    expect(studios).toContain('<FeeDisclosure />');
    expect(approved).toMatch(/export function FeeDisclosure[\s\S]*PLATFORM_FEE_PERCENT/);
    expect(PLATFORM_FEE_PERCENT).toBe(5);
  });
  it('signed-in prospective cards show approved prices and the flat 5% fee', () => {
    expect(planPage).toContain('free: 0, growth: 4900, pro: 9900');
    expect(planPage).toContain('V4_FEE_PERCENT = 5');
    expect(planPage).toContain('monthly_price: V4_MONTHLY_CENTS[p.id], fee_percent: V4_FEE_PERCENT');
    expect(HOME_PLANS.map(p => p.monthly)).toEqual([0, 49, 99, 199, 499]);
  });
  it('paid plan checkout stays disabled as setup required, never faking success', () => {
    expect(planPage).toContain(`{t('pricingV4.setupRequired')}`);
    expect(planPage).not.toMatch(/gate\.connected \? <Button disabled=\{gate\.busy\} onClick=\{\(\) => choose\('growth'\)\}/);
  });
  it('legacy and current subscriptions keep their real status', () => {
    expect(planPage).toContain('legacyNote');
    expect(planPage).toContain('st.legacy_price_cents');
    expect(planPage).toContain('cancel_at_period_end');
    expect(planPage).toContain('pending_plan');
  });
  it('no old fee ladder or cap copy is rendered on the plan screen', () => {
    expect(planPage).not.toContain('getPaidCapped');
    expect(planPage).not.toContain('getPaidText');
    expect(planPage).not.toContain('settings[p.id]');
    expect(planPage).not.toContain('planSaving');
  });
  it('annual note and fee copy exist in both languages with matching terms', () => {
    expect(en.billing.v4AnnualNote).toMatch(/10 times the monthly price.*two months free.*may change after the pilot/);
    expect(es.billing.v4AnnualNote).toMatch(/10 veces el precio mensual.*dos meses gratis.*pueden cambiar después del piloto/);
    expect(en.home.pricing.fee).toContain('{{pct}}%');
    expect(es.home.pricing.fee).toContain('{{pct}}%');
  });
  it('billing keys stay in parity between English and Spanish', () => {
    const keys = (o: unknown, p = ''): string[] => o && typeof o === 'object' ? Object.entries(o).flatMap(([k, v]) => keys(v, `${p}.${k}`)) : [p];
    expect(keys(es.billing)).toEqual(keys(en.billing));
  });
});
