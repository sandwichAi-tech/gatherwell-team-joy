/** What a plan would cost this month for a given paid-sales total (cents): monthly price + fee share. */
export const planCost = (sales: number, s: { monthly_price: number; fee_percent: number }) =>
  s.monthly_price + Math.round(sales * s.fee_percent / 100);

/** The cheaper next plan and how much less it would have cost; null unless it's truly cheaper. */
export function planSaving(current: 'free' | 'growth' | 'pro', sales: number,
  settings: Partial<Record<'free' | 'growth' | 'pro', { monthly_price: number; fee_percent: number }>>) {
  const next = current === 'free' ? 'growth' : current === 'growth' ? 'pro' : null;
  const a = settings[current]; const b = next ? settings[next] : undefined;
  if (!next || !a || !b) return null;
  const diff = planCost(sales, a) - planCost(sales, b);
  return diff > 0 ? { plan: next, cents: diff } : null;
}

const DAY = 86_400_000;
/** 'active' during the first 30 days, 'ending' in the last 3 days, null otherwise. */
export function noLimitsPhase(until: string | null, now = Date.now()): 'active' | 'ending' | null {
  if (!until) return null; const end = new Date(until).getTime();
  if (end <= now) return null;
  return end - now <= 3 * DAY ? 'ending' : 'active';
}
