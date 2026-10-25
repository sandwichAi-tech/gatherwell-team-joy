import type { CreateType } from '@/lib/create-resource';
import { isTrackFlow, offerKindFor } from '@/lib/create-resource';

/**
 * Item-level resource authoring model: which editor sections each type shows,
 * the branded card/accent choices, rich-text sanitizing for promotional copy,
 * and per-type validation. Pure and unit-tested; the builder component renders it.
 */

export const ITEM_SECTIONS = ['presentation', 'content', 'access', 'options', 'preview'] as const;
export type ItemSection = (typeof ITEM_SECTIONS)[number];

/** Sections relevant per type. Quiz has no pricing/access of its own; link/recipe have no checkout. */
export function sectionsFor(type: CreateType): ItemSection[] {
  const out: ItemSection[] = ['presentation', 'content'];
  if (offerKindFor(type) || isTrackFlow(type)) out.push('access');
  if (offerKindFor(type)) out.push('options');
  out.push('preview');
  return out;
}

export const CARD_LAYOUTS = ['button', 'callout', 'preview'] as const;
export type CardLayout = (typeof CARD_LAYOUTS)[number];

/** Layout choices per type: link/button-forward types keep all three; file-heavy types skip the bare button. */
export function cardLayoutsFor(type: CreateType): CardLayout[] {
  if (type === 'file' || type === 'bundle' || type === 'course') return ['callout', 'preview'];
  return [...CARD_LAYOUTS];
}

/** Brand palette accents with pre-validated contrast pairs (fg on bg). */
export const ACCENTS = {
  plum: { bg: '#302338', fg: '#F8F5F0' },
  terracotta: { bg: '#C78E76', fg: '#302338' },
  concrete: { bg: '#D8D0C6', fg: '#302338' },
  ivory: { bg: '#F8F5F0', fg: '#302338' },
} as const;
export type Accent = keyof typeof ACCENTS;
export const ACCENT_KEYS = Object.keys(ACCENTS) as Accent[];
export const accentPair = (a: string) => (ACCENTS as Record<string, { bg: string; fg: string }>)[a] ?? ACCENTS.plum;

/** Default CTA label key per access state; the builder localizes it. */
export const defaultCtaKey = (paid: boolean) => (paid ? 'resources.item.ctaBuy' : 'resources.item.ctaGet');

/* ---------- Rich text (promotional landing copy) ---------- */

const ALLOWED_TAGS = new Set(['h3', 'h4', 'p', 'ul', 'ol', 'li', 'strong', 'em', 'b', 'i', 'a', 'br']);

/**
 * Reduce arbitrary HTML to a safe promotional subset: headings, paragraphs, lists,
 * bold/italic and https links. Everything else is unwrapped or dropped; all
 * attributes except a safe href are removed.
 */
export function sanitizeRichText(html: string): string {
  if (!html.trim()) return '';
  let out = html
    .replace(/<\s*(script|style|iframe|object|embed|form|input|button)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|style|iframe|object|embed|form|input|button)[^>]*\/?>/gi, '');
  // Drop event handlers and non-href attributes, then any tag outside the allowlist.
  out = out.replace(/<([a-zA-Z][a-zA-Z0-9]*)((?:\s+[^<>]*?)?)>/g, (m, tag: string, attrs: string) => {
    const t = tag.toLowerCase();
    if (!ALLOWED_TAGS.has(t)) return '';
    if (t === 'br') return '<br>';
    if (t === 'a') {
      const href = attrs.match(/href\s*=\s*"(https?:\/\/[^"]*)"/i)?.[1];
      return href ? `<a href="${href}" target="_blank" rel="noopener noreferrer">` : '<a>';
    }
    return `<${t}>`;
  });
  out = out.replace(/<\/([a-zA-Z][a-zA-Z0-9]*)>/g, (m, tag: string) => (ALLOWED_TAGS.has(tag.toLowerCase()) ? `</${tag.toLowerCase()}>` : ''));
  return out.trim().slice(0, 8000);
}

/** True when sanitized promo copy actually has visible text. */
export const richTextHasContent = (html: string) => sanitizeRichText(html).replace(/<[^>]+>/g, '').trim().length > 0;

/* ---------- Shared item state ---------- */

export type ItemAccess = { free: boolean; price: string };

export type ItemState = {
  titleEn: string; titleEs: string;
  subtitleEn: string; subtitleEs: string;
  descEn: string; descEs: string;
  promoEn: string; promoEs: string;
  ctaEn: string; ctaEs: string;
  coverPath: string | null; coverStyle: number;
  cardLayout: CardLayout; accent: Accent;
  access: ItemAccess;
};

export const emptyItemState = (): ItemState => ({
  titleEn: '', titleEs: '', subtitleEn: '', subtitleEs: '', descEn: '', descEs: '',
  promoEn: '', promoEs: '', ctaEn: '', ctaEs: '',
  coverPath: null, coverStyle: 0, cardLayout: 'preview', accent: 'plum',
  access: { free: true, price: '' },
});

const validUrl = (u: string) => !u || /^https?:\/\/\S+$/i.test(u);

/** Validation issues for the current type + access model; only relevant fields are checked. */
export function itemIssues(type: CreateType, s: ItemState, extra: {
  lessonUrl?: string; live?: string; filePath?: string | null; courseId?: string; publish?: boolean;
}): string[] {
  const out: string[] = [];
  if (!s.titleEn.trim() && !s.titleEs.trim()) out.push('title');
  if (type === 'link' && (!extra.lessonUrl?.trim() || !validUrl(extra.lessonUrl))) out.push('url');
  if (type === 'live' && !extra.live) out.push('live_time');
  if (type === 'quiz' && !extra.courseId) out.push('course');
  if (!s.access.free) {
    const cents = s.access.price ? Math.round(Number(s.access.price) * 100) : NaN;
    if (!Number.isFinite(cents) || cents < 50 || cents > 100000) out.push('price');
  }
  if ((type === 'file' || type === 'bundle') && extra.publish && !extra.filePath) out.push('file');
  return out;
}

/** A saved snapshot for dirty tracking; any difference means unsaved changes. */
export const itemSnapshot = (s: ItemState) =>
  JSON.stringify([s.titleEn, s.titleEs, s.subtitleEn, s.subtitleEs, s.descEn, s.descEs, s.promoEn, s.promoEs, s.ctaEn, s.ctaEs, s.coverPath, s.coverStyle, s.cardLayout, s.accent, s.access.free, s.access.price]);
