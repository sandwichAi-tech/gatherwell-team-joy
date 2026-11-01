import { describe, expect, it } from 'vitest';
import { eventShareLink, eventSignupSteps, guestEventRedirect, isEventSignupReturn } from './event-invite';
import { safeReturnPath } from './return-to';

const ID = '11111111-2222-4333-8444-555555555555';
const TOKEN = 'abcdef0123456789abcdef01';
const O = 'https://zoheewell.com';

describe('invite-only event share link', () => {
  it('goes to the event signup page with the invitation, never the team-gated app page', () => {
    expect(eventShareLink(O, { id: ID, visibility: 'invite', invite_token: TOKEN })).toBe(`${O}/e/${ID}?k=${TOKEN}`);
  });
  it('returns no link rather than a team-gated one when the invitation token is unknown', () => {
    expect(eventShareLink(O, { id: ID, visibility: 'invite' })).toBeNull();
  });
  it('public events use the guest page; My team only uses the app page', () => {
    expect(eventShareLink(O, { id: ID, visibility: 'public' })).toBe(`${O}/e/${ID}`);
    expect(eventShareLink(O, { id: ID, visibility: 'team' })).toBe(`${O}/event/${ID}`);
  });
  it('the invite link survives sign-in as an allowed return path', () => {
    expect(safeReturnPath(`/e/${ID}?k=${TOKEN}`)).toBe(`/e/${ID}?k=${TOKEN}`);
  });
});

describe('not-yet-onboarded visitor on an app event link', () => {
  it('is sent to the event signup page, keeping a valid invitation', () => {
    expect(guestEventRedirect(`/event/${ID}`, `?k=${TOKEN}`)).toBe(`/e/${ID}?k=${TOKEN}`);
    expect(guestEventRedirect(`/event/${ID}`, '')).toBe(`/e/${ID}`);
  });
  it('drops a malformed token and ignores other app pages', () => {
    expect(guestEventRedirect(`/event/${ID}`, '?k=<script>')).toBe(`/e/${ID}`);
    expect(guestEventRedirect(`/event/${ID}/guests`, '')).toBeNull();
    expect(guestEventRedirect('/team', '')).toBeNull();
  });
});

describe('onboarding when returning to event signup', () => {
  it('recognises event signup returns only', () => {
    expect(isEventSignupReturn(`/e/${ID}?k=${TOKEN}`)).toBe(true);
    expect(isEventSignupReturn(`/e/${ID}`)).toBe(true);
    expect(isEventSignupReturn('/join/ABC123')).toBe(false);
    expect(isEventSignupReturn('/home')).toBe(false);
    expect(isEventSignupReturn(null)).toBe(false);
  });
  it('skips team code, role and start steps but keeps the 18+ confirmation', () => {
    expect(eventSignupSteps(['adult', 'start', 'name', 'place', 'role', 'team'])).toEqual(['adult', 'name']);
  });
});
