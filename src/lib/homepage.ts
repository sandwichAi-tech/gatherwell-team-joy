import type { GwIconName } from '@/components/gw-icon';

/**
 * Homepage marketing carousel slides. Each slide communicates one product value and
 * links to a real destination — never a dead slide. Imagery uses approved site_media
 * category slots only — never event records — so no draft, template, test or
 * non-discoverable content can surface on the public homepage.
 * hrefs are plain paths: /login?intent=host and /login?next=… go through the existing
 * sign-in/onboarding flow (next paths must stay allowlisted in src/lib/return-to.ts
 * and public.is_safe_return_path), /discover tabs are public.
 */
export const CAROUSEL_SLIDES = [
  { key: 'hostEvents', slot: 'feed_default_run', href: '/login?intent=host' },
  { key: 'teach', slot: 'leaders_band', href: '/login?next=/learn' },
  { key: 'discoverEvents', slot: 'feed_default_hike', href: '/discover?tab=events' },
  { key: 'coaches', slot: 'feed_default_walk', href: '/discover?tab=coaches' },
] as const;

/**
 * Host toolkit cards on the homepage. Five purpose-based cards with real routes and
 * truthful availability; the full tool catalog lives on /hosts and (signed in) /tools.
 */
export const HOME_TOOL_CARDS: { key: 'events' | 'learning' | 'communications' | 'profile' | 'payments'; icon: GwIconName; href: string }[] = [
  { key: 'events', icon: 'CalendarPlus', href: '/login?intent=host' },
  { key: 'learning', icon: 'GraduationCap', href: '/login?next=/learn' },
  { key: 'communications', icon: 'Megaphone', href: '/login?next=/communications' },
  { key: 'profile', icon: 'Compass', href: '/login?next=/me' },
  { key: 'payments', icon: 'CreditCard', href: '/pricing' },
];

/** Direct public paths for people browsing wellness — no account needed to look. */
export const HOME_DISCOVER_PATHS: { key: 'events' | 'resources' | 'coaches'; icon: GwIconName; href: string }[] = [
  { key: 'events', icon: 'CalendarCheck', href: '/discover?tab=events' },
  { key: 'resources', icon: 'BookOpen', href: '/discover?tab=resources' },
  { key: 'coaches', icon: 'UsersRound', href: '/discover?tab=coaches' },
];

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
