import { supabase } from '@/integrations/supabase/client';

/** Check both sides of a request: a late response cannot populate another account's cache. */
export async function teamCallerQuery<T>(userId: string, signal: AbortSignal, read: () => Promise<T>): Promise<T> {
  const check = async () => {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    const { data, error } = await supabase.auth.getUser();
    if (error || !userId || data.user?.id !== userId) throw new Error('identity_changed');
  };
  await check();
  const value = await read();
  await check();
  return value;
}

const CHANNEL = 'zoheewell-team-boundary';
export function announceTeamChange(teamId: string) {
  if (typeof BroadcastChannel === 'undefined') return;
  const channel = new BroadcastChannel(CHANNEL);
  channel.postMessage({ teamId }); channel.close();
}
export function listenTeamChanges(onChange: (teamId: string) => void) {
  if (typeof BroadcastChannel === 'undefined') return () => {};
  const channel = new BroadcastChannel(CHANNEL);
  channel.onmessage = event => { if (typeof event.data?.teamId === 'string') onChange(event.data.teamId); };
  return () => channel.close();
}