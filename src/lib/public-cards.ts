import { accentPair, type Accent, type CardLayout } from '@/lib/resource-item';

/**
 * Public resource card model: turns the raw offering fields from get_public_host /
 * get_public_offer into a render-ready card with language fallbacks, whitelisted
 * layout/accent values and resilient defaults for missing or long text.
 */

export type PublicOffering = {
  kind: string; id: string;
  /** 'offer' rows open the offer landing; 'track' rows open the canonical track access route. */
  entity?: 'offer' | 'track';
  title?: string | null; title_en?: string | null; title_es?: string | null;
  summary?: string | null; summary_en?: string | null; summary_es?: string | null;
  subtitle_en?: string | null; subtitle_es?: string | null;
  cta_en?: string | null; cta_es?: string | null;
  card_layout?: string | null; accent?: string | null;
  cover_url?: string | null; cover_style?: number | null;
  price_cents?: number | null;
};

export type PublicCardModel = {
  title: string;
  subtitle: string;
  cta: string;
  layout: CardLayout;
  accent: Accent;
  colors: { bg: string; fg: string };
  coverStyle: number;
  coverPath: string | null;
  paid: boolean;
};

const LAYOUTS: readonly string[] = ['button', 'callout', 'preview'];

const pickLang = (lang: string, en?: string | null, es?: string | null) =>
  ((lang === 'es' ? es || en : en || es) ?? '').trim();

/** Bound long text so cards stay readable; adds an ellipsis when cut. */
export const boundText = (s: string, max: number) => (s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`);

export function publicCardModel(o: PublicOffering, lang: string, fallbackTitle: string, defaultCta: string): PublicCardModel {
  const title = boundText(pickLang(lang, o.title_en ?? o.title, o.title_es) || fallbackTitle, 90);
  const subtitle = boundText(pickLang(lang, o.subtitle_en, o.subtitle_es) || pickLang(lang, o.summary_en ?? o.summary, o.summary_es), 140);
  const cta = boundText(pickLang(lang, o.cta_en, o.cta_es) || defaultCta, 40);
  const layout = (LAYOUTS.includes(o.card_layout ?? '') ? o.card_layout : 'preview') as CardLayout;
  const accent = (o.accent ?? 'plum') as Accent;
  return {
    title, subtitle, cta, layout, accent,
    colors: accentPair(accent),
    coverStyle: o.cover_style ?? 0,
    coverPath: o.cover_url ?? null,
    paid: (o.price_cents ?? 0) > 0,
  };
}

/** Canonical destination for a public card: offers keep the /o landing; tracks use the signed-in track access route. */
export function publicCardRoute(o: Pick<PublicOffering, 'id' | 'entity'>): { to: '/o/$id' | '/learn/track/$id'; id: string } {
  return o.entity === 'track' ? { to: '/learn/track/$id', id: o.id } : { to: '/o/$id', id: o.id };
}

/** Translation key for the card's type label, per underlying model. */
export function publicKindKey(o: Pick<PublicOffering, 'kind' | 'entity'>): string {
  return o.entity === 'track' ? `resources.types.${o.kind}` : `offers.kind.${o.kind}`;
}
