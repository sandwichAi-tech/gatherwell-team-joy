import type { PersonalHome } from './personal-home';

export function homeNextAction(home: PersonalHome | undefined) {
  if (!home || home.mode !== 'hosting' || !home.event_progress) return null;
  if (home.event_progress.draft) return { kind: 'draft' as const, ...home.event_progress.draft };
  if (!home.event_progress.exists) return { kind: 'first' as const };
  // Sharing has no authoritative completion state; do not repeatedly recommend it.
  return null;
}

export function eventLocalDay(instant: string, timezone: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(instant));
}