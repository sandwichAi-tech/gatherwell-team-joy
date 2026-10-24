import { describe, expect, it } from 'vitest';
import en from '@/locales/en.json';
import es from '@/locales/es.json';
import { CAROUSEL_SLIDES, HOME_CTAS, HOME_PLANS, HOME_TOOL_CARDS, PLATFORM_FEE_PERCENT, annualPrice } from './homepage';
import { safeReturnPath } from './return-to';

describe('homepage hero copy', () => {
  it('has the approved short pitch in English', () => {
    expect(en.home.hero.eyebrow).toBe('For hosts, creators & community builders');
    expect(en.home.hero.title).toBe("Bring people together. We'll handle the rest.");
    expect(en.home.hero.lede).toContain('events, retreats, courses, and memberships');
    expect(en.home.cta.startFree).toBe('Start hosting free');
    expect(en.home.cta.explore).toBe("Explore what's happening");
  });
  it('keeps the brand tagline as a small motif, not the headline', () => {
    expect(en.home.hero.tagline).toBe('Life is better together.');
    expect(en.home.hero.title).not.toContain('Life is better together');
  });
  it('has matched Latin American Spanish copy', () => {
    expect(es.home.hero.eyebrow).toBeTruthy();
    expect(es.home.hero.title).toBeTruthy();
    expect(es.home.hero.tagline).toBe('La vida es mejor juntos.');
    expect(es.home.cta.startFree).toBeTruthy();
    expect(es.home.cta.explore).toBeTruthy();
  });
});

describe('homepage carousel', () => {
  it('has four category slides using approved imagery slots, never event records', () => {
    expect(CAROUSEL_SLIDES.map(s => s.key)).toEqual(['events', 'retreats', 'courses', 'communities']);
    for (const s of CAROUSEL_SLIDES) expect(s.slot).toMatch(/^[a-z_]+$/);
  });
  it('every slide has a short caption in both languages', () => {
    for (const s of CAROUSEL_SLIDES) {
      for (const l of [en, es]) {
        const slide = l.home.carousel.slides[s.key];
        expect(slide.title).toBeTruthy();
        expect(slide.line.length).toBeLessThanOrEqual(40);
      }
    }
  });
  it('has accessible control labels in both languages', () => {
    for (const l of [en, es]) {
      expect(l.home.carousel.label).toBeTruthy();
      expect(l.home.carousel.prev).toBeTruthy();
      expect(l.home.carousel.next).toBeTruthy();
      expect(l.home.carousel.slideOf).toContain('{{n}}');
      expect(l.home.carousel.slideOf).toContain('{{count}}');
    }
  });
});

describe('homepage stays light', () => {
  it('offers exactly three host tool cards', () => expect(HOME_TOOL_CARDS).toHaveLength(3));
  it('pricing is a teaser link, not a plan grid', () => {
    expect(en.home.pricing.teaser).toContain('$49');
    expect(es.home.pricing.teaser).toContain('$49');
    expect(en.home.pricing.see).toBeTruthy();
  });
  it('trust is a single assurance line', () => {
    expect(Object.keys(en.home.trust)).toEqual(['line']);
    expect(Object.keys(es.home.trust)).toEqual(['line']);
  });
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
  it('next paths are allowlisted', () => expect(safeReturnPath('/discover')).toBe('/discover'));
});
