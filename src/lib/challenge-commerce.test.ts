import { describe, expect, it } from 'vitest';
import { challengeCheckoutReadiness, confirmedChallengePayment, fullChallengeRefund } from './challenge-commerce';
describe('challenge payment boundaries', () => {
  const pay = { stripe_session_id: 'cs_test', amount_cents: 1500, challenge_id: 'challenge-one', buyer_key: 'participant-one' };
  const metadata = { challenge_id: 'challenge-one', user_id: 'participant-one' };
  const session = { payment_status: 'paid', payment_intent: 'pi_test', amount_total: 1500 };
  it('blocks checkout even when a provider might be configured but lifecycle is unverified', () => { expect(challengeCheckoutReadiness()).toEqual({ ok: false, error: 'not_connected' }); });
  it('accepts only matched server-confirmed paid evidence', () => { expect(confirmedChallengePayment(session, pay, metadata, 'cs_test')).toBe(true); });
  for (const status of ['unpaid', 'pending', 'failed', 'cancelled']) it(`${status} is not paid`, () => { expect(confirmedChallengePayment({ ...session, payment_status: status }, pay, metadata, 'cs_test')).toBe(false); });
  it('rejects missing intent, wrong amount, other buyer/challenge and mismatched session', () => { expect(confirmedChallengePayment({ ...session, payment_intent: null }, pay, metadata, 'cs_test')).toBe(false); expect(confirmedChallengePayment({ ...session, amount_total: 1400 }, pay, metadata, 'cs_test')).toBe(false); expect(confirmedChallengePayment(session, pay, { ...metadata, user_id: 'other' }, 'cs_test')).toBe(false); expect(confirmedChallengePayment(session, pay, { ...metadata, challenge_id: 'other' }, 'cs_test')).toBe(false); expect(confirmedChallengePayment(session, pay, metadata, 'cs_other')).toBe(false); });
  it('partial/add-on-only refund never establishes full-base revocation', () => { expect(fullChallengeRefund(1500, 500)).toBe(false); expect(fullChallengeRefund(1500, 1500)).toBe(true); expect(fullChallengeRefund(0, 0)).toBe(false); });
});