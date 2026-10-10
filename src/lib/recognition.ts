import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { teamKey } from '@/lib/team';

export type Tier = 'bronze' | 'silver' | 'gold';
export type Badge = { id: string; code: string; name_en: string; name_es: string; description_en: string | null; description_es: string | null; icon: string; tier: Tier; is_custom: boolean; team_id: string | null; sort_order: number };
export type Earned = { id: string; user_id: string; badge_id: string; team_id: string; awarded_by: string | null; note: string | null; awarded_at: string; seen_at: string | null };

export const JOIN_BY_KEY = 'gatherwell-join-by';
export const recognitionKey = (teamId: string) => [...teamKey(teamId), 'recognition'] as const;

export const badgeName = (b: Pick<Badge, 'name_en' | 'name_es'>, lang?: string) => (lang === 'es' ? b.name_es : b.name_en) || b.name_en;
export const badgeText = (b: Pick<Badge, 'description_en' | 'description_es'>, lang?: string) => (lang === 'es' ? b.description_es : b.description_en) || b.description_en || '';

export const badgesQuery = (teamId: string) => queryOptions({
  queryKey: [...recognitionKey(teamId), 'badges'],
  queryFn: async (): Promise<Badge[]> => {
    const { data, error } = await supabase.from('badges').select('id, code, name_en, name_es, description_en, description_es, icon, tier, is_custom, team_id, sort_order').order('sort_order').order('created_at');
    if (error) throw error;
    return (data ?? []) as Badge[];
  },
});

export const myBadgesQuery = (teamId: string, userId: string) => queryOptions({
  queryKey: [...recognitionKey(teamId), 'mine', userId],
  queryFn: async (): Promise<Earned[]> => {
    const { data, error } = await supabase.from('user_badges').select('*').eq('team_id', teamId).eq('user_id', userId).order('awarded_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
});

export const unseenBadgesQuery = (userId: string) => queryOptions({
  queryKey: ['unseen-badges', userId],
  refetchInterval: 20_000,
  queryFn: async () => {
    const { data, error } = await supabase.from('user_badges').select('id, team_id, awarded_at, note, badges(id, code, name_en, name_es, description_en, description_es, icon, tier, is_custom, team_id, sort_order)')
      .eq('user_id', userId).is('seen_at', null).order('awarded_at').limit(5);
    if (error) throw error;
    return (data ?? []).filter(r => r.badges) as unknown as { id: string; team_id: string; awarded_at: string; note: string | null; badges: Badge }[];
  },
});

export const summaryQuery = (teamId: string, userId: string) => queryOptions({
  queryKey: [...recognitionKey(teamId), 'summary', userId],
  queryFn: async () => {
    const [b, s, h] = await Promise.all([
      supabase.from('user_badges').select('id', { count: 'exact', head: true }).eq('team_id', teamId).eq('user_id', userId),
      supabase.from('shoutouts').select('id', { count: 'exact', head: true }).eq('team_id', teamId).eq('to_user', userId).eq('hidden', false),
      supabase.from('host_of_month').select('month', { count: 'exact', head: true }).eq('team_id', teamId).eq('user_id', userId),
    ]);
    return { badges: b.count ?? 0, shoutouts: s.count ?? 0, hostOfMonth: h.count ?? 0 };
  },
});

export const monthStart = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; };

export type FeaturedBadge = { id: string; code: string; name_en: string; name_es: string; icon: string; tier: Tier; featured: number };
/** Up to 3 badges a person chose to feature. Public by design (names and icons only). */
export const featuredBadgesQuery = (userId: string) => queryOptions({
  queryKey: ['featured-badges', userId],
  queryFn: async (): Promise<FeaturedBadge[]> => {
    const { data, error } = await supabase.rpc('featured_badges', { _user: userId });
    if (error) throw error;
    return (data ?? []) as FeaturedBadge[];
  },
  staleTime: 60_000,
});

export const memberOfMonthQuery = (teamId: string) => queryOptions({
  queryKey: [...recognitionKey(teamId), 'member-of-month', monthStart()],
  queryFn: async () => {
    const { data, error } = await supabase.from('member_of_month').select('user_id, month, note').eq('team_id', teamId).eq('month', monthStart()).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const { data: p } = await supabase.from('profiles').select('full_name, avatar_url').eq('id', data.user_id).maybeSingle();
    return { ...data, name: p?.full_name ?? null, avatar: p?.avatar_url ?? null };
  },
});

export const hostOfMonthQuery = (teamId: string) => queryOptions({
  queryKey: [...recognitionKey(teamId), 'host-of-month', monthStart()],
  queryFn: async () => {
    const { data, error } = await supabase.from('host_of_month').select('user_id, month, note').eq('team_id', teamId).eq('month', monthStart()).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const { data: p } = await supabase.from('profiles').select('full_name, avatar_url').eq('id', data.user_id).maybeSingle();
    return { ...data, name: p?.full_name ?? null, avatar: p?.avatar_url ?? null };
  },
});

export const pinnedShoutoutQuery = (teamId: string) => queryOptions({
  queryKey: [...recognitionKey(teamId), 'pinned-shoutout'],
  queryFn: async () => {
    const { data, error } = await supabase.from('shoutouts').select('id, from_user, to_user, message, photo_path, created_at').eq('team_id', teamId).eq('pinned', true).eq('hidden', false).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const { data: people } = await supabase.from('profiles').select('id, full_name').in('id', [data.from_user, data.to_user]);
    const name = (id: string) => people?.find(p => p.id === id)?.full_name ?? null;
    return { ...data, fromName: name(data.from_user), toName: name(data.to_user) };
  },
});

/** Mirrors the database claim check so people get the gentle message before sending. */
const CLAIM = /(weight|lbs?\b|pounds|kilos?\b|\bkg\b|slim|diet pill|fat burn|cure|cures|cured|heal(s|ed)?\b|disease|diabet|cancer|medic|prescription|detox|income|salary|paycheck|commission|earn(ed|ing|s)?\b|\$ ?[0-9]|[0-9]+ ?(usd|dollars|dólares|pesos)|make money|financial freedom|quit (your|my) job|six figures|passive|peso\b|bajar de peso|perder peso|adelgaz|libras|grasa|cura(r|do|ción)?\b|sana(r|do)?\b|enfermedad|medicina|medicament|ingreso|sueldo|salario|comisi[oó]n|ganar dinero|gan[eé] dinero|libertad financiera|dinero)/i;
export const hasBlockedClaim = (text: string) => CLAIM.test(text);

export function recognitionError(error: unknown) {
  const m = error instanceof Error ? error.message : typeof error === 'object' && error && 'message' in error ? String((error as { message: unknown }).message) : '';
  for (const key of ['claim_blocked', 'already_awarded', 'invalid_person', 'not_leader', 'not_allowed', 'invalid_message']) if (m.includes(key)) return `recognition.err.${key}`;
  return 'profile.saveError';
}
