// Shared payment-event handling. Both webhook endpoints (the platform-managed
// one at /api/public/payments/webhook and the legacy one at
// /api/public/stripe/webhook) verify their signature and then call this, so
// purchase, cancel, refund and failed-payment rules live in exactly one place.
//
// Business rules (Nick, October 2026):
// - Cancelling keeps paid access until the paid period ends.
// - A downgrade is applied at the end of the current month.
// - A failed payment keeps access while the provider retries.
import type { SupabaseClient } from '@supabase/supabase-js';

const money = (c: number) => `$${(c / 100).toFixed(2)}`;
const ts = (s?: number | null) => (s ? new Date(s * 1000).toISOString() : null);

export type PaymentEvent = { id: string; type: string; data: { object: any } };

/** True only when the subscription is truly over — not merely flagged to cancel. */
function isFinished(type: string, sub: any): boolean {
  if (type.endsWith('deleted')) return true;
  if (sub.cancel_at_period_end && sub.status === 'active') return false;
  return sub.status === 'canceled' || sub.status === 'incomplete_expired' || sub.status === 'unpaid';
}

export async function processPaymentEvent(db: SupabaseClient, evt: PaymentEvent): Promise<void> {
  const o = evt.data.object;

  switch (evt.type) {
    case 'checkout.session.completed': {
      const m = o.metadata ?? {};
      if (m.kind === 'gathering') {
        const { data: r, error } = await db.rpc('rsvp_event', { _event_id: m.event_id, _first: m.first, _last: m.last, _phone: m.phone, _email: m.email, _language: m.lang, _plus_ones: Number(m.plus) || 0, _status: 'going', _sms: m.sms === 'true', _mail: m.mail === 'true' });
        if (error) throw error;
        const code = (r as { code: string }[] | null)?.[0]?.code;
        const { data: rsvp } = code ? await db.from('rsvps').select('id').eq('checkin_code', code).maybeSingle() : { data: null };
        if (rsvp?.id && m.waiver) await db.rpc('record_waiver' as never, { _rsvp: rsvp.id, _name: m.waiver, _ip: m.waiver_ip || null, _source: 'rsvp' } as never);
        const { data: pay } = await db.from('payments').update({ status: 'paid', stripe_payment_intent: o.payment_intent, rsvp_id: rsvp?.id ?? null }).eq('stripe_session_id', o.id).select('amount_cents, service_fee_cents, service_fee_covered').maybeSingle();
        const { data: ev } = await db.from('events').select('title, starts_at, timezone, location_name').eq('id', m.event_id).maybeSingle();
        await db.rpc('enqueue_message', <any>{ _channel: 'email', _recipient: m.email, _language: m.lang === 'es' ? 'es' : 'en', _template: 'payment_receipt', _kind: 'transactional',
          _payload: { name: m.first, title: ev?.title ?? '', starts_at: ev?.starts_at, timezone: ev?.timezone, location: ev?.location_name, amount: money(pay?.amount_cents ?? o.amount_total ?? 0), service_fee: pay && pay.service_fee_cents && !pay.service_fee_covered ? money(pay.service_fee_cents) : null, ticket: pay && pay.service_fee_cents && !pay.service_fee_covered ? money(pay.amount_cents - pay.service_fee_cents) : null, code, event_id: m.event_id },
          _send_after: new Date().toISOString(), _event: m.event_id, _rsvp: rsvp?.id ?? undefined });
      } else if (m.kind === 'challenge') {
        await db.from('challenge_members').upsert({ challenge_id: m.challenge_id, user_id: m.user_id }, { onConflict: 'challenge_id,user_id', ignoreDuplicates: true });
        await db.from('payments').update({ status: 'paid', stripe_payment_intent: o.payment_intent }).eq('stripe_session_id', o.id);
      } else if (m.kind === 'offer') {
        const { data: pay } = await db.from('payments').update({ status: 'paid', stripe_payment_intent: o.payment_intent ?? null }).eq('stripe_session_id', o.id).select('amount_cents').maybeSingle();
        await db.from('offer_purchases' as any).upsert({ offer_id: m.offer_id, user_id: m.user_id, status: o.subscription ? 'active' : 'paid', stripe_subscription_id: o.subscription ?? null, amount_cents: pay?.amount_cents ?? o.amount_total ?? 0, cancel_at_period_end: false, ...(m.founding === '1' ? { founding: true } : {}) }, { onConflict: 'offer_id,user_id' });
      } else if (m.kind === 'plan') {
        // A purchase activates immediately and clears any earlier cancel or pending switch.
        await db.from('billing_accounts').upsert({
          user_id: m.user_id, stripe_customer_id: o.customer, stripe_subscription_id: o.subscription,
          plan: m.plan, billing_period: m.period, status: 'active',
          cancel_at_period_end: false, pending_plan: null, pending_plan_at: null,
          legacy_price_cents: m.founding_rate ? Number(m.founding_rate) : null,
        }, { onConflict: 'user_id' });
      } else if (m.kind === 'license') {
        const tier = m.tier as 'team25' | 'team100';
        const seats = tier === 'team25' ? 25 : 100;
        await db.from('team_licenses').upsert({ team_id: m.team_id, leader_id: m.user_id, tier, seats, status: 'active', is_preview: false, cancel_at_period_end: false, stripe_customer_id: o.customer, stripe_subscription_id: o.subscription }, { onConflict: 'team_id' });
      }
      break;
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const m = o.metadata ?? {};
      const finished = isFinished(evt.type, o);
      const endingSoon = !finished && !!o.cancel_at_period_end;
      // A subscription flagged to cancel stays fully paid until its period ends,
      // so status only changes once the period is actually over.
      const status = finished ? 'canceled' : o.status === 'past_due' ? 'past_due' : 'active';
      const renews = ts(o.current_period_end ?? o.items?.data?.[0]?.current_period_end);
      if (m.kind === 'plan') {
        await db.from('billing_accounts').upsert({
          user_id: m.user_id, stripe_customer_id: o.customer, stripe_subscription_id: o.id,
          plan: finished ? 'free' : m.plan, billing_period: finished ? null : m.period,
          status: finished ? 'active' : status, renews_at: finished ? null : renews,
          cancel_at_period_end: endingSoon,
        }, { onConflict: 'user_id' });
      } else if (m.kind === 'offer') {
        await db.from('offer_purchases' as any).update({ status, renews_at: renews, cancel_at_period_end: !!o.cancel_at_period_end, stripe_subscription_id: o.id }).eq('offer_id', m.offer_id).eq('user_id', m.user_id);
      } else if (m.kind === 'license') {
        await db.from('team_licenses').update({ status, renews_at: renews, cancel_at_period_end: endingSoon }).eq('team_id', m.team_id);
      }
      break;
    }

    case 'invoice.paid':
    case 'invoice.payment_failed': {
      const sub = o.subscription ?? o.parent?.subscription_details?.subscription;
      if (!sub) break;
      const failed = evt.type === 'invoice.payment_failed';
      const end = ts(o.lines?.data?.[0]?.period?.end);
      // past_due keeps paid access (effective_plan counts it) while retries run.
      const { data: b } = await db.from('billing_accounts').update({ status: failed ? 'past_due' : 'active', ...(end && !failed ? { renews_at: end } : {}) }).eq('stripe_subscription_id', sub).select('user_id').maybeSingle();
      const { data: l } = await db.from('team_licenses').update({ status: failed ? 'past_due' : 'active', ...(end && !failed ? { renews_at: end } : {}) }).eq('stripe_subscription_id', sub).select('leader_id').maybeSingle();
      await db.from('offer_purchases' as any).update({ status: failed ? 'past_due' : 'active', ...(end && !failed ? { renews_at: end } : {}) }).eq('stripe_subscription_id', sub);
      const userId = b?.user_id ?? l?.leader_id;
      if (failed && userId) {
        const { data: u } = await db.auth.admin.getUserById(userId);
        const { data: p } = await db.from('profiles').select('language').eq('id', userId).maybeSingle();
        if (u?.user?.email) await db.rpc('enqueue_message', <any>{ _channel: 'email', _recipient: u.user.email, _language: p?.language === 'es' ? 'es' : 'en', _template: 'payment_failed', _kind: 'transactional', _payload: {}, _send_after: new Date().toISOString(), _user: userId, _team: null, _lesson: null });
      }
      break;
    }

    case 'account.updated': {
      const status = o.charges_enabled && o.details_submitted ? 'active' : 'pending';
      await db.from('billing_accounts').update({ connect_status: status }).eq('connect_account_id', o.id);
      break;
    }

    case 'charge.refunded': {
      const { data: pay } = await db.from('payments').update({ status: 'refunded' }).eq('stripe_payment_intent', o.payment_intent).select('rsvp_id, buyer_email, buyer_name, amount_cents, event_id').maybeSingle();
      if (pay?.rsvp_id) await db.from('rsvps').update({ status: 'cancelled' }).eq('id', pay.rsvp_id);
      if (pay?.buyer_email) {
        const { data: r } = pay.rsvp_id ? await db.from('rsvps').select('language').eq('id', pay.rsvp_id).maybeSingle() : { data: null };
        const { data: ev } = pay.event_id ? await db.from('events').select('title').eq('id', pay.event_id).maybeSingle() : { data: null };
        await db.rpc('enqueue_message', <any>{ _channel: 'email', _recipient: pay.buyer_email, _language: r?.language === 'es' ? 'es' : 'en', _template: 'payment_refunded', _kind: 'transactional', _payload: { name: (pay.buyer_name ?? '').split(' ')[0], title: ev?.title ?? '', amount: money(pay.amount_cents) }, _send_after: new Date().toISOString(), _event: pay.event_id ?? undefined, _rsvp: pay.rsvp_id ?? undefined });
      }
      break;
    }
  }
}

/**
 * Idempotent entry point: the first delivery of an event id wins, a repeat is a
 * no-op, and a failed handling releases the row so the provider can retry.
 */
export async function handlePaymentEvent(db: SupabaseClient, evt: PaymentEvent): Promise<'processed' | 'duplicate' | 'failed'> {
  const { error: dup } = await db.from('stripe_events').insert({ id: evt.id, type: evt.type });
  if (dup) return 'duplicate';
  try {
    await processPaymentEvent(db, evt);
    return 'processed';
  } catch (e) {
    console.error('[payments webhook]', evt.type, e);
    await db.from('stripe_events').delete().eq('id', evt.id);
    return 'failed';
  }
}
