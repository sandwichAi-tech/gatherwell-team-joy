/**
 * Event cover rules — client mirror of the server checks in save_event_cover
 * (migration 0092). The RPC and CHECK constraints are authoritative.
 */

/** Curated ZoheeWell-branded gradient covers (Blueprint v4 palette). Index is stored in events.cover_style. */
export const COVER_STYLES = [
  'linear-gradient(135deg, #302338 0%, #5A4470 100%)',
  'linear-gradient(160deg, #302338 0%, #C78E76 135%)',
  'linear-gradient(135deg, #C78E76 0%, #D8D0C6 100%)',
  'radial-gradient(120% 120% at 0% 0%, #C78E76 0%, #302338 75%)',
  'linear-gradient(120deg, #46345A 0%, #8A6FA8 100%)',
  'linear-gradient(200deg, #241A2E 0%, #302338 55%, #C78E76 140%)',
] as const;

export const COVER_STYLE_COUNT = COVER_STYLES.length;

/** Overlay strengths (percent of a Midnight Plum scrim) for text readability over photos. */
export const COVER_OVERLAYS = [0, 25, 50] as const;

/** 3x3 focal-point grid values, stored as CSS object-position in events.cover_focal. */
export const COVER_FOCALS = [
  '0% 0%', '50% 0%', '100% 0%',
  '0% 50%', '50% 50%', '100% 50%',
  '0% 100%', '50% 100%', '100% 100%',
] as const;

export const DEFAULT_FOCAL = '50% 50%';

/** Clamp any stored/unknown style index into a valid palette slot. */
export function coverStyleAt(style: number | null | undefined): string {
  const i = typeof style === 'number' && Number.isFinite(style) ? Math.abs(Math.trunc(style)) : 0;
  return COVER_STYLES[i % COVER_STYLE_COUNT];
}

export function isValidOverlay(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 60;
}

export function isValidFocal(v: unknown): v is string {
  return typeof v === 'string' && /^([0-9]|[1-9][0-9]|100)% ([0-9]|[1-9][0-9]|100)%$/.test(v);
}

export function isValidAlt(v: unknown): boolean {
  return v == null || (typeof v === 'string' && v.length <= 200);
}

export function clampOverlay(v: unknown): number {
  return isValidOverlay(v) ? v : 0;
}

export function clampFocal(v: unknown): string {
  return isValidFocal(v) ? v : DEFAULT_FOCAL;
}
