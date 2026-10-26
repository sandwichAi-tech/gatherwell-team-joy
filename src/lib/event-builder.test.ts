import { describe, expect, it } from 'vitest';
import { capacityValue, validHttps, canTransition, cleanAddons, cleanTiers, emptyTier, feeEstimateCents, hostKeepsCents, minorBandAllowed, parseTags, readinessBlockers, regWindowState, type ReadinessInput } from './event-builder';
import { MAX_PLATFORM_FEE_PERCENT } from './homepage';
import en from '@/locales/en.json';
import es from '@/locales/es.json';

const okInput: ReadinessInput = {
  title: 'Sunrise yoga', startsAt: '2026-11-01T08:00', format: 'person',
  locationName: 'Park', address: '', onlineUrl: '', priceCents: null, canSell: false,
  regOpens: '', regCloses: '', retreatOn: false, retreatEnd: '', allowsMinors: false, minAge: '', tiers: [],
};

describe('parseTags', () => {
  it('normalizes, dedupes and caps tags', () => {
    expect(parseTags('Yoga, yoga , Beginner,,Outdoor')).toEqual(['yoga', 'beginner', 'outdoor']);
    expect(parseTags('a,b,c,d,e,f,g,h,i,j')).toHaveLength(8);
    expect(parseTags('x'.repeat(40))[0]).toHaveLength(24);
  });
});

describe('explicit capacity modes', () => {
  it('stores unlimited distinctly as null even with a previous limit', () => {
    expect(capacityValue('unlimited', '20')).toBeNull();
  });
  it('requires a positive integer only for limited mode', () => {
    expect(capacityValue('limited', '')).toBeUndefined();
    expect(capacityValue('limited', '0')).toBeUndefined();
    expect(capacityValue('limited', '1.5')).toBeUndefined();
    expect(capacityValue('limited', '20')).toBe(20);
  });
});

describe('event link validation', () => {
  it('requires an HTTPS destination without embedded credentials', () => {
    expect(validHttps('https://meet.example.com/room')).toBe(true);
    expect(validHttps('https://')).toBe(false);
    expect(validHttps('https://user:pass@example.com')).toBe(false);
  });
});

describe('regWindowState', () => {
  const now = new Date('2026-06-15T12:00:00Z');
  it('reports not_open, open and closed', () => {
    expect(regWindowState('2026-06-20T00:00:00Z', null, now)).toBe('not_open');
    expect(regWindowState('2026-06-10T00:00:00Z', '2026-06-20T00:00:00Z', now)).toBe('open');
    expect(regWindowState(null, '2026-06-14T00:00:00Z', now)).toBe('closed');
    expect(regWindowState(null, null, now)).toBe('open');
  });
});

describe('readinessBlockers', () => {
  it('passes a complete free in-person event', () => {
    expect(readinessBlockers(okInput)).toEqual([]);
  });
  it('flags missing title, date and place', () => {
    const b = readinessBlockers({ ...okInput, title: ' ', startsAt: '', locationName: '', address: '' });
    expect(b).toEqual(['title', 'date', 'place']);
  });
  it('requires a valid https link for online and hybrid', () => {
    expect(readinessBlockers({ ...okInput, format: 'online', onlineUrl: 'http://x' })).toContain('online_link');
    expect(readinessBlockers({ ...okInput, format: 'hybrid', onlineUrl: '' })).toContain('online_link');
    expect(readinessBlockers({ ...okInput, format: 'hybrid', onlineUrl: 'https://meet.example.com/x' })).toEqual([]);
  });
  it('flags an inverted registration window and bad retreat dates', () => {
    expect(readinessBlockers({ ...okInput, regOpens: '2026-06-10T10:00', regCloses: '2026-06-09T10:00' })).toContain('reg_window');
    expect(readinessBlockers({ ...okInput, retreatOn: true, retreatEnd: '' })).toContain('retreat_dates');
  });
  it('blocks paid publish without payouts and invalid tiers', () => {
    expect(readinessBlockers({ ...okInput, priceCents: 2500, canSell: false })).toContain('payouts');
    expect(readinessBlockers({ ...okInput, priceCents: 2500, canSell: true })).toEqual([]);
    expect(readinessBlockers({ ...okInput, tiers: [{ ...emptyTier(), name: '' }] })).toContain('tier_invalid');
  });
  it('flags min age without allowing minors', () => {
    expect(readinessBlockers({ ...okInput, minAge: '12' })).toContain('min_age');
    expect(readinessBlockers({ ...okInput, allowsMinors: true, minAge: '12' })).toEqual([]);
    expect(readinessBlockers({ ...okInput, allowsMinors: true, minAge: '19' })).toContain('min_age');
  });
});

describe('fee estimate', () => {
  it('uses the flat 5% platform fee', () => {
    expect(MAX_PLATFORM_FEE_PERCENT).toBe(5);
    expect(feeEstimateCents(2000)).toBe(100);
    expect(feeEstimateCents(2000, 'pro')).toBe(40);
    expect(hostKeepsCents(2000)).toBe(1900);
    expect(feeEstimateCents(0)).toBe(0);
  });
});

describe('cleanTiers / cleanAddons', () => {
  it('accepts valid tiers and rejects bad ones', () => {
    const good = cleanTiers([{ id: 'a', name: 'Early bird', price_cents: 1500, quantity: 20, sale_starts_at: null, sale_ends_at: null }]);
    expect(good).toHaveLength(1);
    expect(cleanTiers([{ id: 'a', name: '', price_cents: 1500, quantity: null, sale_starts_at: null, sale_ends_at: null }])).toBeNull();
    expect(cleanTiers([{ id: 'a', name: 'X', price_cents: -5, quantity: null, sale_starts_at: null, sale_ends_at: null }])).toBeNull();
    expect(cleanTiers([{ id: 'a', name: 'X', price_cents: 100, quantity: null, sale_starts_at: '2026-06-10T10:00', sale_ends_at: '2026-06-09T10:00' }])).toBeNull();
    expect(cleanTiers(Array.from({ length: 7 }, (_, i) => ({ id: String(i), name: `T${i}`, price_cents: 0, quantity: null, sale_starts_at: null, sale_ends_at: null })))).toBeNull();
  });
  it('accepts valid add-ons and rejects bad ones', () => {
    expect(cleanAddons([{ id: 'a', name: 'Mat rental', price_cents: 500 }])).toHaveLength(1);
    expect(cleanAddons([{ id: 'a', name: ' ', price_cents: 500 }])).toBeNull();
  });
  it('stores sales dates as absolute instants and preserves optional blank dates', () => {
    const rows = cleanTiers([{ ...emptyTier(), name: 'Early', sale_starts_at: '2026-11-01T10:00:00-06:00', sale_ends_at: null }]);
    expect(rows?.[0]?.sale_starts_at).toBe('2026-11-01T16:00:00.000Z');
    expect(rows?.[0]?.sale_ends_at).toBeNull();
  });
  it('rejects malformed dates and fractional tier quantities', () => {
    expect(cleanTiers([{ ...emptyTier(), name: 'Early', sale_starts_at: 'invalid' }])).toBeNull();
    expect(cleanTiers([{ ...emptyTier(), name: 'Early', quantity: 1.5 }])).toBeNull();
  });
});

describe('minorBandAllowed', () => {
  it('mirrors the database min-age rule', () => {
    expect(minorBandAllowed(null, 'under_5')).toBe(true);
    expect(minorBandAllowed(5, 'under_5')).toBe(false);
    expect(minorBandAllowed(5, '5_12')).toBe(true);
    expect(minorBandAllowed(13, '5_12')).toBe(false);
    expect(minorBandAllowed(13, '13_17')).toBe(true);
  });
});

describe('canTransition', () => {
  it('allows publish, unpublish and archive paths hosts use', () => {
    expect(canTransition('draft', 'published')).toBe(true);
    expect(canTransition('published', 'draft')).toBe(true);
    expect(canTransition('published', 'archived')).toBe(true);
    expect(canTransition('archived', 'draft')).toBe(true);
    expect(canTransition('cancelled', 'archived')).toBe(false);
    expect(canTransition('draft', 'draft')).toBe(false);
  });
});

describe('builder locale parity', () => {
  const keys = (o: Record<string, unknown>, p = ''): string[] => Object.entries(o).flatMap(([k, v]) => v && typeof v === 'object' ? keys(v as Record<string, unknown>, `${p}${k}.`) : [`${p}${k}`]);
  it('matches builder, guest.minor and new guest.errors keys across en and es', () => {
    expect(keys(es.builder as Record<string, unknown>).sort()).toEqual(keys(en.builder as Record<string, unknown>).sort());
    expect(keys(es.guest.minor as Record<string, unknown>).sort()).toEqual(keys(en.guest.minor as Record<string, unknown>).sort());
    for (const k of ['minors_not_allowed', 'minor_details_incomplete', 'guardian_details_incomplete', 'guardian_consent_required', 'min_age_not_met', 'registration_not_open', 'registration_closed']) {
      expect(es.guest.errors[k as keyof typeof es.guest.errors]).toBeTruthy();
      expect(en.guest.errors[k as keyof typeof en.guest.errors]).toBeTruthy();
    }
    expect(en.teamSpace.status.archived).toBeTruthy();
    expect(es.teamSpace.status.archived).toBeTruthy();
  });
  it('keeps retired fee language out of builder copy', () => {
    const s = JSON.stringify(en.builder) + JSON.stringify(es.builder);
    expect(s).not.toMatch(/7%|2%|0%\s*ladder|service fee/i);
    expect(en.builder.platformFee).toContain('5%');
  });
});
