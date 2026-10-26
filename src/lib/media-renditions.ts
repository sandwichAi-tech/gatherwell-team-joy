// Responsive renditions for private, signed storage images.
// Every rendition is a separately signed URL from the storage image transformer
// (`resize: 'contain'` keeps the uploaded crop/aspect and never enlarges past the
// original), so private media stays private and no raw storage path is exposed.

/** Widths offered in srcset. Uploads are encoded at most 2400px wide (image-crop MAX). */
export const RENDITION_WIDTHS = [480, 960, 1600, 2400] as const;
/** Cards never display wider than ~400 CSS px, so 1600 covers 3x screens. */
export const CARD_RENDITION_WIDTHS = [480, 960, 1600] as const;
export const RENDITION_QUALITY = 80;
/** Below this source width a full-width cover can look soft on large or high-density screens. */
export const LOW_RES_MIN_WIDTH = 1200;

export type Rendition = { src: string; srcSet?: string | undefined };
/** What BrandImage accepts: a plain URL or a signed rendition set. */
export type MediaSrc = string | Rendition | null | undefined;

export function toRendition(m: MediaSrc): Rendition | null {
  if (!m) return null;
  return typeof m === 'string' ? { src: m } : m.src ? m : null;
}

/** Plain URL for places that need one string (og:image, CSS backgrounds). */
export function mediaHref(m: MediaSrc): string | null {
  return toRendition(m)?.src ?? null;
}

export function buildSrcSet(entries: { width: number; url: string | null | undefined }[]): string | undefined {
  const ok = entries.filter((e): e is { width: number; url: string } => !!e.url).sort((a, b) => a.width - b.width);
  return ok.length ? ok.map(e => `${e.url} ${e.width}w`).join(', ') : undefined;
}

/** The rendition a browser should pick for a slot (mirrors srcset selection; used in tests and sizing decisions). */
export function pickRenditionWidth(cssWidth: number, dpr: number, widths: readonly number[] = RENDITION_WIDTHS): number {
  const need = Math.ceil(cssWidth * Math.max(1, dpr));
  const sorted = [...widths].sort((a, b) => a - b);
  return sorted.find(w => w >= need) ?? sorted[sorted.length - 1]!;
}

/** True when an image's real pixels are too few for a full-width cover; used for an honest host warning, never to replace the photo. */
export function isLowResolution(width: number, minWidth = LOW_RES_MIN_WIDTH): boolean {
  return width > 0 && width < minWidth;
}

type SignResult = { data: { signedUrl: string } | null; error: unknown };
export type SigningBucket = {
  createSignedUrl: (path: string, expiresIn: number, options?: { transform?: { width?: number; quality?: number; resize?: 'cover' | 'contain' | 'fill' } }) => Promise<SignResult>;
};

/**
 * Signs the original plus resized renditions of one storage path. If the transformer
 * is unavailable, falls back to the original alone so images never break.
 */
export async function signRendition(bucket: SigningBucket, path: string, expiresIn = 3600, widths: readonly number[] = RENDITION_WIDTHS): Promise<Rendition | null> {
  if (/^https?:/.test(path)) return { src: path };
  const [original, ...sized] = await Promise.all([
    bucket.createSignedUrl(path, expiresIn).catch(() => ({ data: null, error: true })),
    ...widths.map(w => bucket.createSignedUrl(path, expiresIn, { transform: { width: w, quality: RENDITION_QUALITY, resize: 'contain' } }).catch(() => ({ data: null, error: true }))),
  ]);
  const src = original?.data?.signedUrl;
  if (!src) return null;
  const srcSet = buildSrcSet(widths.map((w, i) => ({ width: w, url: sized[i]?.error ? null : sized[i]?.data?.signedUrl })));
  return srcSet ? { src, srcSet } : { src };
}

/** Width (px) the crop step will encode for a selection: the selection's real pixels, capped at maxSide on the longer edge. Never enlarged. */
export function croppedOutputWidth(sw: number, sh: number, maxSide = 2400): number {
  const scale = Math.min(1, maxSide / Math.max(sw, sh, 1));
  return Math.max(1, Math.round(sw * scale));
}
