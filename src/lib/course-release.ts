/**
 * Course lesson-release schedule. Mirrors public.lesson_unlock_at (migration 0130), which is authoritative:
 * lesson N (0-based, in course order) opens at access start + N × dripDays days. dripDays 0 = all open.
 * Access start = earliest live entitlement/purchase (else free-team join), never before activation.
 */
export const DAY_MS = 86_400_000;

export function accessStart(grants: (string | null | undefined)[], availableFrom?: string | null): Date | null {
  const times = grants.filter((x): x is string => !!x).map(x => new Date(x).getTime());
  if (!times.length) return null;
  const start = Math.min(...times);
  const live = availableFrom ? new Date(availableFrom).getTime() : -Infinity;
  return new Date(Math.max(start, live));
}

export function unlockAt(start: Date, index: number, dripDays: number): Date | null {
  if (dripDays <= 0 || index <= 0) return null;
  return new Date(start.getTime() + index * dripDays * DAY_MS);
}

export const isUnlocked = (at: Date | string | null | undefined, now = Date.now()) => !at || new Date(at).getTime() <= now;

/** Localized unlock date shown to the member, in their own time zone. */
export const formatUnlock = (iso: string, lang: string, timeZone?: string) =>
  new Intl.DateTimeFormat(lang === 'es' ? 'es-MX' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short', ...(timeZone ? { timeZone } : {}) }).format(new Date(iso));
