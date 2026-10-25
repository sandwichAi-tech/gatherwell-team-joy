/** Pure mirrors of the referral rules enforced in migration 0119. The database is authoritative; these keep UI previews and tests honest. */
export type RewardKind = 'percent' | 'flat';
export type RewardStatus = 'pending' | 'available' | 'paid' | 'reversed';
export const REFERRAL_WINDOW_DAYS = 30;
export const MAX_PERCENT = 90;
export const CODE_RE = /^[A-HJ-NP-Z2-9]{8}$/;

/** Mirrors public.referral_reward_cents: never exceeds the sale. */
export function rewardCents(kind: RewardKind, value: number, saleCents: number): number {
  if (!(saleCents > 0) || !(value > 0)) return 0;
  if (kind === 'percent') return Math.floor((saleCents * Math.min(value, MAX_PERCENT)) / 100);
  return Math.min(Math.round(value), saleCents);
}

export type RewardError = 'invalid' | 'percentTooHigh' | 'flatTooHigh' | 'notPaid';
/** Mirrors save_referral_program validation. value is a percent or cents. */
export function validateReward(kind: RewardKind, value: number, priceCents: number | null): RewardError | null {
  if (!priceCents || priceCents <= 0) return 'notPaid';
  if (!Number.isFinite(value) || value <= 0 || !Number.isInteger(value)) return 'invalid';
  if (kind === 'percent' && value > MAX_PERCENT) return 'percentTooHigh';
  if (kind === 'flat' && value >= priceCents) return 'flatTooHigh';
  return null;
}

export type Click = { id: number; referrerId: string; userId: string | null; at: Date };
export type AttributionInput = { clicks: Click[]; buyerId: string; hostId: string; orderAt: Date; sharesTeam: (a: string, b: string) => boolean; windowDays?: number };
/** Mirrors referral_attribute_order: last valid click by the buyer in the window; self, host and shared-team referrers never win. */
export function attribute({ clicks, buyerId, hostId, orderAt, sharesTeam, windowDays = REFERRAL_WINDOW_DAYS }: AttributionInput): Click | null {
  const start = orderAt.getTime() - windowDays * 86_400_000;
  const valid = clicks.filter(c => c.userId === buyerId && c.at.getTime() <= orderAt.getTime() && c.at.getTime() > start
    && c.referrerId !== buyerId && c.referrerId !== hostId && !sharesTeam(c.referrerId, buyerId));
  valid.sort((a, b) => b.at.getTime() - a.at.getTime() || b.id - a.id);
  return valid[0] ?? null;
}

export type OrderStatus = 'pending' | 'paid' | 'partially_refunded' | 'refunded' | 'cancelled' | 'failed' | 'disputed';
/** Mirrors orders_referral_hook + referral_reverse_order: refunds reverse only rewards not yet paid out. */
export function nextRewardStatus(current: RewardStatus, order: OrderStatus): RewardStatus {
  if (['refunded', 'cancelled', 'disputed', 'failed'].includes(order) && (current === 'pending' || current === 'available')) return 'reversed';
  return current;
}

export function referralUrl(origin: string, kind: 'event' | 'offer', itemId: string, code: string) {
  return `${origin}/${kind === 'event' ? 'e' : 'o'}/${itemId}?ref=${code}`;
}

/** Normalizes a ?ref= value; returns null when it cannot be a code. */
export function readRefParam(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim().toUpperCase() : '';
  return CODE_RE.test(s) ? s : null;
}
