import { describe, expect, it, vi } from 'vitest';
import { processChallengeOrderEvent } from './challenge-order-events.server';
import { handlePaymentEvent } from './webhook-events.server';
const { retrieve } = vi.hoisted(() => ({ retrieve: vi.fn() }));
vi.mock('@/lib/stripe.server', () => ({ createStripeClient: () => ({ paymentIntents: { retrieve } }) }));
const order = { id: 'order', buyer_user_id: 'learner', connected_account_id: 'acct', environment: 'sandbox', stripe_checkout_session_id: 'cs', gross_cents: 1200, currency: 'usd' };
function dbFor(row: unknown = order) { const rpc = vi.fn().mockResolvedValue({ error: null }); const from = vi.fn(() => { const q: any = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: row, error: null }) }; return q; }); return { from, rpc }; }
function event(type: string, overrides = {}) { return { id: 'evt', type, data: { object: { id: 'cs', metadata: { kind: 'challenge_order', order_id: 'order', user_id: 'learner' }, payment_status: 'unpaid', amount_total: 1200, currency: 'usd', ...overrides } } }; }
describe('challenge verified event boundary', () => {
  it('keeps delayed unpaid checkout pending without enrollment', async () => { const db = dbFor(); expect(await processChallengeOrderEvent(db as any, event('checkout.session.completed'), 'sandbox')).toBe(true); expect(db.rpc).not.toHaveBeenCalled(); });
  it('consumes verified expiration through the cancellation transition', async () => { const db = dbFor(); await processChallengeOrderEvent(db as any, event('checkout.session.expired'), 'sandbox'); expect(db.rpc).toHaveBeenCalledWith('reconcile_challenge_order', expect.objectContaining({ _state: 'cancelled', _amount: 1200, _order: 'order' })); });
  it('consumes asynchronous failure without access', async () => { const db = dbFor(); await processChallengeOrderEvent(db as any, event('checkout.session.async_payment_failed'), 'sandbox'); expect(db.rpc).toHaveBeenCalledWith('reconcile_challenge_order', expect.objectContaining({ _state: 'failed' })); });
  for (const [name, overrides] of [['amount', { amount_total: 1199 }], ['currency', { currency: 'eur' }], ['session', { id: 'other' }], ['buyer', { metadata: { kind: 'challenge_order', order_id: 'order', user_id: 'outsider' } }]] as const) it(`rejects wrong ${name}`, async () => { const db = dbFor(); await expect(processChallengeOrderEvent(db as any, event('checkout.session.completed', overrides), 'sandbox')).rejects.toThrow('payment_unverified'); expect(db.rpc).not.toHaveBeenCalled(); });
  it('rejects sandbox/live mismatch', async () => { await expect(processChallengeOrderEvent(dbFor() as any, event('checkout.session.completed'), 'live')).rejects.toThrow('payment_unverified'); });
  it('does not acknowledge database outages as duplicate events', async () => { const db = { from: () => ({ insert: async () => ({ error: { code: '08006' } }) }) }; expect(await handlePaymentEvent(db as any, event('checkout.session.completed'))).toBe('failed'); });
  it('settles only after provider-retrieved amount and seller evidence match', async () => {
    retrieve.mockResolvedValueOnce({ status: 'succeeded', amount_received: 1200, currency: 'usd', transfer_data: { destination: 'acct' }, metadata: { order_id: 'order' } });
    const db = dbFor(); await processChallengeOrderEvent(db as any, event('checkout.session.completed', { payment_status: 'paid', payment_intent: 'pi_verified' }), 'sandbox');
    expect(db.rpc).toHaveBeenCalledWith('reconcile_challenge_order', expect.objectContaining({ _state: 'succeeded', _intent: 'pi_verified', _amount: 1200 }));
  });
  it('rejects paid client/session labels when provider seller differs', async () => {
    retrieve.mockResolvedValueOnce({ status: 'succeeded', amount_received: 1200, currency: 'usd', transfer_data: { destination: 'outsider' }, metadata: { order_id: 'order' } });
    const db = dbFor(); await expect(processChallengeOrderEvent(db as any, event('checkout.session.completed', { payment_status: 'paid', payment_intent: 'pi_wrong' }), 'sandbox')).rejects.toThrow('payment_unverified'); expect(db.rpc).not.toHaveBeenCalled();
  });
  it('uses durable delivery claims and finishes only after reconciliation', async () => {
    const db = dbFor(); db.rpc.mockImplementation(async (name: string) => ({ error: null, data: name === 'claim_challenge_provider_event' ? 'claimed' : true }));
    expect(await handlePaymentEvent(db as any, event('checkout.session.expired'), 'sandbox')).toBe('processed');
    expect(db.rpc.mock.calls.map(c => c[0])).toEqual(['claim_challenge_provider_event','reconcile_challenge_order','finish_challenge_provider_event']); expect(db.from).not.toHaveBeenCalledWith('stripe_events');
  });
  it('does not replay completed provider deliveries', async () => {
    const db = dbFor(); db.rpc.mockResolvedValue({ error: null, data: 'duplicate' });
    expect(await handlePaymentEvent(db as any, event('checkout.session.expired'), 'sandbox')).toBe('duplicate'); expect(db.from).not.toHaveBeenCalled();
  });
  it('returns retryable failure for an in-flight delivery lease', async () => {
    const db = dbFor(); db.rpc.mockResolvedValue({ error: null, data: 'busy' });
    expect(await handlePaymentEvent(db as any, event('checkout.session.expired'), 'sandbox')).toBe('failed'); expect(db.from).not.toHaveBeenCalled();
  });
  it('retains a failed claim for safe provider retry after effects fail', async () => {
    const db = dbFor(); db.rpc.mockImplementation(async (name: string) => name === 'reconcile_challenge_order' ? { error: new Error('outage') } : { error: null, data: name === 'claim_challenge_provider_event' ? 'claimed' : true });
    expect(await handlePaymentEvent(db as any, event('checkout.session.expired'), 'sandbox')).toBe('failed'); expect(db.rpc).toHaveBeenCalledWith('finish_challenge_provider_event', expect.objectContaining({ _succeeded: false }));
  });
});