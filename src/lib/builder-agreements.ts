import type { PlatformAgreement } from '@/lib/event-agreements';

export type WaiverPick = { id: string; version: number };
export type OwnWaiver = { id: string; version: number; archived: boolean; is_default: boolean };
export type AgreementStatus = 'ready' | 'missing' | 'loading' | 'error' | 'none' | 'stale' | 'unavailable';

/** ZoheeWell agreement is ready only when both approved EN and ES documents exist. */
export function platformStatus(a: PlatformAgreement | null | undefined, loading: boolean, failed: boolean): AgreementStatus {
  if (loading) return 'loading';
  if (failed) return 'error';
  return a?.ready && a.en_id && a.es_id ? 'ready' : 'missing';
}

/** Status of the optional host waiver selection against the caller's own library. */
export function hostWaiverStatus(picks: WaiverPick[], own: OwnWaiver[] | undefined, locked: boolean): AgreementStatus {
  if (!picks.length) return 'none';
  if (locked) return 'ready';
  if (!own) return 'loading';
  for (const p of picks) {
    const w = own.find(x => x.id === p.id);
    if (!w || w.archived) return 'unavailable';
    if (w.version > p.version) return 'stale';
  }
  return 'ready';
}

/** Publishing requires the platform agreement and any selected host waiver to still be the caller's own. */
export function publishBlocked(platform: AgreementStatus, host: AgreementStatus) {
  return platform !== 'ready' || host === 'unavailable' || host === 'loading';
}

/** New events (not edits or duplicates) start with the host's default waiver, if any. */
export function initialHostPick(own: OwnWaiver[] | undefined, isNew: boolean): WaiverPick[] {
  if (!isNew || !own) return [];
  const d = own.find(w => w.is_default && !w.archived);
  return d ? [{ id: d.id, version: d.version }] : [];
}

/** Choosing one waiver replaces any earlier selection; null means no additional host waiver. */
export function pickOne(own: OwnWaiver[] | undefined, id: string | null): WaiverPick[] {
  if (!id) return [];
  const w = own?.find(x => x.id === id && !x.archived);
  return w ? [{ id: w.id, version: w.version }] : [];
}

/** Adds a form at the end (no duplicates); ignores archived or unknown forms. */
export function addPick(value: WaiverPick[], own: OwnWaiver[] | undefined, id: string): WaiverPick[] {
  if (value.some(v => v.id === id)) return value;
  const w = own?.find(x => x.id === id && !x.archived);
  return w ? [...value, { id: w.id, version: w.version }] : value;
}
export const removePick = (value: WaiverPick[], id: string) => value.filter(v => v.id !== id);
/** Moves one selection up (-1) or down (+1); out-of-range moves are no-ops. */
export function movePick(value: WaiverPick[], id: string, dir: -1 | 1): WaiverPick[] {
  const i = value.findIndex(v => v.id === id); const j = i + dir;
  if (i < 0 || j < 0 || j >= value.length) return value;
  const next = [...value]; [next[i], next[j]] = [next[j]!, next[i]!]; return next;
}
