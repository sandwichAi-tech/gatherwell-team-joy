import { trackEvent } from './analytics';
import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { CATEGORY_ICONS } from '@/components/gw-icon';

export type Category = keyof typeof CATEGORY_ICONS;
export const CATEGORIES: Category[] = ['run', 'fitcamp', 'yoga', 'pilates', 'soundbath', 'hike', 'walk', 'pickleball', 'more'];
export const isCategory = (v: unknown): v is Category => typeof v === 'string' && (CATEGORIES as string[]).includes(v);

/** A public gathering card, normalized from real rows and preview-only samples. */
export type FeedGathering = {
  id: string;
  isSample: boolean;
  hero: boolean;
  /** Founding coach in their featured window: shown first in Discover. */
  featured?: boolean;
  title: string;
  startsAt: Date;
  category: Category;
  categoryLabel?: string | null;
  locationName: string | null;
  isOnline: boolean;
  lat: number | null;
  lng: number | null;
  capacity: number | null;
  going: number;
  goingNames: string[];
  initials: string[];
  hostName: string;
};

type RawReal = { category_label?: string | null; id: string; title: string; starts_at: string; category: string; location_name: string | null; is_online: boolean; lat: number | null; lng: number | null; capacity: number | null; going: number; host_name: string; initials: string[]; featured?: boolean };
type RawSample = { id: string; hero: boolean; slot_order: number; title_en: string; title_es: string; category: string; dow: number; local_time: string; location_name: string; lat: number | null; lng: number | null; capacity: number | null; going: number; going_names: string[]; host_name: string };

/** Samples exist only for previews; the published site never requests them. */
export function isPreviewHost() {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1' || h.startsWith('id-preview--') || h.endsWith('-dev.lovable.app') || h.endsWith('.lovableproject.com');
}

function nextOccurrence(dow: number, time: string) {
  const [hh = 0, mm = 0] = time.split(':').map(Number);
  const d = new Date();
  d.setHours(hh, mm, 0, 0);
  let add = (dow - d.getDay() + 7) % 7;
  if (add === 0 && d.getTime() < Date.now()) add = 7;
  d.setDate(d.getDate() + add);
  return d;
}

export const publicGatheringsQuery = (lang: 'en' | 'es', includeSamples: boolean = isPreviewHost()) => queryOptions({
  queryKey: ['public-gatherings', lang, includeSamples],
  staleTime: 60_000,
  queryFn: async (): Promise<FeedGathering[]> => {
    const { data, error } = await supabase.rpc('list_public_gatherings', { _include_samples: includeSamples, _days: 14, _limit: 48 });
    if (error) throw error;
    const payload = (data ?? { real: [], samples: [] }) as unknown as { real: RawReal[]; samples: RawSample[] };
    const real = payload.real.map((r): FeedGathering => ({
      id: r.id, isSample: false, hero: false, title: r.title, startsAt: new Date(r.starts_at),
      categoryLabel: r.category_label ?? null, category: isCategory(r.category) ? r.category : 'more', locationName: r.location_name, isOnline: r.is_online,
      lat: r.lat, lng: r.lng, capacity: r.capacity, going: r.going, goingNames: [], initials: r.initials ?? [], hostName: r.host_name, featured: !!r.featured,
    }));
    const samples = payload.samples.map((s): FeedGathering => ({
      id: s.id, isSample: true, hero: s.hero, title: lang === 'es' ? s.title_es : s.title_en, startsAt: nextOccurrence(s.dow, s.local_time),
      category: isCategory(s.category) ? s.category : 'more', locationName: s.location_name, isOnline: false,
      lat: s.lat, lng: s.lng, capacity: s.capacity, going: s.going, goingNames: s.going_names, initials: s.going_names.map(n => n[0] ?? ''), hostName: s.host_name,
    }));
    return [...real, ...samples];
  },
});

export const socialProofQuery = () => queryOptions({
  queryKey: ['landing-social-proof'],
  staleTime: 5 * 60_000,
  queryFn: async () => {
    const { data } = await supabase.rpc('landing_social_proof');
    return Number((data as { showed_up?: number } | null)?.showed_up ?? 0);
  },
});

export type Testimonial = { id: string; name: string; city: string | null; quote_en: string; quote_es: string | null; avatar_url: string | null; photo_url: string | null };
export const testimonialsQuery = () => queryOptions({
  queryKey: ['testimonials'],
  staleTime: 10 * 60_000,
  queryFn: async (): Promise<Testimonial[]> => {
    const { data } = await supabase.from('testimonials').select('id,name,city,quote_en,quote_es,avatar_url,photo_url').eq('approved', true).order('sort_order');
    return (data ?? []) as Testimonial[];
  },
});

/** Spots-left threshold for the status chip. */
export function spotsLeft(g: FeedGathering) {
  if (g.isSample || !g.capacity) return null; // only real capacity data
  const left = g.capacity - g.going;
  return left > 0 && left <= 5 ? left : null;
}

export function isThisWeekend(d: Date) {
  const now = new Date();
  const day = now.getDay();
  const sat = new Date(now); sat.setHours(0, 0, 0, 0); sat.setDate(now.getDate() + ((6 - day + 7) % 7));
  if (day === 0) sat.setDate(sat.getDate() - 1);
  const end = new Date(sat); end.setDate(sat.getDate() + 2);
  return d >= sat && d < end && d.getTime() >= now.getTime() - 2 * 3600_000;
}

export function inNextDays(d: Date, days: number) {
  const now = Date.now();
  return d.getTime() >= now - 2 * 3600_000 && d.getTime() < now + days * 86400_000;
}

export function isToday(d: Date) {
  return d.toDateString() === new Date().toDateString();
}

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export function formatWhen(d: Date, lang: string) {
  const day = d.toLocaleDateString(lang === 'es' ? 'es-419' : 'en-US', { weekday: 'short' });
  const time = d.toLocaleTimeString(lang === 'es' ? 'es-419' : 'en-US', { hour: 'numeric', minute: '2-digit' }).replace(' AM', ' am').replace(' PM', ' pm');
  return `${day.replace('.', '')} ${time}`;
}

export function formatDistance(km: number, lang: string) {
  const number = (n: number) => new Intl.NumberFormat(lang === 'es' ? 'es-419' : 'en-US', { maximumFractionDigits: n < 10 ? 1 : 0 }).format(n);
  if (lang === 'es') return `${number(km)} km`;
  const mi = km * 0.621371;
  return `${number(mi)} mi`;
}

export type AnalyticsEvent = 'hero_find_click' | 'hero_host_click' | 'category_click' | 'feed_rsvp_click' | 'sticky_cta_click' | 'sticky_cta_view' | 'location_prompt_accept' | 'location_prompt_decline' | 'carousel_slide_click' | 'home_tool_click' | 'home_discover_path_click';

/** Landing events go through the shared analytics helper. */
export function track(event: AnalyticsEvent, props: Record<string, string | number | boolean | null | undefined> = {}) {
  const clean = Object.fromEntries(Object.entries(props).filter(([, v]) => v !== undefined)) as Record<string, string | number | boolean | null>;
  trackEvent(event, clean);
}

export type H1Variant = 'A' | 'B' | 'C' | 'D';
const H1_VARIANTS: H1Variant[] = ['A', 'B', 'C', 'D'];
/** Share of visitors per headline. A is the control. */
export const H1_WEIGHTS: Record<H1Variant, number> = { A: 1, B: 0, C: 1, D: 1 };

/** ?h1=B forces a variant; otherwise a weighted pick kept for the browser session. */
export function pickH1Variant(): H1Variant {
  if (typeof window === 'undefined') return 'A';
  const forced = new URLSearchParams(window.location.search).get('h1')?.toUpperCase();
  if (forced && (H1_VARIANTS as string[]).includes(forced)) return forced as H1Variant;
  const saved = sessionStorage.getItem('gw-h1');
  if (saved && (H1_VARIANTS as string[]).includes(saved) && H1_WEIGHTS[saved as H1Variant] > 0) return saved as H1Variant;
  const total = H1_VARIANTS.reduce((n, v) => n + H1_WEIGHTS[v], 0) || 1;
  let r = Math.random() * total, pick: H1Variant = 'A';
  for (const v of H1_VARIANTS) { r -= H1_WEIGHTS[v]; if (r <= 0) { pick = v; break; } }
  sessionStorage.setItem('gw-h1', pick);
  return pick;
}

export const HERO_SLOTS = ['hero_card_1', 'hero_card_2', 'hero_card_3', 'hero_card_4'] as const;
export const feedSlot = (c: Category) => `feed_default_${c === 'more' ? 'walk' : c === 'pilates' ? 'yoga' : c}`;

/** Tustin, CA — reference point for preview-only sample gathering distances. */
export const SAMPLE_ORIGIN = { lat: 33.7458, lng: -117.8262 } as const;

/** Platform feature flags (public read). */
export const featureFlagsQuery = () => queryOptions({
  queryKey: ['feature-flags'],
  queryFn: async () => {
    const { data } = await supabase.from('feature_flags').select('key, enabled, value');
    return Object.fromEntries((data ?? []).map(f => [f.key, { enabled: f.enabled, value: f.value }])) as Record<string, { enabled: boolean; value: string | null } | undefined>;
  },
  staleTime: 5 * 60_000,
});
