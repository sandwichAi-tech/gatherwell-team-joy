export type Promo = { id: string; code: string; kind: 'percent' | 'flat'; amount: number };
export type PromoCheck = ({ ok: true } & Promo) | { ok: false; error: string };

/** Cents taken off a subtotal. Percent rounds to the cent; flat is in cents. Always leaves at least 50 cents to charge. */
export function promoDiscount(subtotalCents: number, p: Pick<Promo, 'kind' | 'amount'> | null | undefined) {
  if (!p || subtotalCents <= 50) return 0;
  const raw = p.kind === 'percent' ? Math.round(subtotalCents * Math.min(100, p.amount) / 100) : p.amount;
  return Math.max(0, Math.min(raw, subtotalCents - 50));
}

export const normalizeCode = (c: string) => c.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20);
export const promoErrorKey = (e: string) => `promo.errors.${['invalid', 'not_here', 'not_started', 'expired', 'used_up', 'per_person'].includes(e) ? e : 'invalid'}`;
