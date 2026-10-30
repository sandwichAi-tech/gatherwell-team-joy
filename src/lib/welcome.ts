import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { shareOrigin } from '@/lib/seo';

export type WelcomeReward = { id: string; title_en: string; title_es: string; cost: number };
export type WelcomeSummary = {
  code: string;
  friends: { name: string; status: 'pending' | 'earned'; title: string; at: string }[];
  hosts: { host_id: string; host_name: string; points: number; earned: number; rewards: WelcomeReward[] }[];
  redemptions: { code: string; title: string; points: number; status: 'issued' | 'honored'; at: string; host_name: string }[];
};
export type HostReward = { id: string; title_en: string; title_es: string; points_cost: number; active: boolean };
export type HostRedemption = { id: string; code: string; title: string; points: number; status: 'issued' | 'honored'; created_at: string };

const db = supabase as unknown as { from: (t: string) => any; rpc: (f: string, a?: Record<string, unknown>) => Promise<{ data: any; error: any }> };
const INV_KEY = 'gatherwell-inv';

export const welcomeLink = (code: string) => `${shareOrigin()}/i/${encodeURIComponent(code)}`;
export const rewardTitle = (r: { title_en: string; title_es: string }, lang?: string) => (lang?.startsWith('es') ? r.title_es || r.title_en : r.title_en || r.title_es);

export const myWelcomeQuery = (userId: string) => queryOptions({
  queryKey: ['welcome', 'mine', userId],
  queryFn: async () => { const { data, error } = await db.rpc('my_welcome'); if (error) throw error; return data as WelcomeSummary; },
});
export const guestWelcomeQuery = (checkin: string) => queryOptions({
  queryKey: ['welcome', 'guest', checkin],
  queryFn: async () => { const { data, error } = await db.rpc('guest_welcome', { _checkin: checkin }); if (error) throw error; return (data ?? null) as WelcomeSummary | null; },
});
export const hostRewardsQuery = (userId: string) => queryOptions({
  queryKey: ['welcome', 'host', userId],
  queryFn: async () => {
    const [r, d] = await Promise.all([
      db.from('welcome_rewards').select('id, title_en, title_es, points_cost, active').eq('host_id', userId).order('points_cost'),
      db.from('welcome_redemptions').select('id, code, title, points, status, created_at').eq('host_id', userId).order('created_at', { ascending: false }).limit(50),
    ]);
    if (r.error) throw r.error;
    return { rewards: (r.data ?? []) as HostReward[], redemptions: (d.data ?? []) as HostRedemption[] };
  },
});

export const redeemMine = (reward: string) => db.rpc('redeem_welcome_reward', { _reward: reward });
export const redeemGuest = (checkin: string, reward: string) => db.rpc('guest_redeem_welcome', { _checkin: checkin, _reward: reward });
export const honorCode = (code: string) => db.rpc('honor_welcome_code', { _code: code });
export const addReward = (row: { title_en: string; title_es: string; points_cost: number }) => db.from('welcome_rewards').insert(row);
export const toggleReward = (id: string, active: boolean) => db.from('welcome_rewards').update({ active }).eq('id', id);
export const removeReward = (id: string) => db.from('welcome_rewards').delete().eq('id', id);

/** Remember a friend's invite code for this browser session, until their RSVP. */
export function rememberInvite(code: string | null) { if (code && /^[A-Z0-9]{6,10}$/i.test(code)) sessionStorage.setItem(INV_KEY, code.toUpperCase()); }
export async function recordInvite(rsvpCode: string) {
  try {
    const inv = sessionStorage.getItem(INV_KEY);
    if (!inv) return;
    sessionStorage.removeItem(INV_KEY);
    await db.rpc('record_welcome_invite', { _rsvp_code: rsvpCode, _invite: inv });
  } catch { /* best effort */ }
}
