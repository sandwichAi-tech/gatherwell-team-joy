import type { GwIconName } from '@/components/gw-icon';
import type { FeedGathering } from '@/lib/landing';

/** Host toolkit grouped by outcome. `soon` items are not live and must be labelled as such. */
export type ToolGroup = { key: string; icon: GwIconName; items: { key: string; soon?: boolean }[]; soon?: boolean };
export const TOOLKIT: ToolGroup[] = [
  { key: 'create', icon: 'CalendarPlus', items: [{ key: 'oneTime' }, { key: 'recurring' }, { key: 'retreats' }, { key: 'virtual' }] },
  { key: 'sell', icon: 'CreditCard', soon: true, items: [{ key: 'tickets' }, { key: 'tiers' }, { key: 'addOns' }, { key: 'promo' }, { key: 'courses' }, { key: 'resources' }, { key: 'memberships' }, { key: 'subscriptions' }] },
  { key: 'invite', icon: 'Link2', items: [{ key: 'links' }, { key: 'qr' }, { key: 'email' }, { key: 'sms', soon: true }, { key: 'reminders' }, { key: 'updates' }] },
  { key: 'run', icon: 'QrCode', items: [{ key: 'capacity' }, { key: 'waitlists' }, { key: 'waivers' }, { key: 'guardian' }, { key: 'checkin' }, { key: 'wallet', soon: true }, { key: 'attendance' }] },
  { key: 'teach', icon: 'BookOpen', items: [{ key: 'sections' }, { key: 'lessons' }, { key: 'media' }, { key: 'quizzes', soon: true }, { key: 'progress' }, { key: 'certificates', soon: true }, { key: 'downloads' }] },
  { key: 'grow', icon: 'Network', items: [{ key: 'profile' }, { key: 'teams' }, { key: 'analytics' }, { key: 'payouts', soon: true }, { key: 'exports' }, { key: 'moderation' }, { key: 'support' }] },
];

export const STEPS = ['create', 'share', 'run', 'grow'] as const;
export const AUDIENCES = ['wellness', 'coaches', 'educators', 'fitness', 'retreats', 'creators', 'community'] as const;
export const ATTENDEE = ['discover', 'register', 'tickets', 'learn', 'downloads', 'memberships', 'saved'] as const;

/** Blueprint v4 monthly plans (USD). Annual = two months free. */
export const HOME_PLANS = [
  { id: 'free', monthly: 0 }, { id: 'advanced', monthly: 49 }, { id: 'pro', monthly: 99 },
  { id: 'team25', monthly: 199 }, { id: 'team100', monthly: 499 },
] as const;
export const annualPrice = (monthly: number) => monthly * 10;
export const PLATFORM_FEE_PERCENT = 5;

/** Homepage discovery shows only real, upcoming, public offerings — never samples or fixtures. */
export function homepageOfferings(list: FeedGathering[], now = new Date(), limit = 6): FeedGathering[] {
  const fixture = /\b(sample|test|fixture|demo)\b/i;
  return list
    .filter(g => !g.isSample && g.startsAt.getTime() >= now.getTime() - 2 * 3600_000 && !fixture.test(g.title))
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
    .slice(0, limit);
}

/** No area-alert storage exists yet (planned for Prompt 8), so Notify me is labelled Coming soon. */
export const NOTIFY_ME_LIVE = false;

export const HOME_CTAS = {
  startHosting: { to: '/login', search: { intent: 'host' } },
  explore: { to: '/discover', search: {} },
  createEvent: { to: '/login', search: { intent: 'host' } },
} as const;
