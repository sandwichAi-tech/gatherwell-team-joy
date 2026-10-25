import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { embedUrl } from '@/lib/learn';

/** Client-side mirrors of the rules migration 0057 enforces server-side for course/resource authoring and learner access. */

export type ContentVisibility = 'team' | 'public' | 'unlisted' | 'private';
export type BillingInterval = 'month' | 'year' | null;

export type PublicOffer = {
  id: string; kind: 'membership' | 'course' | 'download';
  title_en: string; title_es: string; summary_en: string | null; summary_es: string | null;
  subtitle_en?: string | null; subtitle_es?: string | null;
  cta_en?: string | null; cta_es?: string | null;
  card_layout?: string | null; accent?: string | null;
  promo_en?: string | null; promo_es?: string | null;
  description_en: string | null; description_es: string | null;
  includes_en: string[]; includes_es: string[]; category: string | null; tags: string[];
  cover_style: number; cover_url: string | null; host_name: string | null; coauthor_name: string | null;
  accessibility_notes: string | null; version_label: string | null; license_en: string | null; license_es: string | null;
  price_cents: number; currency: string; billing_interval: BillingInterval;
  enroll_opens_at: string | null; enroll_closes_at: string | null;
  sections: { id: string; title_en: string; title_es: string; description_en: string | null; description_es: string | null;
    lessons: { id: string; title_en: string; title_es: string; type: string; duration_minutes: number | null; is_preview: boolean }[] | null }[];
  items: { id: string; type: string; title_en: string; title_es: string; is_preview: boolean; allow_download: boolean }[];
};

export type LearningEntry = {
  id: string; kind: string; title_en: string; title_es: string; summary_en: string | null; summary_es: string | null;
  cover_style: number; cover_url: string | null; status: string; host_name: string | null;
  source: string; enrolled_at: string; lessons: number; done: number;
};

const db = supabase as unknown as { rpc: (f: string, a?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>; from: (t: string) => any };

/** Public offering metadata for guests and prospects; null when not published/public. */
export const publicOfferQuery = (id: string) => queryOptions({
  queryKey: ['public-offer', id],
  queryFn: async (): Promise<PublicOffer | null> => {
    const { data, error } = await db.rpc('get_public_offer', { _id: id });
    if (error) throw error;
    return (data as PublicOffer | null) ?? null;
  },
  staleTime: 60_000,
});

/** The signed-in learner's library: enrolled and granted offerings with real progress. */
export const myLearningQuery = (userId: string) => queryOptions({
  queryKey: ['my-learning', userId],
  queryFn: async (): Promise<LearningEntry[]> => {
    const { data, error } = await db.rpc('my_learning');
    if (error) throw error;
    return (data as LearningEntry[] | null) ?? [];
  },
});

export const offerReadinessQuery = (id: string) => queryOptions({
  queryKey: ['offer-readiness', id],
  queryFn: async (): Promise<{ blockers: string[]; sections: number; lessons: number }> => {
    const { data, error } = await db.rpc('offer_readiness', { _offer: id });
    if (error) throw error;
    return (data as { blockers: string[]; sections: number; lessons: number }) ?? { blockers: [], sections: 0, lessons: 0 };
  },
});

export const canAccessOfferQuery = (id: string, userId: string) => queryOptions({
  queryKey: ['offer-access', id, userId],
  queryFn: async (): Promise<boolean> => {
    const { data } = await db.rpc('can_access_offer', { _offer: id });
    return data === true;
  },
});

export const enrollFree = (id: string) => db.rpc('enroll_free', { _offer: id });
export const duplicateOffer = (id: string) => db.rpc('duplicate_offer', { _offer: id });
export const grantOfferAccess = (id: string, email: string) => db.rpc('grant_offer_access', { _offer: id, _email: email });

/* ---------- validation mirrors ---------- */

/** Lesson/resource links must be https (or empty). */
export const isHttpsUrl = (u: string) => !u || /^https:\/\/[^\s]+$/i.test(u.trim());

/** Embeds are limited to the approved allowlist (YouTube/Vimeo via embedUrl); other hosts render as plain links. */
export const isAllowedEmbed = (u: string) => embedUrl(u) !== null;

export const LESSON_FILE_RULES: Record<string, { accept: string; maxMb: number; mime: RegExp }> = {
  video: { accept: 'video/*', maxMb: 500, mime: /^video\// },
  audio: { accept: 'audio/*', maxMb: 100, mime: /^audio\// },
  pdf: { accept: 'application/pdf,.pdf', maxMb: 50, mime: /^application\/pdf$/ },
  file: { accept: 'application/pdf,.pdf,.epub,.zip,.csv,.txt', maxMb: 50, mime: /^(application\/(pdf|epub\+zip|zip|x-zip-compressed|csv|vnd\.ms-excel)|text\/(plain|csv))$/ },
};

/** Returns null when the file is acceptable for the lesson type, else an error key. */
export function lessonFileError(type: string, file: { size: number; type: string }): 'too_large' | 'bad_type' | null {
  const rule = LESSON_FILE_RULES[type];
  if (!rule) return null;
  if (file.size > rule.maxMb * 1024 * 1024) return 'too_large';
  if (file.type && !rule.mime.test(file.type)) return 'bad_type';
  return null;
}

export type ReadinessInput = {
  title_en?: string | null; title_es?: string | null;
  summary_en?: string | null; summary_es?: string | null;
  description_en?: string | null; description_es?: string | null;
  kind: string; file_path?: string | null; price_cents?: number;
  sections: number; lessons: number;
};

/** Mirror of offer_readiness(): every blocker that must clear before publishing. */
export function readinessBlockers(o: ReadinessInput): string[] {
  const b: string[] = [];
  if (!o.title_en?.trim() && !o.title_es?.trim()) b.push('missing_title');
  if (!o.summary_en?.trim() && !o.summary_es?.trim()) b.push('missing_summary');
  if (!o.description_en?.trim() && !o.description_es?.trim()) b.push('missing_description');
  if (o.kind === 'download' && !o.file_path) b.push('missing_file');
  if (o.kind === 'course' || o.kind === 'membership') {
    if (o.sections === 0) b.push('no_sections');
    if (o.lessons === 0) b.push('no_lessons');
  }
  if ((o.price_cents ?? 0) > 0) b.push('paid_setup_required');
  return b;
}

/** Enrollment window state for the public page. */
export function enrollmentState(o: Pick<PublicOffer, 'enroll_opens_at' | 'enroll_closes_at'>, now = new Date()): 'open' | 'not_yet' | 'closed' {
  if (o.enroll_opens_at && now < new Date(o.enroll_opens_at)) return 'not_yet';
  if (o.enroll_closes_at && now > new Date(o.enroll_closes_at)) return 'closed';
  return 'open';
}

/** Commerce configuration label: paid options stay Setup required until checkout is verified. */
export function commerceMode(o: { price_cents?: number; billing_interval?: BillingInterval }): 'free' | 'one_time' | 'subscription' {
  if (!o.price_cents) return 'free';
  return o.billing_interval ? 'subscription' : 'one_time';
}

/** Paid content actions are never live in this milestone. */
export const paidSetupRequired = (o: { price_cents?: number }) => (o.price_cents ?? 0) > 0;

/* ---------- Resource bundle items (migration 0060) ---------- */

export type BundleItem = {
  id: string; offer_id: string; sort_order: number;
  type: 'text' | 'file' | 'link' | 'embed';
  title_en: string; title_es: string; body_en: string | null; body_es: string | null;
  url: string | null; storage_path: string | null;
  is_preview: boolean; allow_download: boolean; is_published: boolean;
  replaced_by: string | null; created_at: string;
};

/** Host view: all current items (replaced versions hidden) in order. */
export const bundleItemsQuery = (offerId: string) => queryOptions({
  queryKey: ['bundle-items', offerId],
  queryFn: async (): Promise<BundleItem[]> => {
    const { data, error } = await db.from('offer_items').select('*').eq('offer_id', offerId).is('replaced_by', null).order('sort_order').order('created_at');
    if (error) throw error;
    return (data ?? []) as BundleItem[];
  },
});

/** Entitled learner view: published current items only. */
export const bundleAccessQuery = (offerId: string, userId: string) => queryOptions({
  queryKey: ['bundle-access', offerId, userId],
  queryFn: async (): Promise<BundleItem[]> => {
    const { data, error } = await db.from('offer_items').select('id, offer_id, sort_order, type, title_en, title_es, body_en, body_es, url, is_preview, allow_download')
      .eq('offer_id', offerId).is('replaced_by', null).eq('is_published', true).order('sort_order').order('created_at');
    if (error) throw error;
    return (data ?? []) as BundleItem[];
  },
});

export const replaceOfferItem = (itemId: string, patch: Record<string, unknown>) =>
  db.rpc('replace_offer_item', { _item: itemId, _p: patch });

/** Bundle items follow the same link/embed rules as lessons. */
export function bundleItemError(item: { type: string; url?: string | null; storage_path?: string | null; body?: string | null }): 'https' | 'missing_content' | null {
  if (item.type === 'text') return item.body?.trim() ? null : 'missing_content';
  if (item.type === 'file') return item.storage_path ? null : 'missing_content';
  if (!item.url || !isHttpsUrl(item.url)) return item.url ? 'https' : 'missing_content';
  return null;
}
