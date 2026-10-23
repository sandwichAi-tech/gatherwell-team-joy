import { describe, expect, it } from 'vitest';
import { checkMinorRegistration, defaultTabFor, needsAdult, planGuestClaim, type ClaimRsvp } from './identity';

describe('18+ and guardian rules', () => {
  it('adult-only actions need attestation; attending and learning do not', () => {
    for (const a of ['create_team', 'host', 'publish', 'purchase', 'subscribe'] as const) expect(needsAdult(a)).toBe(true);
    expect(needsAdult('attend')).toBe(false); expect(needsAdult('learn')).toBe(false);
  });
  it('no minor fields means an ordinary adult registration', () => expect(checkMinorRegistration(false, true, {})).toEqual({ ok: true, minor: null }));
  it('rejects minors on events that do not allow them (default)', () => expect(checkMinorRegistration(false, true, { firstName: 'Ana', ageBand: '5_12', guardianConsent: true })).toEqual({ ok: false, error: 'minors_not_allowed' }));
  it('requires an adult registrant', () => expect(checkMinorRegistration(true, false, { firstName: 'Ana', ageBand: '5_12', guardianConsent: true })).toEqual({ ok: false, error: 'adult_required' }));
  it('requires first name and a valid age band only', () => {
    expect(checkMinorRegistration(true, true, { firstName: 'Ana', guardianConsent: true })).toEqual({ ok: false, error: 'minor_details_incomplete' });
    expect(checkMinorRegistration(true, true, { firstName: 'Ana', ageBand: '18_plus', guardianConsent: true })).toEqual({ ok: false, error: 'minor_details_incomplete' });
  });
  it('requires separate guardian consent', () => expect(checkMinorRegistration(true, true, { firstName: 'Ana', ageBand: '13_17' })).toEqual({ ok: false, error: 'guardian_consent_required' }));
  it('accepts a complete guardian registration', () => expect(checkMinorRegistration(true, true, { firstName: ' Ana ', ageBand: 'under_5', guardianConsent: true })).toEqual({ ok: true, minor: { firstName: 'Ana', ageBand: 'under_5' } }));
  it('view mode changes only the default tab', () => { expect(defaultTabFor('hosting')).toBe('/events'); expect(defaultTabFor('attending')).toBe('/home'); });
});

const row = (o: Partial<ClaimRsvp> & { id: string }): ClaimRsvp => ({ eventId: 'e1', userId: null, email: 'a@x.com', status: 'going', mergedInto: null, createdAt: '2026-10-01', ...o });

describe('guest claim plan', () => {
  it('claims nothing without a verified email', () => expect(planGuestClaim([row({ id: 'r1' })], 'u1', null)).toEqual({ claim: [], merge: [] }));
  it('claims unowned rows matching the verified email, case-insensitively', () => expect(planGuestClaim([row({ id: 'r1', email: ' A@X.com ' })], 'u1', 'a@x.com').claim).toEqual(['r1']));
  it("never claims another user's row or a different email", () => {
    const p = planGuestClaim([row({ id: 'r1', userId: 'u2' }), row({ id: 'r2', email: 'b@x.com' })], 'u1', 'a@x.com');
    expect(p).toEqual({ claim: [], merge: [] });
  });
  it('merges a duplicate into the existing account RSVP instead of creating a second registration', () => {
    const p = planGuestClaim([row({ id: 'own', userId: 'u1', createdAt: '2026-10-05' }), row({ id: 'g1' })], 'u1', 'a@x.com');
    expect(p).toEqual({ claim: [], merge: [{ id: 'g1', into: 'own' }] });
  });
  it('two guest duplicates for one event: earliest becomes canonical, the other merges', () => {
    const p = planGuestClaim([row({ id: 'g2', createdAt: '2026-10-03' }), row({ id: 'g1', createdAt: '2026-10-02' })], 'u1', 'a@x.com');
    expect(p).toEqual({ claim: ['g1'], merge: [{ id: 'g2', into: 'g1' }] });
  });
  it('is idempotent: already merged rows are skipped', () => expect(planGuestClaim([row({ id: 'g1', mergedInto: 'own' })], 'u1', 'a@x.com')).toEqual({ claim: [], merge: [] }));
});
