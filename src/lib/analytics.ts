import { sendAnalytics, type TrackedEvent } from './analytics.functions';

function anonId() {
  try {
    let id = localStorage.getItem('gatherwell-aid');
    if (!id) { id = crypto.randomUUID(); localStorage.setItem('gatherwell-aid', id); }
    return id;
  } catch { return 'anon'; }
}

/** The only analytics entry point. Fire-and-forget; never throws, never blocks UI. */
export function trackEvent(event: TrackedEvent, props: Record<string, string | number | boolean | null> = {}) {
  if (typeof window === 'undefined') return;
  const w = window as unknown as { dataLayer?: unknown[] };
  w.dataLayer?.push({ event, ...props });
  if (import.meta.env.DEV) console.info('[analytics]', event, props);
  void sendAnalytics({ data: { event, distinctId: anonId(), props } }).catch(() => {});
}
