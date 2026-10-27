import type { SupabaseClient } from '@supabase/supabase-js';
import type { StripeEnv } from '@/lib/stripe.server';
import type { PaymentEvent } from '@/lib/billing/webhook-events.server';

/** Only called after provider signature verification. No client-selectable test mode. */
export async function processChallengeOrderEvent(db: SupabaseClient, event: PaymentEvent, environment: StripeEnv): Promise<boolean> {
  const object = event.data.object;
  if (object?.metadata?.kind === 'challenge_order' && event.type.startsWith('checkout.session.')) {
    const orderId = object.metadata.order_id;
    if (typeof orderId !== 'string') throw new Error('payment_unverified');
    const read = await db.from('orders').select('id,buyer_user_id,connected_account_id,environment,stripe_checkout_session_id,gross_cents,currency').eq('id', orderId).eq('offering_type', 'challenge').maybeSingle();
    if (read.error) throw read.error;
    const order = read.data;
    if (!order || order.buyer_user_id !== object.metadata.user_id || order.environment !== environment || order.stripe_checkout_session_id !== object.id || order.currency !== object.currency || order.gross_cents !== object.amount_total) throw new Error('payment_unverified');
    let state: string;
    if (event.type === 'checkout.session.async_payment_failed') state = 'failed';
    else if (event.type === 'checkout.session.expired') state = 'cancelled';
    else if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      if (object.payment_status !== 'paid') return true;
      // A signed session is not sufficient to establish the seller/account binding.
      const { createStripeClient } = await import('@/lib/stripe.server');
      if (typeof object.payment_intent !== 'string') throw new Error('payment_unverified');
      const intent = await createStripeClient(environment).paymentIntents.retrieve(object.payment_intent);
      const destination = intent.transfer_data?.destination;
      const account = typeof destination === 'string' ? destination : destination?.id;
      if (intent.status !== 'succeeded' || intent.amount_received !== order.gross_cents || intent.currency !== order.currency || account !== order.connected_account_id || intent.metadata.order_id !== order.id) throw new Error('payment_unverified');
      state = 'succeeded';
    } else return true;
    const r = await db.rpc('reconcile_challenge_order', { _order: order.id, _session: object.id, _intent: typeof object.payment_intent === 'string' ? object.payment_intent : '', _amount: object.amount_total, _currency: object.currency, _environment: environment, _state: state });
    if (r.error) throw r.error;
    return true;
  }
  if (['refund.created', 'refund.updated', 'refund.failed'].includes(event.type)) {
    const intentId = typeof object.payment_intent === 'string' ? object.payment_intent : object.payment_intent?.id;
    if (!intentId) return false;
    const read = await db.from('orders').select('id,gross_cents').eq('offering_type', 'challenge').eq('stripe_payment_intent_id', intentId).eq('environment', environment).maybeSingle();
    if (read.error) throw read.error;
    if (!read.data) return false;
    const lines = await db.from('order_items').select('id,unit_cents,quantity').eq('order_id', read.data.id);
    if (lines.error) throw lines.error;
    // A full purchase refund is unambiguous. Partial refunds require provider-side line allocation;
    // no client or aggregate amount may guess which part was refunded.
    let allocation: { id: string; amount: number }[] = [];
    if (object.amount === read.data.gross_cents) allocation = (lines.data ?? []).filter(l => l.unit_cents > 0).map(l => ({ id: l.id, amount: l.unit_cents * l.quantity }));
    else {
      try { allocation = JSON.parse(object.metadata?.order_lines ?? '[]'); } catch { throw new Error('refund_allocation_required'); }
      if (!Array.isArray(allocation) || !allocation.length) {
        const ledger = await db.rpc('record_unallocated_challenge_refund', { _order: read.data.id, _refund: object.id, _amount: object.amount, _status: object.status === 'succeeded' ? 'succeeded' : object.status === 'failed' || object.status === 'canceled' ? 'failed' : 'pending' });
        if (ledger.error) throw ledger.error;
        return true;
      }
    }
    const r = await db.rpc('reconcile_challenge_refund', { _order: read.data.id, _provider_refund: object.id, _amount: object.amount, _status: object.status === 'succeeded' ? 'succeeded' : object.status === 'failed' || object.status === 'canceled' ? 'failed' : 'pending', _lines: allocation });
    if (r.error) throw r.error;
    return true;
  }
  if (event.type === 'charge.dispute.created') {
    const r = await db.rpc('revoke_challenge_order', { _intent: object.payment_intent, _environment: environment });
    if (r.error) throw r.error;
    return true;
  }
  return false;
}