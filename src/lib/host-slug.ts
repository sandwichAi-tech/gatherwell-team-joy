/**
 * Client-side mirror of the server-side profile-slug rules
 * (normalize_profile_slug / reserved_profile_slugs / set_profile_slug).
 * The RPC is authoritative; this only gives instant feedback in the editor.
 */

export const RESERVED_PROFILE_SLUGS: readonly string[] = [
  'h', 't', 'e', 'o', 'l', 'i', 'r', 's',
  'admin', 'admin-login', 'api', 'app', 'auth', 'login', 'join', 'me', 'onboarding',
  'discover', 'pricing', 'hosts', 'studios', 'events', 'event', 'offers', 'offer',
  'learn', 'resources', 'support', 'settings', 'terms', 'privacy', 'legal', 'credits',
  'verify', 'unsubscribe', 'sitemap', 'robots', 'favicon', 'manifest', 'push-sw',
  'www', 'mail', 'help', 'about', 'blog', 'shop', 'store', 'team', 'teams', 'host',
  'follow', 'following', 'tickets', 'ticket', 'notifications', 'messages', 'insights',
  'calendar', 'invite', 'invites', 'static', 'assets', 'zoheewell', 'gatherwell',
  'official', 'null', 'undefined', 'root', 'system', 'moderator', 'staff',
];

const ACCENTS: Record<string, string> = {
  á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', ñ: 'n', ü: 'u',
};

/** Mirrors public.normalize_profile_slug: lowercase, accent-fold, hyphenate, trim, cap 40. */
export function normalizeProfileSlug(raw: string): string {
  const folded = (raw ?? '').toLowerCase().replace(/[áéíóúñü]/g, c => ACCENTS[c] ?? c);
  return folded.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

export type SlugProblem = 'invalid_slug' | 'reserved_slug' | null;

/** Mirrors the server format + reserved checks. Uniqueness is only knowable server-side. */
export function validateProfileSlug(raw: string): SlugProblem {
  const slug = normalizeProfileSlug(raw);
  if (!/^[a-z0-9][a-z0-9-]{2,39}$/.test(slug)) return 'invalid_slug';
  if (RESERVED_PROFILE_SLUGS.includes(slug)) return 'reserved_slug';
  return null;
}

/** Maps an RPC error message to a translation key suffix under hostProfile.slug. */
export function slugErrorKey(message: string): string {
  if (/reserved_slug/.test(message)) return 'reserved';
  if (/slug_taken/.test(message)) return 'taken';
  if (/rate_limited/.test(message)) return 'rateLimited';
  if (/invalid_slug/.test(message)) return 'invalid';
  return 'failed';
}
