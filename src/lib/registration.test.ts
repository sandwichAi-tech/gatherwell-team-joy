import { describe, expect, it } from 'vitest';
import { defaultTier, needsTier, registrationReady, tierSpotsLeft, tierState, type TicketTier } from './registration';

const free: TicketTier = { id: 'a', name: 'General', price_cents: 0 };
const paid: TicketTier = { id: 'b', name: 'VIP', price_cents: 2500 };
const now = new Date('2026-10-24T12:00:00Z');

describe('tierState', () => {
  it('closes at the exact sales-end instant', () => {
    expect(tierState({ ...free, sale_ends_at: now.toISOString() }, now)).toBe('ended');
  });
  it('blocks paid tiers as setup required until checkout is configured', () => {
    expect(tierState(paid, now)).toBe('setup_required');
  });
  it('opens a free tier with no window or quantity', () => {
    expect(tierState(free, now)).toBe('open');
  });
  it('respects the sale window', () => {
    expect(tierState({ ...free, sale_starts_at: '2026-10-25T00:00:00Z' }, now)).toBe('not_yet');
    expect(tierState({ ...free, sale_ends_at: '2026-10-23T00:00:00Z' }, now)).toBe('ended');
    expect(tierState({ ...free, sale_starts_at: '2026-10-23T00:00:00Z', sale_ends_at: '2026-10-25T00:00:00Z' }, now)).toBe('open');
  });
  it('marks a full tier sold out', () => {
    expect(tierState({ ...free, quantity: 10, sold: 10 }, now)).toBe('sold_out');
    expect(tierState({ ...free, quantity: 10, sold: 9 }, now)).toBe('open');
  });
  it('keeps paid tiers blocked even when their window is open', () => {
    expect(tierState({ ...paid, sale_starts_at: '2026-10-23T00:00:00Z' }, now)).toBe('setup_required');
  });
});

describe('needsTier / defaultTier', () => {
  it('only requires a tier when the event defines them', () => {
    expect(needsTier(null)).toBe(false);
    expect(needsTier([])).toBe(false);
    expect(needsTier([free])).toBe(true);
  });
  it('preselects the first bookable free tier, skipping paid and full ones', () => {
    expect(defaultTier([paid, { ...free, quantity: 1, sold: 1 }, free], now)).toBe('a');
    expect(defaultTier([paid], now)).toBeNull();
    expect(defaultTier(null, now)).toBeNull();
  });
});

describe('registrationReady', () => {
  it('requires platform terms consent for every registration', () => {
    expect(registrationReady({ terms: false, tierId: null })).toBe(false);
    expect(registrationReady({ terms: true, tierId: null })).toBe(true);
  });
  it('requires a chosen bookable tier on tiered events', () => {
    expect(registrationReady({ terms: true, tiers: [free], tierId: null }, )).toBe(false);
    expect(registrationReady({ terms: true, tiers: [free], tierId: 'a' })).toBe(true);
    expect(registrationReady({ terms: true, tiers: [paid], tierId: 'b' })).toBe(false);
    expect(registrationReady({ terms: true, tiers: [free], tierId: 'nope' })).toBe(false);
  });
});

describe('tierSpotsLeft', () => {
  it('is null for unlimited tiers and never negative', () => {
    expect(tierSpotsLeft(free)).toBeNull();
    expect(tierSpotsLeft({ ...free, quantity: 5, sold: 3 })).toBe(2);
    expect(tierSpotsLeft({ ...free, quantity: 5, sold: 8 })).toBe(0);
  });
});
