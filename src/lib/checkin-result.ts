export type CheckinResult = { result: 'ok' | 'already' | 'not_found' | 'wrong_event' | 'waiver_required' | 'event_unavailable' | 'registration_required' | 'rate_limited' | 'error' | 'pending' | 'cancelled' | 'waitlist'; name?: string };

/** Only formatting is removed; URLs and unexpected payloads must never become admission codes. */
export function normalizeCheckinCode(code: string): string | null {
  const normalized = code.trim().replace(/[ -]/g, '').toLowerCase();
  return /^[a-f0-9]{6,64}$/.test(normalized) ? normalized : null;
}

export function checkinErrorResult(error: { message?: string }): CheckinResult {
  for (const result of ['waiver_required', 'event_unavailable', 'registration_required', 'cancelled', 'waitlist'] as const) {
    if (error.message?.includes(result)) return { result };
  }
  return { result: 'error' };
}

export function confirmedAttendance(result: CheckinResult): boolean {
  return result.result === 'ok';
}