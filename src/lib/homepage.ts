import type { GwIconName } from '@/components/gw-icon';

/** Three concise host outcome cards on the homepage; the full tool catalog lives on /hosts. */
export const HOME_TOOL_CARDS: { key: 'createSell' | 'runConnect' | 'teachGrow'; icon: GwIconName }[] = [
  { key: 'createSell', icon: 'CalendarPlus' },
  { key: 'runConnect', icon: 'QrCode' },
  { key: 'teachGrow', icon: 'BookOpen' },
];

/**
 * Marketing carousel slides. These use approved site_media category imagery only —
 * never event records — so no draft, template, test or non-discoverable content can
 * surface on the public homepage.
 */
export const CAROUSEL_SLIDES = [
  { key: 'events', slot: 'feed_default_run' },
  { key: 'retreats', slot: 'feed_default_hike' },
  { key: 'courses', slot: 'leaders_band' },
  { key: 'communities', slot: 'feed_default_walk' },
] as const;

/** Blueprint v4 monthly plans (USD). Annual = two months free. */
export const HOME_PLANS = [
  { id: 'free', monthly: 0 }, { id: 'advanced', monthly: 49 }, { id: 'pro', monthly: 99 },
  { id: 'team25', monthly: 199 }, { id: 'team100', monthly: 499 },
] as const;
export const annualPrice = (monthly: number) => monthly * 10;
export const PLATFORM_FEE_PERCENT = 5;

export const HOME_CTAS = {
  startHosting: { to: '/login', search: { intent: 'host' } },
  explore: { to: '/discover', search: {} },
  createEvent: { to: '/login', search: { intent: 'host' } },
} as const;
