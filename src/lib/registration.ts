/** Client-side mirrors of the rules the register_attendance database function enforces server-side. */

export type TicketTier = {
  id: string;
  name: string;
  price_cents: number;
  quantity?: number | null;
  sold?: number;
  sale_starts_at?: string | null;
  sale_ends_at?: string | null;
};

export type TierState = 'open' | 'not_yet' | 'ended' | 'sold_out' | 'setup_required';

/** Paid tiers stay blocked until checkout is configured and verified; free tiers follow their sale window and quantity. */
export function tierState(tier: TicketTier, now = new Date()): TierState {
  if (tier.price_cents > 0) return 'setup_required';
  if (tier.sale_starts_at && now < new Date(tier.sale_starts_at)) return 'not_yet';
  if (tier.sale_ends_at && now >= new Date(tier.sale_ends_at)) return 'ended';
  if (tier.quantity != null && (tier.sold ?? 0) >= tier.quantity) return 'sold_out';
  return 'open';
}

export const needsTier = (tiers: TicketTier[] | null | undefined) => (tiers?.length ?? 0) > 0;

/** First tier a guest can actually book, used to preselect the picker. */
export function defaultTier(tiers: TicketTier[] | null | undefined, now = new Date()): string | null {
  return (tiers ?? []).find(t => tierState(t, now) === 'open')?.id ?? null;
}

/** Every registration requires platform terms consent; tiered events also need a chosen, bookable tier. */
export function registrationReady(opts: { terms: boolean; tiers?: TicketTier[] | null; tierId: string | null; now?: Date }): boolean {
  if (!opts.terms) return false;
  if (needsTier(opts.tiers)) {
    const tier = (opts.tiers ?? []).find(t => t.id === opts.tierId);
    if (!tier || tierState(tier, opts.now ?? new Date()) !== 'open') return false;
  }
  return true;
}

/** Spots left in a tier; null when unlimited. */
export function tierSpotsLeft(tier: TicketTier): number | null {
  return tier.quantity == null ? null : Math.max(0, tier.quantity - (tier.sold ?? 0));
}
