import { describe, expect, it } from 'vitest';
import { rsvpReminderConsent } from './rsvp-form';

describe('guest reminder consent', () => {
  it('does not opt a guest into reminders just because they provided contact details', () => {
    expect(rsvpReminderConsent({ phone: '5550100', email: 'guest@example.com', sms: false, mail: false })).toEqual({ sms: false, mail: false });
  });
  it('keeps explicitly selected reminders for supplied destinations', () => {
    expect(rsvpReminderConsent({ phone: '5550100', email: 'guest@example.com', sms: true, mail: true })).toEqual({ sms: true, mail: true });
  });
  it('never sends consent for a removed contact destination', () => {
    expect(rsvpReminderConsent({ phone: ' ', email: '', sms: true, mail: true })).toEqual({ sms: false, mail: false });
  });
});