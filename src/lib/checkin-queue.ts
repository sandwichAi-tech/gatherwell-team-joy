export type PendingCheckin = { key: string; eventId: string; rsvpId?: string; code?: string; undo: boolean };
export function isRetryableCheckinError(error: { code?: string; message?: string }, status?: number) {
  return !error.code || (status !== undefined && (status === 0 || status === 408 || status === 429 || status >= 500));
}
/** Memory only: never persist guest names, codes, or attendance in browser storage. */
export function createCheckinQueue() {
  let pending: PendingCheckin[] = [];
  return {
    add(item: PendingCheckin) { pending = [...pending.filter(p => p.key !== item.key), item]; },
    items() { return [...pending]; },
    remove(key: string) { pending = pending.filter(p => p.key !== key); },
  };
}