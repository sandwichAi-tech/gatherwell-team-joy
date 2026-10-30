import { describe, expect, it } from 'vitest';
import { acceptTerms, cardState, isActive, ownerActions, ownerTransition } from './referral-membership';

describe('owner decisions', () => {
  it('approves only requests', () => {
    expect(ownerTransition('requested', 'approve')).toBe('approved');
    expect(ownerTransition('invited', 'approve')).toBeNull();
    expect(ownerTransition('revoked', 'approve')).toBeNull();
  });
  it('rejects only pending people', () => {
    expect(ownerTransition('invited', 'reject')).toBe('rejected');
    expect(ownerTransition('approved', 'reject')).toBeNull();
  });
  it('revokes anyone not already closed', () => {
    expect(ownerTransition('approved', 'revoke')).toBe('revoked');
    expect(ownerTransition('rejected', 'revoke')).toBeNull();
    expect(ownerActions('requested')).toEqual(['approve', 'reject', 'revoke']);
    expect(ownerActions('revoked')).toEqual([]);
  });
});

describe('referrer terms', () => {
  it('fails closed when no affiliate terms are approved', () => {
    expect(acceptTerms({ status: 'invited', termsAccepted: false }, false)).toEqual({ ok: false, error: 'terms_unavailable' });
  });
  it('an outsider or rejected person cannot accept', () => {
    expect(acceptTerms(null, true)).toEqual({ ok: false, error: 'not_invited' });
    expect(acceptTerms({ status: 'rejected', termsAccepted: false }, true)).toEqual({ ok: false, error: 'not_invited' });
    expect(acceptTerms({ status: 'requested', termsAccepted: false }, true)).toEqual({ ok: false, error: 'not_invited' });
  });
  it('invited and approved people become active after accepting', () => {
    expect(acceptTerms({ status: 'invited', termsAccepted: false }, true).ok).toBe(true);
    expect(acceptTerms({ status: 'approved', termsAccepted: false }, true).ok).toBe(true);
  });
});

describe('who can share and earn', () => {
  it('only approved members who accepted terms', () => {
    expect(isActive({ status: 'approved', termsAccepted: true })).toBe(true);
    expect(isActive({ status: 'approved', termsAccepted: false })).toBe(false);
    expect(isActive({ status: 'revoked', termsAccepted: true })).toBe(false);
    expect(isActive(null)).toBe(false);
  });
  it('item card state', () => {
    expect(cardState(null, true)).toBe('request');
    expect(cardState({ status: 'requested', termsAccepted: false }, true)).toBe('waiting');
    expect(cardState({ status: 'invited', termsAccepted: false }, false)).toBe('terms_missing');
    expect(cardState({ status: 'approved', termsAccepted: false }, true)).toBe('accept');
    expect(cardState({ status: 'revoked', termsAccepted: true }, true)).toBe('closed');
    expect(cardState({ status: 'approved', termsAccepted: true }, false)).toBe('share');
  });
});
