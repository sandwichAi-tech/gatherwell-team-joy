/**
 * Strict same-origin return-path allowlist for sign-in and verification.
 * Mirrors public.is_safe_return_path() in the database; keep both in step.
 */
const SEGMENT_ROUTES = /^\/(e|l|t|h|i|r|join|offer|event|learn\/track|learn\/lesson|learn|challenge)\/[A-Za-z0-9_-]{1,80}(\?[A-Za-z0-9=&_-]{0,200})?$/;
const FIXED_ROUTES = /^\/(home|discover|gathering\/new|events|learn|me|start)$|^\/support(\?[A-Za-z0-9=&_-]{0,200})?$/;
export const DEFAULT_RETURN = '/home';

export function safeReturnPath(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  if (input.length === 0 || input.length > 512) return null;
  // Reject anything encoded, scheme-bearing, protocol-relative or containing control/backslash characters.
  if (/[%\\\s\u0000-\u001f\u007f]/.test(input)) return null;
  if (!input.startsWith('/') || input.startsWith('//')) return null;
  if (input.includes(':') || input.includes('..') || input.includes('#')) return null;
  return SEGMENT_ROUTES.test(input) || FIXED_ROUTES.test(input) ? input : null;
}

export function returnPathOr(input: unknown, fallback = DEFAULT_RETURN): string {
  return safeReturnPath(input) ?? fallback;
}

/** Same-tab OAuth return target. Short-lived convenience only — always re-validated on read. */
export const NEXT_KEY = 'zw-next';
export const NEXT_TTL_MS = 30 * 60 * 1000;
export function rememberNext(path: string, now = Date.now()) {
  const safe = safeReturnPath(path); if (!safe) return;
  try { sessionStorage.setItem(NEXT_KEY, JSON.stringify({ p: safe, t: now })); } catch { /* storage unavailable */ }
}
export function takeNext(now = Date.now()): string | null {
  try {
    const raw = sessionStorage.getItem(NEXT_KEY); sessionStorage.removeItem(NEXT_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { p?: unknown; t?: unknown };
    if (typeof v.t !== 'number' || now - v.t > NEXT_TTL_MS) return null;
    return safeReturnPath(v.p);
  } catch { return null; }
}
