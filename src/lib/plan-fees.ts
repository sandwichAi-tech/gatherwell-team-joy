/** Platform fee for one sale: percent of the amount, never pushing the month's total past the cap (null = no cap). Mirrors platform_fee_cents() in the database. */
export function cappedFee(amountCents: number, feePercent: number, capCents: number | null, paidThisMonthCents: number) {
  const fee = Math.round(Math.max(amountCents, 0) * feePercent / 100);
  return capCents === null ? fee : Math.min(fee, Math.max(capCents - paidThisMonthCents, 0));
}
