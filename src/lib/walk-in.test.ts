import { describe, expect, it } from 'vitest';
import { confirmedWalkIn, walkInErrorKey } from './walk-in';
describe('truthful door outcomes', () => {
  it('only a server-confirmed going and checked-in registration succeeds', () => { expect(confirmedWalkIn({ result: 'confirmed', rsvp_id: 'a', status: 'going', checked_in: true })).toBe(true); expect(confirmedWalkIn({ result: 'confirmed', rsvp_id: 'a', status: 'going', checked_in: false })).toBe(false); });
  it('existing and already-checked-in registrations are not new walk-ins', () => { expect(confirmedWalkIn({ result: 'existing', rsvp_id: 'a', status: 'going', checked_in: false })).toBe(false); expect(confirmedWalkIn({ result: 'already', rsvp_id: 'a', status: 'going', checked_in: true })).toBe(false); });
  for (const key of ['event_full', 'waiver_required', 'payment_required', 'tier_required', 'not_open', 'invalid_email']) it(`preserves ${key} resolution`, () => expect(walkInErrorKey({ message: key })).toBe(`guest.errors.${key}`));
  it('denies outsider creation', () => expect(walkInErrorKey({ message: 'not_allowed' })).toBe('attendancePilot.staffOnly'));
  it('network errors retain a retry state, never success', () => expect(walkInErrorKey(new Error('Failed to fetch'))).toBe('checkin.walkInRetry'));
});