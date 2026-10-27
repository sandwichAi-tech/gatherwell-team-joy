import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type NetPerson = { link_id?: string; user_id: string; name: string | null; city: string | null; avatar: string | null };
export type NetGathering = { id: string; title: string; starts_at: string; timezone: string; location_name: string | null; online: boolean; price_cents: number | null; host_id: string; host_name: string | null; mine: boolean; featured_teams: string[] };
export type NetOverview = { is_host: boolean; connections: NetPerson[]; incoming: NetPerson[]; outgoing: NetPerson[]; suggested: NetPerson[]; gatherings: NetGathering[] };
export type FeaturedGathering = { id: string; title: string; starts_at: string; timezone: string; location_name: string | null; host_name: string | null; shared_by: string | null; shared_by_id: string };
export type ReferralSummary = { sent: number; received: number; thanks_earned_cents: number; thanks_owed_cents: number; thanks: { kind: 'none' | 'percent' | 'flat'; amount: number } | null };

const rpcClient = supabase as unknown as { rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> };
const rpc = (fn: string, args?: Record<string, unknown>) => rpcClient.rpc(fn, args);
export async function netRpc<T = unknown>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export const networkQuery = (userId: string) => queryOptions({ queryKey: ['network', userId], queryFn: () => netRpc<NetOverview>('network_overview') });
export const featuredQuery = (teamId: string) => queryOptions({ queryKey: ['network-featured', teamId], queryFn: () => netRpc<FeaturedGathering[]>('team_featured_gatherings', { _team: teamId }) });
export const referralQuery = (userId: string) => queryOptions({ queryKey: ['referrals', userId], queryFn: () => netRpc<ReferralSummary>('my_referrals') });
export const sharedQuery = (eventId: string) => queryOptions({
  queryKey: ['network-shared', eventId],
  queryFn: async () => { const { data } = await (supabase.from as unknown as (t: string) => ReturnType<typeof supabase.from>)('network_shares').select('event_id').eq('event_id', eventId).maybeSingle(); return !!data; },
});

/** Link a host hands to their own guests for a partner's gathering; RSVPs through it record a referral. */
export const partnerLink = (eventId: string, hostId: string) => `${window.location.origin}/e/${eventId}?ref=${hostId}`;

const REF_KEY = 'gatherwell-ref';
export function rememberRef(eventId: string, ref: string | null) { if (ref && /^[0-9a-f-]{36}$/i.test(ref)) sessionStorage.setItem(REF_KEY, JSON.stringify({ eventId, ref })); }
export async function recordReferral(eventId: string, code: string) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(REF_KEY) ?? 'null') as { eventId: string; ref: string } | null;
    if (!saved || saved.eventId !== eventId) return;
    sessionStorage.removeItem(REF_KEY);
    await rpc('record_referral', { _code: code, _ref: saved.ref });
  } catch { /* referral credit is best-effort */ }
}
