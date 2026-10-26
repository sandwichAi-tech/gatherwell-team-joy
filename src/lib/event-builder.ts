/** Pure rules for the host event/retreat builder, mirrored by update_event_details() and rsvp_event_minor() in the database. */
import { feeRuleForPlan } from './fees';
import type { AgeBand } from './identity';

export const EVENT_FORMATS = ['person', 'online', 'hybrid'] as const;
export type EventFormat = typeof EVENT_FORMATS[number];

export type TicketTier = { id: string; name: string; price_cents: number; quantity: number | null; sale_starts_at: string | null; sale_ends_at: string | null };
export type Addon = { id: string; name: string; price_cents: number };

export const MAX_TAGS = 8;
export const MAX_TAG_LEN = 24;
export const MAX_TIERS = 6;
export const MAX_ADDONS = 8;
export const MAX_PRICE_CENTS = 100000;

export function capacityValue(mode: 'unlimited' | 'limited', value: string): number | null | undefined {
  if (mode === 'unlimited') return null;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 && n <= 10000 ? n : undefined;
}

export function validHttps(value: string): boolean {
  try { const u = new URL(value.trim()); return u.protocol === 'https:' && !!u.hostname && !u.username && !u.password; }
  catch { return false; }
}

/** Comma-separated input → normalized tag list: trimmed, lowercased, deduped, capped. */
export function parseTags(input: string): string[] {
  const out: string[] = [];
  for (const raw of input.split(',')) {
    const tag = raw.trim().toLowerCase().slice(0, MAX_TAG_LEN);
    if (tag && !out.includes(tag)) out.push(tag);
    if (out.length >= MAX_TAGS) break;
  }
  return out;
}

export type RegWindow = 'not_open' | 'open' | 'closed';
export function regWindowState(opens: string | null | undefined, closes: string | null | undefined, now = new Date()): RegWindow {
  if (opens && now < new Date(opens)) return 'not_open';
  if (closes && now > new Date(closes)) return 'closed';
  return 'open';
}

export type Blocker = 'title' | 'date' | 'place' | 'online_link' | 'reg_window' | 'retreat_dates' | 'payouts' | 'tier_invalid' | 'min_age';

export type ReadinessInput = {
  title: string;
  startsAt: string;
  format: EventFormat;
  locationName: string;
  address: string;
  onlineUrl: string;
  priceCents: number | null;
  canSell: boolean;
  regOpens: string;
  regCloses: string;
  retreatOn: boolean;
  retreatEnd: string;
  allowsMinors: boolean;
  minAge: string;
  tiers: TicketTier[];
};

/** Truthful publication blockers; the publish action stays disabled while any remain. */
export function readinessBlockers(input: ReadinessInput): Blocker[] {
  const out: Blocker[] = [];
  if (!input.title.trim()) out.push('title');
  if (!input.startsAt || !Number.isFinite(new Date(input.startsAt).getTime())) out.push('date');
  if (input.format !== 'online' && !input.locationName.trim() && !input.address.trim()) out.push('place');
  if (input.format !== 'person' && !validHttps(input.onlineUrl)) out.push('online_link');
  if (input.regOpens && input.regCloses && new Date(input.regOpens) >= new Date(input.regCloses)) out.push('reg_window');
  if (input.retreatOn && (!input.retreatEnd || !input.startsAt || new Date(input.retreatEnd) <= new Date(input.startsAt))) out.push('retreat_dates');
  if (input.priceCents && !input.canSell) out.push('payouts');
  if (input.tiers.some(t => !t.name.trim() || t.price_cents < 0 || t.price_cents > MAX_PRICE_CENTS)) out.push('tier_invalid');
  if (input.minAge && (!input.allowsMinors || Number(input.minAge) < 0 || Number(input.minAge) > 17)) out.push('min_age');
  return out;
}

/**
 * Platform fee estimate for host-facing previews, from the approved per-plan ladder.
 * Defaults to the Free-plan rate (the highest any plan pays) so previews stay
 * conservative; Stripe processing is always separate.
 */
export const feeEstimateCents = (priceCents: number, plan: string = 'free') =>
  Math.round(priceCents * feeRuleForPlan(plan).percent / 100);
export const hostKeepsCents = (priceCents: number, plan: string = 'free') => priceCents - feeEstimateCents(priceCents, plan);

let nid = 0;
const newId = () => `t${Date.now().toString(36)}${(nid++).toString(36)}`;

export const emptyTier = (): TicketTier => ({ id: newId(), name: '', price_cents: 0, quantity: null, sale_starts_at: null, sale_ends_at: null });
export const emptyAddon = (): Addon => ({ id: newId(), name: '', price_cents: 0 });

/** Normalizes tier drafts for saving; returns null when any row is invalid. */
export function cleanTiers(rows: TicketTier[]): TicketTier[] | null {
  if (rows.length > MAX_TIERS) return null;
  const out: TicketTier[] = [];
  for (const r of rows) {
    const name = r.name.trim();
    if (!name || name.length > 60) return null;
    if (!Number.isInteger(r.price_cents) || r.price_cents < 0 || r.price_cents > MAX_PRICE_CENTS) return null;
    if (r.quantity != null && (!Number.isInteger(r.quantity) || r.quantity < 1)) return null;
    if (r.sale_starts_at && !Number.isFinite(new Date(r.sale_starts_at).getTime())) return null;
    if (r.sale_ends_at && !Number.isFinite(new Date(r.sale_ends_at).getTime())) return null;
    if (r.sale_starts_at && r.sale_ends_at && new Date(r.sale_starts_at) >= new Date(r.sale_ends_at)) return null;
    out.push({ id: r.id || newId(), name, price_cents: r.price_cents, quantity: r.quantity, sale_starts_at: r.sale_starts_at ? new Date(r.sale_starts_at).toISOString() : null, sale_ends_at: r.sale_ends_at ? new Date(r.sale_ends_at).toISOString() : null });
  }
  return out;
}

export function cleanAddons(rows: Addon[]): Addon[] | null {
  if (rows.length > MAX_ADDONS) return null;
  const out: Addon[] = [];
  for (const r of rows) {
    const name = r.name.trim();
    if (!name || name.length > 60) return null;
    if (!Number.isInteger(r.price_cents) || r.price_cents < 0 || r.price_cents > MAX_PRICE_CENTS) return null;
    out.push({ id: r.id || newId(), name, price_cents: r.price_cents });
  }
  return out;
}

/** Mirrors the min-age check in rsvp_event_minor(): bands are under_5, 5_12, 13_17. */
export function minorBandAllowed(minAge: number | null, band: AgeBand): boolean {
  if (minAge == null) return true;
  if (band === 'under_5') return minAge < 5;
  if (band === '5_12') return minAge < 13;
  return true;
}

export type EventStatus = 'draft' | 'published' | 'cancelled' | 'archived';
/** Allowed host-driven status transitions; cancel stays a separate flow with refunds/notifications. */
export function canTransition(from: EventStatus, to: EventStatus): boolean {
  if (from === to) return false;
  if (to === 'archived') return from !== 'cancelled';
  if (to === 'draft') return from === 'published' || from === 'archived';
  if (to === 'published') return from === 'draft' || from === 'archived';
  return false;
}
