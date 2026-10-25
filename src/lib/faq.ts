/**
 * Public FAQ content model. Questions and answers live in the locale files under
 * `faqPage` (EN + Latin-American ES); this module defines the structure, the
 * contextual links, and the FAQPage JSON-LD built from the same visible copy.
 *
 * Link rules: signed-out visitors must never hit a dead/private route. /login
 * links carry intent or an allowlisted next path (src/lib/return-to.ts and
 * public.is_safe_return_path); /support is behind the signed-in gate, which
 * redirects to /login?next=/support automatically.
 */
export type FaqLink = { labelKey: string; href: string };
export type FaqItemDef = { id: string; links?: FaqLink[] };
export type FaqCategoryDef = { id: string; items: FaqItemDef[] };

export const FAQ_CATEGORIES: FaqCategoryDef[] = [
  {
    id: 'about',
    items: [
      { id: 'whatIs', links: [{ labelKey: 'discover', href: '/discover' }] },
      { id: 'whoFor' },
      { id: 'cost', links: [{ labelKey: 'pricing', href: '/pricing' }, { labelKey: 'discover', href: '/discover' }] },
    ],
  },
  {
    id: 'hosting',
    items: [
      { id: 'create', links: [{ labelKey: 'createEvent', href: '/login?intent=host' }] },
      { id: 'rsvp' },
      { id: 'checkin' },
      { id: 'reminders', links: [{ labelKey: 'communications', href: '/login?next=/communications' }] },
      { id: 'retreats' },
    ],
  },
  {
    id: 'resources',
    items: [
      { id: 'types', links: [{ labelKey: 'startBuilding', href: '/login?next=/learn' }] },
      { id: 'paid' },
      { id: 'templates' },
    ],
  },
  {
    id: 'pricing',
    items: [
      { id: 'plans', links: [{ labelKey: 'pricing', href: '/pricing' }] },
      { id: 'fee' },
      { id: 'founding' },
      { id: 'payout' },
      { id: 'refunds' },
      { id: 'sms' },
    ],
  },
  {
    id: 'discover',
    items: [
      { id: 'find', links: [{ labelKey: 'discover', href: '/discover' }, { labelKey: 'coaches', href: '/discover?tab=coaches' }] },
      { id: 'coachProfile', links: [{ labelKey: 'coaches', href: '/discover?tab=coaches' }] },
      { id: 'location' },
      { id: 'account' },
    ],
  },
  {
    id: 'teams',
    items: [
      { id: 'team' },
      { id: 'whoManages' },
    ],
  },
  {
    id: 'support',
    items: [
      { id: 'help', links: [{ labelKey: 'support', href: '/support' }] },
      { id: 'trouble', links: [{ labelKey: 'support', href: '/support' }] },
    ],
  },
];

export const FAQ_ITEM_COUNT = FAQ_CATEGORIES.reduce((n, c) => n + c.items.length, 0);

type FaqLocale = { faqPage: { items: Record<string, { q: string; a: string }> } };

/**
 * FAQPage JSON-LD built from the same visible questions and answers (text only —
 * contextual links are stripped). The public page server-renders in English, so the
 * schema is generated from the English locale to match the SSR'd content exactly.
 */
export function buildFaqJsonLd(locale: FaqLocale) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_CATEGORIES.flatMap(cat =>
      cat.items.map(item => ({
        '@type': 'Question',
        name: locale.faqPage.items[item.id]?.q ?? '',
        acceptedAnswer: { '@type': 'Answer', text: locale.faqPage.items[item.id]?.a ?? '' },
      })),
    ),
  };
}
