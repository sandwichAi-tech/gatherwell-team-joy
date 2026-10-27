export type WalkInResult = { result: 'confirmed' | 'existing' | 'already'; rsvp_id: string; status: string; checked_in: boolean };
export function confirmedWalkIn(value: WalkInResult) { return value.result === 'confirmed' && value.status === 'going' && value.checked_in; }
export function walkInErrorKey(error: unknown) {
  const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : '';
  for (const key of ['not_allowed', 'event_full', 'waiver_required', 'payment_required', 'tier_required', 'not_open', 'registration_not_open', 'registration_closed', 'name_required', 'contact_required', 'invalid_email', 'too_long'] as const) {
    if (message.includes(key)) return key === 'not_allowed' ? 'attendancePilot.staffOnly' : `guest.errors.${key}`;
  }
  return 'checkin.walkInRetry';
}