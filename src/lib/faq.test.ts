import { describe, expect, it } from 'vitest';
import en from '@/locales/en.json';
import es from '@/locales/es.json';
import { FAQ_CATEGORIES, FAQ_ITEM_COUNT, buildFaqJsonLd } from './faq';
import { safeReturnPath } from './return-to';

describe('FAQ structure', () => {
  it('has seven categories and 25 questions', () => {
    expect(FAQ_CATEGORIES.map(c => c.id)).toEqual(['about', 'hosting', 'resources', 'pricing', 'discover', 'teams', 'support']);
    expect(FAQ_ITEM_COUNT).toBe(25);
  });
  it('every category and item has matched EN and ES copy', () => {
    for (const cat of FAQ_CATEGORIES) {
      for (const l of [en, es]) expect(l.faqPage.categories[cat.id]).toBeTruthy();
      for (const item of cat.items) {
        for (const l of [en, es]) {
          const entry = l.faqPage.items[item.id];
          expect(entry.q.length).toBeGreaterThan(8);
          expect(entry.a.length).toBeGreaterThan(40);
        }
      }
    }
  });
  it('item ids are unique', () => {
    const ids = FAQ_CATEGORIES.flatMap(c => c.items.map(i => i.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('FAQ links are real and signed-out safe', () => {
  it('every contextual link is an internal route', () => {
    for (const cat of FAQ_CATEGORIES) for (const item of cat.items) for (const link of item.links ?? []) {
      expect(link.href).toMatch(/^\//);
      expect(link.href).not.toContain('..');
    }
  });
  it('login next targets pass the shared return-path allowlist', () => {
    for (const cat of FAQ_CATEGORIES) for (const item of cat.items) for (const link of item.links ?? []) {
      const next = new URL(link.href, 'https://zoheewell.com').searchParams.get('next');
      if (next) expect(safeReturnPath(next)).toBe(next);
    }
  });
  it('every link label exists in both languages', () => {
    for (const cat of FAQ_CATEGORIES) for (const item of cat.items) for (const link of item.links ?? []) {
      for (const l of [en, es]) expect(l.faqPage.linkLabels[link.labelKey]).toBeTruthy();
    }
  });
  it('public destinations stay public; account routes go through login or the auth gate', () => {
    const hrefs = FAQ_CATEGORIES.flatMap(c => c.items.flatMap(i => (i.links ?? []).map(l => l.href)));
    for (const h of hrefs) {
      if (h.startsWith('/discover') || h === '/pricing') continue; // public
      expect(h.startsWith('/login?') || h === '/support').toBe(true); // login flow or auth-gated with return
    }
  });
});

describe('FAQ copy stays approved and truthful', () => {
  it('uses only the approved plan prices and fee ladder', () => {
    const plans = en.faqPage.items.plans.a;
    expect(plans).toContain('$49/mo');
    expect(plans).toContain('$99/mo');
    expect(plans).toContain('$199/mo');
    expect(plans).toContain('$499/mo');
    const fee = en.faqPage.items.fee.a;
    expect(fee).toContain('5% on Free');
    expect(fee).toContain('0.5% on Organization');
  });
  it('states the founding host offer exactly as approved', () => {
    const f = en.faqPage.items.founding.a;
    expect(f).toContain('six months');
    expect(f).toContain('20% off');
    expect(f).toContain('does not stack');
  });
  it('never mentions the retired fee ladder or guest fee', () => {
    for (const l of [en, es]) {
      const text = JSON.stringify(l.faqPage);
      expect(text).not.toMatch(/\b7\s?%/);
      expect(text).not.toMatch(/0[.,]49/);
    }
  });
  it('is honest about Stripe setup and never promises payouts', () => {
    expect(en.faqPage.items.payout.a).toContain('Stripe connected account');
    expect(en.faqPage.items.paid.a).toContain('Stripe');
    expect(JSON.stringify(en.faqPage)).not.toMatch(/guarantee/i);
  });
});

describe('FAQPage JSON-LD', () => {
  it('is built from the same visible questions and answers', () => {
    const ld = buildFaqJsonLd(en);
    expect(ld['@type']).toBe('FAQPage');
    expect(ld.mainEntity).toHaveLength(FAQ_ITEM_COUNT);
    for (const q of ld.mainEntity) {
      expect(q['@type']).toBe('Question');
      expect(q.name.length).toBeGreaterThan(8);
      expect(q.acceptedAnswer['@type']).toBe('Answer');
      expect(q.acceptedAnswer.text.length).toBeGreaterThan(40);
    }
  });
  it('matches the English SSR content exactly', () => {
    const ld = buildFaqJsonLd(en);
    const first = FAQ_CATEGORIES[0]!.items[0]!;
    expect(ld.mainEntity[0]!.name).toBe(en.faqPage.items[first.id]!.q);
    expect(ld.mainEntity[0]!.acceptedAnswer.text).toBe(en.faqPage.items[first.id]!.a);
  });
});
