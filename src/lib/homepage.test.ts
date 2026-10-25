import { describe, expect, it } from 'vitest';
import en from '@/locales/en.json';
import es from '@/locales/es.json';
import { CAROUSEL_SLIDES, HOME_CTAS, HOME_DISCOVER_PATHS, HOME_PLANS, HOME_TOOL_CARDS, MAX_PLATFORM_FEE_PERCENT, annualPrice } from './homepage';
import { safeReturnPath } from './return-to';

describe('homepage hero copy', () => {
  it('has a concise, specific pitch in English', () => {
    expect(en.home.hero.eyebrow).toBe('For hosts, coaches & community builders');
    expect(en.home.hero.title).toBe('One home for your events, courses, and community.');
    expect(en.home.hero.lede).toContain('events and retreats');
    expect(en.home.hero.lede).toContain('sell tickets');
    expect(en.home.cta.createEvent).toBe('Create an event');
    expect(en.home.cta.discover).toBe('Discover events');
  });
  it('keeps the brand tagline as a small motif, not the headline', () => {
    expect(en.home.hero.tagline).toBe('Life is better together.');
    expect(en.home.hero.title).not.toContain('Life is better together');
  });
  it('has matched Latin American Spanish copy', () => {
    expect(es.home.hero.eyebrow).toBeTruthy();
    expect(es.home.hero.title).toBeTruthy();
    expect(es.home.hero.lede).toBeTruthy();
    expect(es.home.hero.tagline).toBe('La vida es mejor juntos.');
    expect(es.home.cta.createEvent).toBeTruthy();
    expect(es.home.cta.discover).toBeTruthy();
  });
});

describe('homepage carousel', () => {
  it('has four value slides using approved imagery slots, never event records', () => {
    expect(CAROUSEL_SLIDES.map(s => s.key)).toEqual(['hostEvents', 'teach', 'discoverEvents', 'coaches']);
    for (const s of CAROUSEL_SLIDES) expect(s.slot).toMatch(/^[a-z_]+$/);
  });
  it('every slide links to a real destination — no dead slides', () => {
    for (const s of CAROUSEL_SLIDES) {
      expect(s.href).toMatch(/^\/(login\?|discover\?)/);
      // /login?next= targets must pass the shared return-path allowlist.
      const next = new URL(s.href, 'https://zoheewell.com').searchParams.get('next');
      if (next) expect(safeReturnPath(next)).toBe(next);
    }
    // Covers the three required destination types: host an event, build a course, discover.
    expect(CAROUSEL_SLIDES.some(s => s.href === '/login?intent=host')).toBe(true);
    expect(CAROUSEL_SLIDES.some(s => s.href === '/login?next=/learn')).toBe(true);
    expect(CAROUSEL_SLIDES.some(s => s.href.startsWith('/discover?tab=events'))).toBe(true);
    expect(CAROUSEL_SLIDES.some(s => s.href.startsWith('/discover?tab=coaches'))).toBe(true);
  });
  it('every slide has a short caption and CTA in both languages', () => {
    for (const s of CAROUSEL_SLIDES) {
      for (const l of [en, es]) {
        const slide = l.home.carousel.slides[s.key];
        expect(slide.title).toBeTruthy();
        expect(slide.line.length).toBeLessThanOrEqual(48);
        expect(slide.cta).toBeTruthy();
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

describe('homepage host toolkit', () => {
  it('shows five purpose-based tool cards', () => {
    expect(HOME_TOOL_CARDS.map(c => c.key)).toEqual(['events', 'learning', 'communications', 'profile', 'payments']);
  });
  it('every tool card links to a real route with truthful gating', () => {
    for (const c of HOME_TOOL_CARDS) {
      expect(c.href).toMatch(/^\/(login\?|pricing)/);
      const next = new URL(c.href, 'https://zoheewell.com').searchParams.get('next');
      if (next) expect(safeReturnPath(next)).toBe(next);
    }
  });
  it('every tool card has title, body and CTA in both languages', () => {
    for (const c of HOME_TOOL_CARDS) {
      for (const l of [en, es]) {
        const card = l.home.tools.cards[c.key];
        expect(card.title).toBeTruthy();
        expect(card.body).toBeTruthy();
        expect(card.cta).toBeTruthy();
      }
    }
  });
  it('payments copy stays truthful about fees and Stripe setup', () => {
    expect(en.home.tools.cards.payments.body).toContain('5% to 0.5%');
    expect(en.home.tools.cards.payments.body).toContain('Stripe setup');
    expect(es.home.tools.cards.payments.body).toContain('Stripe');
  });
});

describe('homepage discover paths', () => {
  it('offers direct paths to events, resources and coaches tabs', () => {
    expect(HOME_DISCOVER_PATHS.map(p => p.href)).toEqual(['/discover?tab=events', '/discover?tab=resources', '/discover?tab=coaches']);
  });
  it('path labels exist in both languages', () => {
    for (const p of HOME_DISCOVER_PATHS) {
      for (const l of [en, es]) expect(l.home.attend.paths[p.key]).toBeTruthy();
    }
  });
});

describe('homepage stays light', () => {
  it('pricing is a teaser link, not a plan grid', () => {
    expect(en.home.pricing.teaser).toContain('$49');
    expect(es.home.pricing.teaser).toContain('$49');
    expect(en.home.pricing.see).toBeTruthy();
  });
  it('trust is a single assurance line', () => {
    expect(Object.keys(en.home.trust)).toEqual(['line']);
    expect(Object.keys(es.home.trust)).toEqual(['line']);
  });
  it('final CTA is host-first in both languages', () => {
    expect(en.home.final.title).toBe('Ready to host your first event?');
    expect(es.home.final.title).toBeTruthy();
  });
});

describe('homepage pricing', () => {
  it('plans are $0/$49/$99/$199/$499 monthly', () => expect(HOME_PLANS.map(p => p.monthly)).toEqual([0, 49, 99, 199, 499]));
  it('annual is two months free', () => expect(annualPrice(49)).toBe(490));
  it('platform fee ladder is 5/3/2/1/0.5 by plan', () => {
    expect(HOME_PLANS.map(p => p.feePct)).toEqual([5, 3, 2, 1, 0.5]);
    expect(MAX_PLATFORM_FEE_PERCENT).toBe(5);
  });
  it('builder seats are 3/3/5/25/100 and Organization is contact-sales', () => {
    expect(HOME_PLANS.map(p => p.seats)).toEqual([3, 3, 5, 25, 100]);
    const org = HOME_PLANS.find(p => p.id === 'organization')!;
    expect('contactSales' in org && org.contactSales).toBe(true);
  });
  it('home copy never mentions the retired fee ladder or guest fee', () => {
    for (const l of [en, es]) {
      const text = JSON.stringify(l.home);
      expect(text).not.toMatch(/\b7\s?%/);
      expect(text).not.toMatch(/0[.,]49/);
    }
  });
});

describe('homepage CTAs', () => {
  it('Start hosting goes to host sign-in', () => expect(HOME_CTAS.startHosting).toEqual({ to: '/login', search: { intent: 'host' } }));
  it('Explore goes to discover', () => expect(HOME_CTAS.explore.to).toBe('/discover'));
  it('next paths are allowlisted', () => {
    expect(safeReturnPath('/discover')).toBe('/discover');
    expect(safeReturnPath('/learn')).toBe('/learn');
    expect(safeReturnPath('/me')).toBe('/me');
    expect(safeReturnPath('/communications')).toBe('/communications');
  });
});
