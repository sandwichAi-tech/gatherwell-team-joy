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

/**
 * Approved public plans (USD, 2026-10-24). Annual = two months free (10x monthly).
 * feePct is the ZoheeWell platform fee on paid sales; free offerings have no fee and
 * Stripe processing is separate. seats = builder seats (people who can build or
 * administer the workspace: owner, admins, hosts, content editors). Limited roles
 * (check-in staff, moderators, analysts, members, attendees, learners) never consume
 * a builder seat. Organization is assisted setup ("Contact sales"), not self-service.
 */
export const HOME_PLANS = [
  { id: 'free', monthly: 0, feePct: 5, seats: 3 },
  { id: 'advanced', monthly: 49, feePct: 3, seats: 3 },
  { id: 'pro', monthly: 99, feePct: 2, seats: 5 },
  { id: 'team25', monthly: 199, feePct: 1, seats: 25 },
  { id: 'organization', monthly: 499, feePct: 0.5, seats: 100, contactSales: true, from: true },
] as const;
export type HomePlan = (typeof HOME_PLANS)[number];
export const annualPrice = (monthly: number) => monthly * 10;
/** Highest platform fee any plan pays (Free). Used for conservative "up to" estimates. */
export const MAX_PLATFORM_FEE_PERCENT = 5;

export const HOME_CTAS = {
  startHosting: { to: '/login', search: { intent: 'host' } },
  explore: { to: '/discover', search: {} },
  createEvent: { to: '/login', search: { intent: 'host' } },
} as const;
