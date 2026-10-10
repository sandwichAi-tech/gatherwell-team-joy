// Retreat or trip details stored on events.retreat. Shared by the host editor, guest page and pass page.
export type RetreatDay = { title: string; items: string };
export type RetreatFaq = { q: string; a: string };
export type RetreatPayment = { mode: 'full' | 'deposit' | 'plan'; deposit_cents?: number; balance_due?: string; installments?: number };
export type Retreat = {
  itinerary: RetreatDay[]; lodging: string; meals: string; included: string; not_included: string;
  refund_policy: string; faq: RetreatFaq[]; checklist: string[]; gallery: string[]; payment: RetreatPayment;
};

export const emptyRetreat = (): Retreat => ({ itinerary: [{ title: '', items: '' }], lodging: '', meals: '', included: '', not_included: '', refund_policy: '', faq: [], checklist: [], gallery: [], payment: { mode: 'full' } });

export const linesOf = (s: string | undefined | null) => (s ?? '').split('\n').map(x => x.trim()).filter(Boolean);

export function asRetreat(v: unknown): Retreat | null {
  if (!v || typeof v !== 'object') return null;
  const r = v as Partial<Retreat>;
  return { ...emptyRetreat(), ...r, itinerary: Array.isArray(r.itinerary) ? r.itinerary : [], faq: Array.isArray(r.faq) ? r.faq : [], checklist: Array.isArray(r.checklist) ? r.checklist : [], gallery: Array.isArray(r.gallery) ? r.gallery : [], payment: r.payment ?? { mode: 'full' } };
}

/** Days between start and end, counting both (a Fri–Sun trip is 3 days). */
export function tripDays(startIso: string, endIso: string | null | undefined) {
  if (!endIso) return 1;
  const a = new Date(startIso); const b = new Date(endIso);
  const d = Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000);
  return Math.max(1, d + 1);
}

export type Installment = { amount_cents: number; due: Date | null };

/**
 * What a guest pays and when. Deposit: deposit now, the rest on the balance date.
 * Plan: equal parts (rounded up, last part absorbs the difference), first now, last on the balance date, evenly spaced between.
 */
export function paymentSchedule(priceCents: number, p: RetreatPayment, signedUpAt: Date = new Date()): Installment[] {
  if (!priceCents || p.mode === 'full' || !p.balance_due) return [{ amount_cents: priceCents, due: null }];
  const due = new Date(`${p.balance_due}T09:00:00`);
  if (p.mode === 'deposit') {
    const dep = Math.min(Math.max(p.deposit_cents ?? 0, 0), priceCents);
    return [{ amount_cents: dep, due: null }, { amount_cents: priceCents - dep, due }];
  }
  const n = Math.min(4, Math.max(2, p.installments ?? 2));
  const part = Math.ceil(priceCents / n);
  return Array.from({ length: n }, (_, i) => ({
    amount_cents: i === n - 1 ? priceCents - part * (n - 1) : part,
    due: i === 0 ? null : new Date(signedUpAt.getTime() + (due.getTime() - signedUpAt.getTime()) * i / (n - 1)),
  }));
}
