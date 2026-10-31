import type { QueryClient } from '@tanstack/react-query';

const PERSONAL_KEYS = new Set(['personal-home', 'daily-brief-personal', 'host-checkin-events', 'followups', 'profile', 'teams', 'workspace', 'my-team-states']);
/** Cancel first, then remove retained values instead of merely marking them stale. */
export async function clearPersonalModeCache(client: QueryClient, userId: string) {
  const filters = { predicate: (query: { queryKey: readonly unknown[] }) => (PERSONAL_KEYS.has(String(query.queryKey[0])) && query.queryKey[1] === userId) || String(query.queryKey[0]).startsWith('team-') || query.queryKey[0] === 'private-team-access' };
  await client.cancelQueries(filters);
  client.removeQueries(filters);
}
/** Auth callbacks must discard retained data immediately, not after a promise settles. */
export function clearIdentityCache(client: QueryClient) {
  const cancelled = client.cancelQueries();
  client.clear();
  return cancelled;
}
const CHANNEL = 'zoheewell-personal-mode';
export function announceModeChange(userId: string) {
  if (typeof BroadcastChannel === 'undefined') return;
  const channel = new BroadcastChannel(CHANNEL);
  channel.postMessage({ userId }); channel.close();
}
export function listenModeChanges(onChange: (userId: string) => void) {
  if (typeof BroadcastChannel === 'undefined') return () => {};
  const channel = new BroadcastChannel(CHANNEL);
  channel.onmessage = event => { const id = event.data?.userId; if (typeof id === 'string') onChange(id); };
  return () => channel.close();
}