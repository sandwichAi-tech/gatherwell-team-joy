import { describe, expect, it } from 'vitest';
import en from '@/locales/en.json';
import es from '@/locales/es.json';
import { NOTIFY_ME_LIVE, HOME_CTAS, HOME_PLANS, PLATFORM_FEE_PERCENT, annualPrice, homepageOfferings } from './homepage';
import { safeReturnPath } from './return-to';
import type { FeedGathering } from './landing';

const now = new Date('2026-11-01T12:00:00Z');
const g = (o: Partial<FeedGathering>): FeedGathering => ({ id: 'x', isSample: false, hero: false, title: 'Morning run', startsAt: new Date('2026-11-02T12:00:00Z'), category: 'run', locationName: null, isOnline: false, lat: null, lng: null, capacity: null, going: 0, goingNames: [], initials: [], hostName: 'H', ...o } as FeedGathering);

describe('homepage discovery', () => {
  it('excludes samples', () => expect(homepageOfferings([g({ isSample: true })], now)).toEqual([]));
  it('excludes past events', () => expect(homepageOfferings([g({ startsAt: new Date('2026-10-30T12:00:00Z') })], now)).toEqual([]));
  it('excludes test/fixture titles', () => expect(homepageOfferings([g({ title: 'Test event' }), g({ title: 'Demo yoga' })], now)).toEqual([]));
  it('keeps real upcoming events, max 6, soonest first', () => {
    const list = Array.from({ length: 8 }, (_, i) => g({ id: `e${i}`, startsAt: new Date(now.getTime() + (8 - i) * 3600_000) }));
    const out = homepageOfferings(list, now);
    expect(out).toHaveLength(6); expect(out[0]!.id).toBe('e7');
  });
  it('empty list stays empty (shows empty state)', () => expect(homepageOfferings([], now)).toEqual([]));
});

describe('homepage pricing', () => {
  it('plans are $0/$49/$99/$199/$499 monthly', () => expect(HOME_PLANS.map(p => p.monthly)).toEqual([0, 49, 99, 199, 499]));
  it('annual is two months free', () => expect(annualPrice(49)).toBe(490));
  it('platform fee is 5%', () => expect(PLATFORM_FEE_PERCENT).toBe(5));
  it('home copy never mentions the retired fee ladder or guest fee', () => {
    for (const l of [en, es]) {
      const text = JSON.stringify(l.home);
      expect(text).not.toMatch(/\b(7|2|0|3)\s?%/);
      expect(text).not.toMatch(/0[.,]49/);
    }
  });
});

describe('homepage CTAs', () => {
  it('Start hosting goes to host sign-in', () => expect(HOME_CTAS.startHosting).toEqual({ to: '/login', search: { intent: 'host' } }));
  it('Explore goes to discover', () => expect(HOME_CTAS.explore.to).toBe('/discover'));
  it('Create an event goes to host sign-in', () => expect(HOME_CTAS.createEvent).toEqual({ to: '/login', search: { intent: 'host' } }));
  it('Notify me is not live (no alert storage yet)', () => expect(NOTIFY_ME_LIVE).toBe(false));
  it('next paths are allowlisted', () => expect(safeReturnPath('/discover')).toBe('/discover'));
  it('empty-state copy exists in both languages', () => { expect(en.home.explore.empty).toBe('Events are coming soon to your area'); expect(es.home.explore.empty).toBeTruthy(); });
});
