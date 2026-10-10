import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type OfferKind = 'membership' | 'course' | 'download';
export type Offer = {
  id: string; host_id: string; team_id: string; kind: OfferKind; title_en: string; title_es: string;
  description_en: string | null; description_es: string | null; includes_en: string[]; includes_es: string[];
  price_cents: number; cover_style: number; cover_url: string | null; file_path: string | null; drip_days: number; founding_seats: number | null; founding_price_cents: number | null; status: 'draft' | 'published' | 'archived'; created_at: string;
};
export type Purchase = { id: string; offer_id: string; status: string; cancel_at_period_end: boolean; renews_at: string | null; amount_cents: number; created_at: string; stripe_subscription_id: string | null };

// The generated types may lag behind new tables; keep the casts here.
const db = supabase as unknown as { from: (t: string) => any; rpc: (f: string, a?: Record<string, unknown>) => any };

const COLS = 'id, host_id, team_id, kind, title_en, title_es, description_en, description_es, includes_en, includes_es, price_cents, cover_style, cover_url, file_path, drip_days, founding_seats, founding_price_cents, status, created_at';

export const offerTitle = (o: Pick<Offer, 'title_en' | 'title_es'>, lang?: string) => (lang?.startsWith('es') ? o.title_es || o.title_en : o.title_en || o.title_es);
export const offerText = (o: Pick<Offer, 'description_en' | 'description_es'>, lang?: string) => (lang?.startsWith('es') ? o.description_es || o.description_en : o.description_en || o.description_es) ?? '';
export const offerIncludes = (o: Pick<Offer, 'includes_en' | 'includes_es'>, lang?: string) => { const es = o.includes_es?.length ? o.includes_es : o.includes_en; const en = o.includes_en?.length ? o.includes_en : o.includes_es; return (lang?.startsWith('es') ? es : en) ?? []; };
export const isLive = (p?: Purchase | null) => !!p && (p.status === 'paid' || p.status === 'active' || p.status === 'past_due');

export const myOffersQuery = (userId: string) => queryOptions({
  queryKey: ['offers', 'mine', userId],
  queryFn: async () => {
    const [{ data, error }, { data: stats }] = await Promise.all([
      db.from('offers').select(COLS).eq('host_id', userId).order('created_at', { ascending: false }),
      db.rpc('my_offer_stats'),
    ]);
    if (error) throw error;
    const s = new Map<string, { active: number; total: number }>(((stats ?? []) as { offer_id: string; active: number; total: number }[]).map(r => [r.offer_id, r]));
    return ((data ?? []) as Offer[]).map(o => ({ ...o, active: s.get(o.id)?.active ?? 0, total: s.get(o.id)?.total ?? 0 }));
  },
});

export const teamOffersQuery = (teamId: string) => queryOptions({
  queryKey: ['offers', 'team', teamId],
  queryFn: async () => {
    const { data, error } = await db.from('offers').select(COLS).eq('team_id', teamId).eq('status', 'published').order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as Offer[];
  },
});

export const offerQuery = (id: string, userId: string) => queryOptions({
  queryKey: ['offers', 'one', id, userId],
  queryFn: async () => {
    const [{ data: offer, error }, { data: purchase }] = await Promise.all([
      db.from('offers').select(COLS).eq('id', id).maybeSingle(),
      db.from('offer_purchases').select('id, offer_id, status, cancel_at_period_end, renews_at, amount_cents, created_at, stripe_subscription_id').eq('offer_id', id).eq('user_id', userId).maybeSingle(),
    ]);
    if (error) throw error;
    const { data: host } = offer ? await supabase.from('profiles').select('full_name').eq('id', (offer as Offer).host_id).maybeSingle() : { data: null };
    return { offer: offer as Offer | null, purchase: purchase as Purchase | null, hostName: host?.full_name ?? null };
  },
});

export const purchasesQuery = (userId: string) => queryOptions({
  queryKey: ['offers', 'purchases', userId],
  queryFn: async () => {
    const { data: rows, error } = await db.from('offer_purchases').select('id, offer_id, status, cancel_at_period_end, renews_at, amount_cents, created_at, stripe_subscription_id').eq('user_id', userId).order('created_at', { ascending: false });
    if (error) throw error;
    const ids = ((rows ?? []) as Purchase[]).map(r => r.offer_id);
    const { data: offers } = ids.length ? await db.from('offers').select(COLS).in('id', ids) : { data: [] };
    const map = new Map<string, Offer>(((offers ?? []) as Offer[]).map(o => [o.id, o]));
    return ((rows ?? []) as Purchase[]).map(p => ({ ...p, offer: map.get(p.offer_id) ?? null }));
  },
});

/** Offers this host can attach to a gathering or track (members-only). */
export const linkableOffersQuery = (userId: string, teamId: string) => queryOptions({
  queryKey: ['offers', 'linkable', userId, teamId],
  queryFn: async () => {
    const { data } = await db.from('offers').select('id, title_en, title_es, kind').eq('host_id', userId).eq('team_id', teamId).neq('kind', 'download').neq('status', 'archived');
    return (data ?? []) as Pick<Offer, 'id' | 'title_en' | 'title_es' | 'kind'>[];
  },
});

export const saveOffer = (row: Partial<Offer>, id?: string) => (id ? db.from('offers').update(row).eq('id', id) : db.from('offers').insert(row));
export const deleteOffer = (id: string) => db.from('offers').delete().eq('id', id);
export const joinFreeOffer = (id: string) => db.rpc('join_free_offer', { _offer: id });
export const setOfferLink = (table: 'events' | 'tracks', id: string, offerId: string | null) => db.from(table).update({ offer_id: offerId }).eq('id', id);
export const getOfferLink = async (table: 'events' | 'tracks', id: string) => { const { data } = await db.from(table).select('offer_id').eq('id', id).maybeSingle(); return (data?.offer_id ?? null) as string | null; };

export async function uploadOfferFile(userId: string, file: File) {
  const ext = (file.name.split('.').pop() || 'pdf').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 6) || 'pdf';
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('offer-files').upload(path, file, { contentType: file.type || 'application/pdf' });
  if (error) throw error;
  return path;
}

export type FoundingStatus = { seats: number; price_cents: number; taken: number; left: number } | null;
export const foundingStatusQuery = (offerId: string) => ({
  queryKey: ['offers', 'founding', offerId],
  queryFn: async (): Promise<FoundingStatus> => {
    const { data, error } = await supabase.rpc('offer_founding_status', { _offer: offerId });
    if (error) throw error;
    return (data as FoundingStatus) ?? null;
  },
});
