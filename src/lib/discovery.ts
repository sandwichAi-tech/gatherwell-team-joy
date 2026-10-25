import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/** Unified discovery: real published public offerings only (RPC enforces exclusions server-side). */
export type DiscoverKind = 'event' | 'course' | 'download' | 'membership';
export type DiscoverSort = 'soonest' | 'newest' | 'relevant';

export type DiscoverFilters = {
  q?: string | undefined;
  kinds?: DiscoverKind[] | undefined;
  cat?: string | undefined;
  from?: string | undefined; // ISO date
  to?: string | undefined;
  format?: 'person' | 'online' | 'hybrid' | undefined;
  free?: boolean | undefined;
  lang?: string | undefined;
  accessible?: boolean | undefined;
  minors?: boolean | undefined;
  near?: { lat: number; lng: number; radiusKm: number; label: string } | undefined;
  sort?: DiscoverSort | undefined;
};

export type CatalogItem = {
  kind: 'event' | 'course' | 'download' | 'membership';
  id: string;
  title: string;
  summary: string;
  category: string | null;
  tags: string[] | null;
  starts_at: string | null;
  timezone: string | null;
  format: 'person' | 'online' | 'hybrid';
  price_cents: number | null;
  language: string | null;
  location_name: string | null;
  distance_km: number | null;
  created_at: string;
  host_name: string | null;
  host_slug: string | null;
  url: string;
  cover_path: string | null;
  cover_style: number | null;
  cover_focal: string | null;
  cover_alt: string | null;
  cover_overlay: number | null;
};

/** One page of catalog results. The RPC is bounded server-side (max 100). */
export const CATALOG_PAGE_SIZE = 48;
export const COACH_PAGE_SIZE = 24;

export async function fetchCatalogPage(f: DiscoverFilters, page: number): Promise<CatalogItem[]> {
  const { data, error } = await supabase.rpc('discover_catalog', {
    _q: f.q || null,
    _kinds: f.kinds?.length ? f.kinds : null,
    _cat: f.cat || null,
    _from: f.from ? new Date(f.from).toISOString() : null,
    _to: f.to ? new Date(`${f.to}T23:59:59`).toISOString() : null,
    _format: f.format || null,
    _free: f.free ?? null,
    _lang: f.lang || null,
    _accessible: f.accessible ?? false,
    _minors: f.minors ?? false,
    _lat: f.near?.lat ?? null,
    _lng: f.near?.lng ?? null,
    _radius_km: f.near?.radiusKm ?? null,
    _sort: f.sort ?? 'soonest',
    _limit: CATALOG_PAGE_SIZE,
    _offset: page * CATALOG_PAGE_SIZE,
  } as never);
  if (error) throw error;
  return (data ?? []) as unknown as CatalogItem[];
}

export const discoverCatalogQuery = (f: DiscoverFilters) => queryOptions({
  queryKey: ['discover-catalog', f],
  queryFn: () => fetchCatalogPage(f, 0),
  staleTime: 60_000,
});

// ---- Discover coaches ----

export type CoachItem = {
  id: string;
  slug: string;
  name: string | null;
  org: string | null;
  avatar_path: string | null;
  cover_path: string | null;
  city: string | null; // only present when the host made their city public
  bio: string | null;
  categories: string[];
  languages: string[];
  followers: number;
  upcoming_count: number;
  offerings_count: number;
};

export async function fetchCoachesPage(q: string | undefined, cat: string | undefined, page: number): Promise<CoachItem[]> {
  const { data, error } = await supabase.rpc('discover_coaches', {
    _q: q || null,
    _cat: cat || null,
    _limit: COACH_PAGE_SIZE,
    _offset: page * COACH_PAGE_SIZE,
  } as never);
  if (error) throw error;
  return (data ?? []) as unknown as CoachItem[];
}

// ---- Card images ----

export type CoverRef = { kind: 'event' | 'offer' | 'host'; id: string };

/** Refs for batch-signing card images: catalog items plus coach covers/avatars. */
export function coverRefsFor(items: CatalogItem[], coaches: CoachItem[]): CoverRef[] {
  const refs: CoverRef[] = [];
  for (const i of items) if (i.cover_path) refs.push({ kind: i.kind === 'event' ? 'event' : 'offer', id: i.id });
  for (const c of coaches) if (c.cover_path || c.avatar_path) refs.push({ kind: 'host', id: c.id });
  return refs.slice(0, 60);
}

/** Deterministic gradient slot when an item has no uploaded cover, so cards never show a broken image. */
export function fallbackCoverStyle(id: string, stored: number | null | undefined): number {
  if (typeof stored === 'number' && Number.isFinite(stored)) return Math.abs(Math.trunc(stored));
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 6;
}

/** True when any filter is active — drives noindex on filtered permutations. */
export function hasActiveFilters(f: DiscoverFilters): boolean {
  return !!(f.q || f.kinds?.length || f.cat || f.from || f.to || f.format || f.free !== undefined || f.lang || f.accessible || f.minors || f.near);
}

/** Count of removable filter chips (sort is not a filter). */
export function activeFilterCount(f: DiscoverFilters): number {
  return [f.q, f.kinds?.length ? f.kinds : null, f.cat, f.from || f.to ? 'dates' : null, f.format, f.free !== undefined ? 'free' : null, f.lang, f.accessible, f.minors, f.near].filter(Boolean).length;
}

// ---- Saved offerings ----

export const savedQuery = (userId: string | undefined) => queryOptions({
  queryKey: ['saved-offerings', userId],
  enabled: !!userId,
  queryFn: async () => {
    const { data, error } = await supabase.from('saved_offerings').select('kind, target_id').eq('user_id', userId!);
    if (error) throw error;
    return new Set(data.map(r => `${r.kind}:${r.target_id}`));
  },
});

export async function toggleSaved(userId: string, kind: 'event' | 'offer', targetId: string, saved: boolean) {
  if (saved) {
    const { error } = await supabase.from('saved_offerings').delete().eq('user_id', userId).eq('kind', kind).eq('target_id', targetId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('saved_offerings').upsert({ user_id: userId, kind, target_id: targetId });
    if (error) throw error;
  }
}

// ---- Location alerts ----

export type LocationAlert = {
  id: string;
  user_id: string;
  label: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
  radius_km: number;
  categories: string[];
  kinds: string[];
  language: string | null;
  frequency: 'instant' | 'daily' | 'weekly';
  paused: boolean;
  created_at: string;
};

export const alertsQuery = (userId: string | undefined) => queryOptions({
  queryKey: ['location-alerts', userId],
  enabled: !!userId,
  queryFn: async () => {
    const { data, error } = await supabase.from('location_alerts').select('*').eq('user_id', userId!).order('created_at', { ascending: false });
    if (error) throw error;
    return data as LocationAlert[];
  },
});

export type AlertMatch = { alert_id: string; alert_label: string; offering: { kind: string; id: string; title: string; starts_at: string | null; url: string; location_name: string | null } };

export const alertMatchesQuery = (userId: string | undefined) => queryOptions({
  queryKey: ['alert-matches', userId],
  enabled: !!userId,
  queryFn: async () => {
    const { data, error } = await supabase.rpc('my_alert_matches');
    if (error) throw error;
    return (data ?? []) as unknown as AlertMatch[];
  },
});

// ---- Invite a host ----

const HOST_INVITE_KEY = 'gw-host-invite';
const HOST_INVITE_AT = 'gw-host-invite-at';
const HOST_INVITE_TTL = 7 * 24 * 60 * 60 * 1000; // short-lived convenience, never authority

export function savePendingHostInvite(token: string, now = Date.now()) {
  try { localStorage.setItem(HOST_INVITE_KEY, token); localStorage.setItem(HOST_INVITE_AT, String(now)); } catch { /* storage unavailable */ }
}

export function pendingHostInvite(now = Date.now()): string | null {
  try {
    const token = localStorage.getItem(HOST_INVITE_KEY);
    const at = Number(localStorage.getItem(HOST_INVITE_AT) ?? 0);
    if (!token || !at || now - at > HOST_INVITE_TTL) return null;
    return token;
  } catch { return null; }
}

export function clearPendingHostInvite() {
  try { localStorage.removeItem(HOST_INVITE_KEY); localStorage.removeItem(HOST_INVITE_AT); } catch { /* storage unavailable */ }
}

/** Record the pending host invite after signup; idempotent server-side, best-effort client-side. */
export async function recordPendingHostInvite() {
  const token = pendingHostInvite();
  if (!token) return;
  try { await supabase.rpc('record_host_invite', { _token: token }); } catch { /* best-effort */ }
  clearPendingHostInvite();
}

/** Share URL for invite-a-host: opaque token when signed in, plain origin otherwise. */
export async function hostInviteUrl(origin: string): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return `${origin}/`;
  const { data: token, error } = await supabase.rpc('create_host_invite');
  if (error || !token) return `${origin}/`;
  return `${origin}/i/host/${token}`;
}
