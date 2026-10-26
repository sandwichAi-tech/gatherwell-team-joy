import { CATEGORIES, type Category } from '@/lib/landing';
import { safeReturnPath } from '@/lib/return-to';

/** Mirrors public.normalize_host_categories(): allowed keys only, legacy labels mapped, duplicates removed, order kept. */
const LEGACY: Record<string, Category> = {
  'run club': 'run', 'run clubs': 'run', running: 'run', 'fit camp': 'fitcamp', 'fit camps': 'fitcamp',
  'sound bath': 'soundbath', 'sound baths': 'soundbath', hikes: 'hike', hiking: 'hike', walks: 'walk', walking: 'walk',
};
export const MAX_HOST_CATEGORIES = 8;
export function normalizeCategories(input: readonly (string | null | undefined)[] | null | undefined): Category[] {
  const out: Category[] = [];
  for (const raw of input ?? []) {
    const v = (raw ?? '').trim().toLowerCase();
    const k = ((CATEGORIES as string[]).includes(v) ? v : LEGACY[v]) as Category | undefined;
    if (k && !out.includes(k)) out.push(k);
  }
  return out;
}
/** Saved values that are not allowed categories (shown so the host knows they'll be dropped). */
export function legacyCategories(input: readonly string[] | null | undefined): string[] {
  return (input ?? []).filter(v => !normalizeCategories([v]).length);
}
export function toggleCategory(list: Category[], c: Category): Category[] {
  if (list.includes(c)) return list.filter(x => x !== c);
  return list.length >= MAX_HOST_CATEGORIES ? list : [...list, c];
}

/** Friend invitations (/i/CODE) vs paid referral links (?rc=) are distinct; only well-formed invite codes are accepted. */
export const INVITE_CODE_RE = /^[A-Z0-9]{6,10}$/i;
export function inviteLanding(code: string, signedIn: boolean) {
  const valid = INVITE_CODE_RE.test(code);
  const next = safeReturnPath('/discover') ?? '/discover';
  return { valid, primary: '/discover' as const, signup: signedIn ? null : { to: '/login' as const, search: { next } } };
}

/** One editor per field: account editor owns identity fields; public-page editor owns presentation fields. */
export const PROFILE_FIELDS = {
  account: ['full_name', 'bio', 'city', 'phone', 'shop_url', 'language', 'avatar_url', 'cover_url'],
  publicPage: ['slug', 'host_public', 'host_org', 'host_categories', 'host_languages', 'host_accessibility', 'host_links', 'city_public'],
} as const;
export type MePanelParam = 'edit' | 'hostProfile' | 'invite';
export function mePanelFromSearch(v: unknown): MePanelParam | undefined {
  return v === 'edit' || v === 'hostProfile' || v === 'invite' ? v : undefined;
}

export const TEAM_DESCRIPTION_MAX = 500;
export function teamEditIssues(name: string, description: string): ('name' | 'description')[] {
  const out: ('name' | 'description')[] = [];
  const n = name.trim();
  if (n.length < 2 || n.length > 80) out.push('name');
  if (description.length > TEAM_DESCRIPTION_MAX) out.push('description');
  return out;
}
