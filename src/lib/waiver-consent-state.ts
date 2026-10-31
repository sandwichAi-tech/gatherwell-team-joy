import { useState } from 'react';
/** Consent belongs to the exact document/event context displayed, never the next context. */
export function useWaiverConsentState<T>(context: string, empty: T) {
  const [saved, setSaved] = useState({ context, value: empty });
  if (saved.context !== context) setSaved({ context, value: empty });
  const value = saved.context === context ? saved.value : empty;
  return [value, (next: T) => setSaved({ context, value: next })] as const;
}