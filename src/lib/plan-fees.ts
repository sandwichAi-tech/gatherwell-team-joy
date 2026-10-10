/** Platform fee for one sale: percent of the amount, never pushing the month's total past the cap (null = no cap). Mirrors platform_fee_cents() in the database. */
export function cappedFee(amountCents: number, feePercent: number, capCents: number | null, paidThisMonthCents: number) {
  const fee = Math.round(Math.max(amountCents, 0) * feePercent / 100);
  return capCents === null ? fee : Math.min(fee, Math.max(capCents - paidThisMonthCents, 0));
}

/** Guest service fee for one paid ticket order: percent + fixed cents; free orders never pay it. Mirrors service_fee_cents() in the database. */
export function serviceFee(amountCents: number, percent: number, fixedCents: number) {
  return amountCents > 0 ? Math.round(amountCents * percent / 100) + fixedCents : 0;
}
