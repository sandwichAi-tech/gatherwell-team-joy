import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getPaymentsStatus } from '@/lib/billing.functions';

export type PlanId = 'free' | 'growth' | 'pro';
export type Limits = { gatherings: number | null; guests: number | null; storage_mb: number; assistant: number; fee_pct: number };
export type PlanStatus = {
  plan: PlanId; source: 'own' | 'license'; leader?: string | null; team?: string | null; limits: Limits;
  own_plan: PlanId; billing_period: 'month' | 'year' | null; status: 'active' | 'past_due' | 'canceled' | 'trialing'; renews_at: string | null;
  has_customer: boolean; connect_status: 'not_started' | 'pending' | 'active'; pass_fee: boolean;
  usage: { gatherings: number; largest_guests: number; storage_bytes: number; assistant: number };
};

/** Display catalog. Prices in cents; annual = 10 months. Limits mirror plan_limits() in the database. */
export const PLANS: { id: PlanId; month: number; year: number; limits: Limits }[] = [
  { id: 'free', month: 0, year: 0, limits: { gatherings: 4, guests: 30, storage_mb: 500, assistant: 50, fee_pct: 8 } },
  { id: 'growth', month: 2900, year: 29000, limits: { gatherings: null, guests: 150, storage_mb: 10240, assistant: 500, fee_pct: 4 } },
  { id: 'pro', month: 7900, year: 79000, limits: { gatherings: null, guests: null, storage_mb: 102400, assistant: 2000, fee_pct: 2 } },
];
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
    const { data, error } = await supabase.from('payments').select('id, event_id, buyer_name, amount_cents, fee_cents, booking_fee_cents, status, created_at').eq('host_id', userId).neq('status', 'pending').order('created_at', { ascending: false }).limit(200);
    if (error) throw error;
    const ids = [...new Set((data ?? []).map(p => p.event_id).filter((x): x is string => !!x))];
    const { data: evs } = ids.length ? await supabase.from('events').select('id, title, starts_at').in('id', ids) : { data: [] };
    return { payments: data ?? [], events: new Map((evs ?? []).map(e => [e.id, e])) };
  },
});

export const formatMoney = (cents: number, lang: string) => new Intl.NumberFormat(lang === 'es' ? 'es-MX' : 'en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);
export const formatStorage = (mb: number) => (mb >= 1024 ? `${Math.round(mb / 1024)} GB` : `${mb} MB`);

/** Client-side guard before an upload; the database answers with the person's plan. */
export async function storageAllows(bytes: number) {
  const { data } = await supabase.rpc('storage_allows', { _bytes: bytes });
  return data !== false;
}
