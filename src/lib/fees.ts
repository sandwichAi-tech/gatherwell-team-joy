// Mirrors public.calc_platform_fee_cents / public.fee_rules. The database is authoritative;
// this copy exists so pricing previews and tests use the same versioned rules.
export type FeeRule = { id: string; percent: number; fixedCents: number; capCents: number | null; legacy: boolean };

export const FEE_RULES: Record<string, FeeRule> = {
  legacy_free_7: { id: 'legacy_free_7', percent: 7, fixedCents: 0, capCents: 9900, legacy: true },
  legacy_growth_2: { id: 'legacy_growth_2', percent: 2, fixedCents: 0, capCents: null, legacy: true },
  legacy_pro_0: { id: 'legacy_pro_0', percent: 0, fixedCents: 0, capCents: null, legacy: true },
  legacy_guest_service_3_49: { id: 'legacy_guest_service_3_49', percent: 3, fixedCents: 49, capCents: null, legacy: true },
  v4_flat_5: { id: 'v4_flat_5', percent: 5, fixedCents: 0, capCents: null, legacy: true },
  v5_free_5: { id: 'v5_free_5', percent: 5, fixedCents: 0, capCents: null, legacy: false },
  v5_advanced_3: { id: 'v5_advanced_3', percent: 3, fixedCents: 0, capCents: null, legacy: false },
  v5_pro_2: { id: 'v5_pro_2', percent: 2, fixedCents: 0, capCents: null, legacy: false },
  v5_team25_1: { id: 'v5_team25_1', percent: 1, fixedCents: 0, capCents: null, legacy: false },
  v5_org_0_5: { id: 'v5_org_0_5', percent: 0.5, fixedCents: 0, capCents: null, legacy: false },
};

/** Approved per-plan fee ladder (2026-10-24). Unknown plans fall back to the Free rule. */
export const PLAN_FEE_RULES: Record<string, string> = {
  free: 'v5_free_5', advanced: 'v5_advanced_3', growth: 'v5_advanced_3', pro: 'v5_pro_2',
  team25: 'v5_team25_1', team_25: 'v5_team25_1', team100: 'v5_org_0_5', team_100: 'v5_org_0_5', organization: 'v5_org_0_5',
};

export const ACTIVE_FEE_RULE = 'v5_free_5';

/** Fee rule for a plan; unknown plans pay the Free rate. */
export function feeRuleForPlan(plan: string): FeeRule {
  return FEE_RULES[PLAN_FEE_RULES[plan] ?? ACTIVE_FEE_RULE]!;
}

/** Platform fee for a sale on a given plan. */
export function planFeeCents(netCents: number, plan: string): number {
  return platformFeeCents(netCents, feeRuleForPlan(plan).id);
}

export function platformFeeCents(netCents: number, ruleId: string = ACTIVE_FEE_RULE): number {
  const rule = FEE_RULES[ruleId];
  if (!rule) throw new Error(`unknown fee rule ${ruleId}`);
  if (!netCents || netCents <= 0) return 0;
  const fee = Math.round((netCents * rule.percent) / 100) + rule.fixedCents;
  return rule.capCents == null ? fee : Math.min(rule.capCents, fee);
}

export function annualPriceCents(monthlyCents: number): number {
  return monthlyCents * 10;
}
