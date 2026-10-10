import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getPaymentsStatus } from '@/lib/billing.functions';

export type PlanId = 'free' | 'growth' | 'pro';
export type Limits = { gatherings: number | null; guests: number | null; storage_mb: number; assistant: number; fee_pct: number; fee_cap?: number | null };
/** Admin-editable plan numbers (plan_settings). Cents for cap and price. */
export type PlanSetting = { plan: PlanId; fee_percent: number; monthly_cap: number | null; monthly_price: number; legacy: boolean; service_fee_percent: number; service_fee_fixed: number };
export type PlanStatus = {
  plan: PlanId; source: 'own' | 'license' | 'founding'; leader?: string | null; team?: string | null; limits: Limits;
  own_plan: PlanId; billing_period: 'month' | 'year' | null; status: 'active' | 'past_due' | 'canceled' | 'trialing'; renews_at: string | null;
  has_customer: boolean; connect_status: 'not_started' | 'pending' | 'active'; pass_fee: boolean;
  legacy_price_cents: number | null; fees_month: number;
  founding: { start_date: string | null; free_until: string | null; rate_cents: number; in_window: boolean; pending_start: boolean } | null;
  usage: { gatherings: number; largest_guests: number; storage_bytes: number; assistant: number };
};

/** Plans offered today. Usage limits mirror plan_limits(); prices and fees always come from plan_settings. */
export const PLANS: { id: Exclude<PlanId, 'growth'>; limits: Omit<Limits, 'fee_pct'> }[] = [
  { id: 'free', limits: { gatherings: 4, guests: 30, storage_mb: 500, assistant: 50 } },
  { id: 'pro', limits: { gatherings: null, guests: null, storage_mb: 102400, assistant: 2000 } },
];
export const PRO_FEATURES = ['texts', 'autopilot', 'branding', 'campaigns', 'cohosts', 'insights', 'support'] as const;

export const planSettingsQuery = queryOptions({
  queryKey: ['plan-settings'],
  staleTime: 10 * 60_000,
  queryFn: async (): Promise<Record<PlanId, PlanSetting>> => {
    const { data, error } = await supabase.from('plan_settings').select('plan, fee_percent, monthly_cap, monthly_price, legacy, service_fee_percent, service_fee_fixed');
    if (error) throw error;
    return Object.fromEntries((data ?? []).map(r => [r.plan, { ...r, fee_percent: Number(r.fee_percent), service_fee_percent: Number(r.service_fee_percent) }])) as Record<PlanId, PlanSetting>;
  },
});
export const LICENSES = [{ id: 'team25' as const, cents: 19900, seats: 25 }, { id: 'team100' as const, cents: 49900, seats: 100 }];

export const planStatusQuery = (userId: string) => queryOptions({
  queryKey: ['plan-status', userId],
  queryFn: async (): Promise<PlanStatus> => {
    const { data, error } = await supabase.rpc('my_plan_status');
    if (error) throw error;
    return data as unknown as PlanStatus;
  },
});

export const paymentsStatusQuery = queryOptions({ queryKey: ['payments-status'], queryFn: () => getPaymentsStatus(), staleTime: 5 * 60_000 });

export const licenseQuery = (teamId: string) => queryOptions({
  queryKey: ['license', teamId],
  queryFn: async () => {
    const [{ data: lic }, { data: seats }] = await Promise.all([
      supabase.from('team_licenses').select('tier, seats, status, is_preview, renews_at').eq('team_id', teamId).maybeSingle(),
      supabase.from('license_seats').select('user_id').eq('team_id', teamId),
    ]);
    return { license: lic, seats: new Set((seats ?? []).map(s => s.user_id)) };
  },
});

export const earningsQuery = (userId: string) => queryOptions({
  queryKey: ['earnings', userId],
  queryFn: async () => {
    const { data, error } = await supabase.from('payments').select('id, event_id, buyer_name, amount_cents, fee_cents, booking_fee_cents, service_fee_cents, service_fee_covered, status, created_at').eq('host_id', userId).neq('status', 'pending').order('created_at', { ascending: false }).limit(200);
    if (error) throw error;
    const ids = [...new Set((data ?? []).map(p => p.event_id).filter((x): x is string => !!x))];
    const { data: evs } = ids.length ? await supabase.from('events').select('id, title, starts_at').in('id', ids) : { data: [] };
    return { payments: data ?? [], events: new Map((evs ?? []).map(e => [e.id, e])) };
  },
});

export const formatMoney = (cents: number, lang: string) => new Intl.NumberFormat(lang === 'es' ? 'es-MX' : 'en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);
export const formatStorage = (mb: number, lang = 'en') => new Intl.NumberFormat(lang.startsWith('es') ? 'es-419' : 'en-US', { style: 'unit', unit: mb >= 1024 ? 'gigabyte' : 'megabyte', maximumFractionDigits: 0 }).format(mb >= 1024 ? Math.round(mb / 1024) : mb);

/** Client-side guard before an upload; the database answers with the person's plan. */
export async function storageAllows(bytes: number) {
  const { data } = await supabase.rpc('storage_allows', { _bytes: bytes });
  return data !== false;
}
