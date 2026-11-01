// Mirrors refund_eligibility()/open_refund_request() in tests/database/waiver_reversion_refund_requests.pending.sql.
export type RefundEligibility = 'full' | 'review' | 'none' | 'free';
export type RefundStatus = 'pending' | 'review' | 'submitted' | 'succeeded' | 'failed';

const HOURS: Record<string, number> = { '24h': 24, '7d': 24 * 7 };

/** Last moment a full refund applies, or null when the policy has no automatic cutoff. */
export function refundDeadline(policy: string | null | undefined, startsAt: string): Date | null {
  const h = HOURS[policy ?? ''];
  return h ? new Date(new Date(startsAt).getTime() - h * 3600_000) : null;
}

export function refundEligibility(policy: string | null | undefined, startsAt: string, opts: { hostCancelled?: boolean; paid: boolean; now?: Date }): RefundEligibility {
  if (!opts.paid) return 'free';
  if (opts.hostCancelled) return 'full';
  if (policy === 'custom') return 'review';
  const d = refundDeadline(policy, startsAt);
  return d && (opts.now ?? new Date()) <= d ? 'full' : 'none';
}

/** Ticket + add-ons are refundable; the booking/service fee is not promised back. */
export const refundableCents = (paidCents: number, bookingFeeCents: number) => Math.max(0, paidCents - Math.max(0, bookingFeeCents));

/** Only provider confirmation may read as "refunded". */
export const isRefunded = (s: RefundStatus | null | undefined) => s === 'succeeded';

/** Host event cancellation requires typing the event title (case/space-insensitive). */
export const cancelConfirmMatches = (typed: string, title: string) => typed.trim().toLowerCase() === title.trim().toLowerCase() && title.trim().length > 0;

/** True when a backend function from a not-yet-applied migration is missing. */
export const missingBackendFunction = (e: { code?: string; message?: string } | null | undefined) =>
  !!e && (e.code === 'PGRST202' || e.code === '42883' || /could not find the function|does not exist/i.test(e.message ?? ''));
