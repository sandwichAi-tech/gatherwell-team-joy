import { asRefundPolicy, refundText } from './refunds';
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

const origin = z.string().url().refine(u => /^https:\/\//.test(u) || /^http:\/\/localhost(:\d+)?/.test(u));
type Result = { ok: true; url: string } | { ok: false; error: string };

/** Member buys an offer: subscription for memberships/courses, one-time payment for downloads. */
export const startOfferCheckout = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ offerId: z.string().uuid(), origin, lang: z.enum(['en', 'es']), promo: z.string().max(20).optional().default('') }).parse(d))
  .handler(async ({ data, context }): Promise<Result> => {
    const { data: o } = await context.supabase.from('offers').select('id, host_id, kind, title_en, title_es, price_cents, status, refund_policy').eq('id', data.offerId).maybeSingle();
    if (!o || o.status !== 'published') return { ok: false, error: 'not_open' };
    if (!o.price_cents) return { ok: false, error: 'free' };
    const { stripe, stripeKey } = await import('./billing/stripe.server');
    if (!stripeKey()) return { ok: false, error: 'not_connected' };
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: b } = await supabaseAdmin.from('billing_accounts').select('connect_account_id, connect_status').eq('user_id', o.host_id).maybeSingle();
    if (!b?.connect_account_id || b.connect_status !== 'active') return { ok: false, error: 'host_not_ready' };
    const { promoFor } = await import('./billing.functions'); const { promoDiscount } = await import('./promo');
    const email = ((context.claims.email as string) ?? '').toLowerCase();
    const promo = await promoFor(supabaseAdmin, data.promo, 'offer', o.id, email || context.userId);
    if (promo && !promo.ok) return { ok: false, error: `promo_${promo.error}` };
    const { data: fs } = await supabaseAdmin.rpc('offer_founding_status', { _offer: o.id });
    const founding = o.kind === 'membership' && !!fs && (fs as { left: number }).left > 0;
    const base = founding ? (fs as { price_cents: number }).price_cents : o.price_cents;
    if (!base) return { ok: false, error: 'free' };
    const discount = promo?.ok ? promoDiscount(base, promo) : 0;
    const net = base - discount;
    // One-time downloads get the exact capped fee; subscriptions use the plan's current rate (0 once the month's cap is reached).
    const { data: pctRaw } = await supabaseAdmin.rpc('current_fee_pct', { _host: o.host_id });
    const pct = Number(pctRaw ?? 0);
    const { data: feeRaw } = await supabaseAdmin.rpc('platform_fee_cents', { _host: o.host_id, _amount: net });
    const oneTimeFee = Number(feeRaw ?? 0);
    const name = (data.lang === 'es' ? o.title_es : o.title_en) || o.title_en || o.title_es;
    const meta = { kind: 'offer', offer_id: o.id, user_id: context.userId, founding: founding ? '1' : '0' };
    const recurring = o.kind !== 'download';
    const s = await stripe<{ id: string; url: string }>('checkout/sessions', {
      mode: recurring ? 'subscription' : 'payment', customer_email: context.claims.email as string | undefined, locale: data.lang === 'es' ? 'es-419' : 'en',
      custom_text: { submit: { message: refundText(asRefundPolicy(o.refund_policy), data.lang) } },
      line_items: [{ quantity: 1, price_data: { currency: 'usd', unit_amount: net, product_data: { name }, ...(recurring ? { recurring: { interval: 'month' } } : {}) } }],
      metadata: meta,
      ...(recurring
        ? { subscription_data: { metadata: meta, application_fee_percent: pct, transfer_data: { destination: b.connect_account_id } } }
        : { payment_intent_data: { application_fee_amount: oneTimeFee, transfer_data: { destination: b.connect_account_id }, metadata: meta } }),
      success_url: `${data.origin}/offer/${o.id}?paid=1`, cancel_url: `${data.origin}/offer/${o.id}`,
    });
    await supabaseAdmin.from('payments').insert({ kind: 'offer', offer_id: o.id, host_id: o.host_id, buyer_email: (context.claims.email as string) ?? null, amount_cents: net, fee_cents: recurring ? Math.round(net * pct / 100) : oneTimeFee, booking_fee_cents: 0, stripe_session_id: s.id, promo_id: promo?.ok ? promo.id : null, discount_cents: discount, buyer_key: email || context.userId });
    return { ok: true, url: s.url };
  });

/** Cancel anytime: paid memberships end at the period end; free ones end now. */
export const cancelOfferMembership = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ offerId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: p } = await context.supabase.from('offer_purchases').select('id, stripe_subscription_id, status').eq('offer_id', data.offerId).eq('user_id', context.userId).maybeSingle();
    if (!p || !['active', 'past_due'].includes(p.status)) return { ok: false as const, error: 'not_found' };
    if (!p.stripe_subscription_id) {
      const { error } = await context.supabase.rpc('leave_free_offer' as never, { _offer: data.offerId } as never);
      return error ? { ok: false as const, error: 'failed' } : { ok: true as const, ended: true };
    }
    const { stripe, stripeKey } = await import('./billing/stripe.server');
    if (!stripeKey()) return { ok: false as const, error: 'not_connected' };
    await stripe(`subscriptions/${p.stripe_subscription_id}`, { cancel_at_period_end: true });
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    await supabaseAdmin.from('offer_purchases').update({ cancel_at_period_end: true }).eq('id', p.id);
    return { ok: true as const, ended: false };
  });

/** Signed download link, only for buyers (or the host). */
export const offerDownloadLink = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ offerId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: access } = await context.supabase.rpc('has_offer_access' as never, { _offer: data.offerId, _uid: context.userId } as never);
    if (!access) return { ok: false as const, error: 'forbidden' };
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: o } = await supabaseAdmin.from('offers').select('file_path').eq('id', data.offerId).maybeSingle();
    if (!o?.file_path) return { ok: false as const, error: 'no_file' };
    const { data: s, error } = await supabaseAdmin.storage.from('offer-files').createSignedUrl(o.file_path, 600, { download: true });
    if (error || !s) return { ok: false as const, error: 'failed' };
    return { ok: true as const, url: s.signedUrl };
  });

/** Pause a membership for 1–3 months (months = 0 resumes). Paid subscriptions also pause billing. */
export const pauseOfferMembership = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ offerId: z.string().uuid(), months: z.number().int().min(0).max(3) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: p } = await context.supabase.from('offer_purchases').select('id, stripe_subscription_id, status, paused_until').eq('offer_id', data.offerId).eq('user_id', context.userId).maybeSingle();
    if (!p || !['active', 'past_due'].includes(p.status)) return { ok: false as const, error: 'not_found' };
    const until = data.months ? new Date(Date.now() + data.months * 30 * 86400000) : null;
    if (p.stripe_subscription_id) {
      const { stripe, stripeKey } = await import('./billing/stripe.server');
      if (!stripeKey()) return { ok: false as const, error: 'not_connected' };
      await stripe(`subscriptions/${p.stripe_subscription_id}`, until ? { 'pause_collection[behavior]': 'void', 'pause_collection[resumes_at]': String(Math.floor(until.getTime() / 1000)) } : { pause_collection: '' });
    }
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    await supabaseAdmin.from('offer_purchases').update({ paused_until: until?.toISOString() ?? null }).eq('id', p.id);
    return { ok: true as const, until: until?.toISOString() ?? null };
  });
