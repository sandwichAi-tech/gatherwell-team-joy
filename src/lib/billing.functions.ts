import { asRefundPolicy, refundText } from './refunds';
import { createServerFn } from '@tanstack/react-start';
import { normalizeCode, promoDiscount, type PromoCheck } from '@/lib/promo';

/** Validates an optional promo code server-side; null when none was entered. */
export async function promoFor(sb: { rpc: (fn: any, args?: any) => any }, code: string, kind: 'gathering' | 'challenge' | 'offer', target: string, buyer: string): Promise<PromoCheck | null> {
  const c = normalizeCode(code ?? ''); if (!c) return null;
  const { data } = await sb.rpc('check_promo', { _code: c, _kind: kind, _target: target, _buyer: buyer });
  return (data as PromoCheck | null) ?? { ok: false, error: 'invalid' };
}
import { LICENSES } from './license-prices';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import type { StripeEnv } from '@/lib/stripe.server';

const origin = z.string().url().refine(u => /^https:\/\//.test(u) || /^http:\/\/localhost(:\d+)?/.test(u));
const environment = z.enum(['sandbox', 'live']);
type Result = { ok: true; url: string } | { ok: false; error: string };
/** Inline checkout: the client mounts the provider's own payment form with this. */
type CheckoutResult = { ok: true; clientSecret: string; returnUrl: string } | { ok: false; error: string };
const notConnected: Result = { ok: false, error: 'not_connected' };

/** Plans the app sells, mapped to the catalog price created for each. */
const PLAN_PRICE_KEYS = { growth: 'advanced_monthly', pro: 'pro_monthly' } as const;
const LICENSE_PRICE_KEYS = { team25: 'team25_monthly', team100: 'team100_monthly' } as const;
const LICENSE_SEATS = { team25: 25, team100: 100 } as const;

/** Public: is a payment connection configured? Never returns a key. */
export const getPaymentsStatus = createServerFn({ method: 'GET' }).handler(async () => ({
  connected: !!process.env['STRIPE_SANDBOX_API_KEY'] || !!process.env['STRIPE_LIVE_API_KEY'],
}));

/**
 * Coach-facing payments readiness. Platform connection is env-only (ZoheeWell
 * action); payout setup is the coach's Connect onboarding. canSellPaid mirrors
 * the block_unpaid_selling trigger (payouts_live) — publishing a paid item
 * fails server-side until both sides are ready.
 */
export const getPaymentsReadiness = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: b } = await context.supabase
      .from('billing_accounts')
      .select('connect_status')
      .eq('user_id', context.userId)
      .maybeSingle();
    const platformConnected = !!process.env['STRIPE_SANDBOX_API_KEY'] || !!process.env['STRIPE_LIVE_API_KEY'];
    const connectStatus = (b?.connect_status === 'active' || b?.connect_status === 'pending' ? b.connect_status : 'none') as 'none' | 'pending' | 'active';
    return { platformConnected, connectStatus, canSellPaid: platformConnected && connectStatus === 'active' };
  });

async function ensureCustomer(userId: string, email: string | undefined, env: StripeEnv) {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { createStripeClient } = await import('@/lib/stripe.server');
  const { resolveOrCreateCustomer } = await import('@/lib/billing/customer.server');
  const { data: b } = await supabaseAdmin.from('billing_accounts').select('stripe_customer_id').eq('user_id', userId).maybeSingle();
  if (b?.stripe_customer_id) return b.stripe_customer_id;
  const c = await resolveOrCreateCustomer(createStripeClient(env), { email, userId });
  await supabaseAdmin.from('billing_accounts').upsert({ user_id: userId, stripe_customer_id: c }, { onConflict: 'user_id' });
  return c;
}

/**
 * Starts paying for a host plan. The provider's payment form is mounted inline
 * with the returned secret; the account is activated by the payment webhook, so
 * a closed tab never leaves a paid plan half-applied.
 */
export const startPlanCheckout = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ plan: z.enum(['growth', 'pro']), origin, lang: z.enum(['en', 'es']), environment }).parse(d))
  .handler(async ({ data, context }): Promise<CheckoutResult> => {
    const { data: adult } = await context.supabase.rpc('is_adult', {});
    if (!adult) return { ok: false, error: 'adult_required' };
    const { createStripeClient, getStripeErrorMessage } = await import('@/lib/stripe.server');
    try {
      const { data: ps } = await context.supabase.from('plan_settings').select('monthly_price').eq('plan', data.plan).maybeSingle();
      if (!ps?.monthly_price) return { ok: false, error: 'failed' };
      // Founding coaches: free during the window, then the founding rate, locked while they stay on Pro.
      const { data: st } = await context.supabase.rpc('my_plan_status');
      const status = st as { own_plan?: string; founding?: { in_window: boolean; rate_cents: number } | null } | null;
      if (status?.own_plan === data.plan) return { ok: false, error: 'already_on_plan' };
      const founding = data.plan === 'pro' ? status?.founding ?? null : null;
      if (founding?.in_window) return { ok: false, error: 'founding_free' };

      const stripe = createStripeClient(data.environment);
      const customer = await ensureCustomer(context.userId, context.claims.email as string | undefined, data.environment);
      const meta = { kind: 'plan', user_id: context.userId, plan: data.plan, period: 'month', userId: context.userId, ...(founding ? { founding_rate: String(founding.rate_cents) } : {}) };
      const name = founding ? 'ZoheeWell Pro (Founding)' : data.plan === 'growth' ? 'ZoheeWell Advanced' : 'ZoheeWell Pro';

      let lineItem: Record<string, unknown>;
      if (founding) {
        // A founding rate is a personal price, so it is quoted inline rather than from the catalog.
        lineItem = { quantity: 1, price_data: { currency: 'usd', unit_amount: founding.rate_cents, recurring: { interval: 'month' }, product_data: { name } } };
      } else {
        const listed = (await stripe.prices.list({ lookup_keys: [PLAN_PRICE_KEYS[data.plan]] })).data[0];
        if (!listed) return { ok: false, error: 'price_not_found' };
        // The catalog and plan_settings must agree, or the app would show one
        // price and charge another.
        if (listed.unit_amount !== ps.monthly_price) return { ok: false, error: 'price_mismatch' };
        lineItem = { price: listed.id, quantity: 1 };
      }

      const session = await stripe.checkout.sessions.create({
        line_items: [lineItem], mode: 'subscription', ui_mode: 'embedded_page',
        return_url: `${data.origin}/plan?checkout=done&session_id={CHECKOUT_SESSION_ID}`,
        customer, locale: data.lang === 'es' ? 'es-419' : 'en',
        // Seller is in the United States and the product is software, so the
        // provider also handles tax, fraud, disputes and transaction support.
        managed_payments: { enabled: true },
        metadata: meta, subscription_data: { metadata: meta },
      } as never);
      if (!session.client_secret) return { ok: false, error: 'no_client_secret' };
      return { ok: true, clientSecret: session.client_secret, returnUrl: `${data.origin}/plan` };
    } catch (error) {
      return { ok: false, error: getStripeErrorMessage(error) };
    }
  });

/** Starts paying for a team seat license; a leader only. */
export const startLicenseCheckout = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ teamId: z.string().uuid(), tier: z.enum(['team25', 'team100']), origin, lang: z.enum(['en', 'es']), environment }).parse(d))
  .handler(async ({ data, context }): Promise<CheckoutResult> => {
    const { data: adult } = await context.supabase.rpc('is_adult', {});
    if (!adult) return { ok: false, error: 'adult_required' };
    const { createStripeClient, getStripeErrorMessage } = await import('@/lib/stripe.server');
    try {
      const { data: ok } = await context.supabase.rpc('is_team_member', { _team_id: data.teamId, _roles: ['leader'] });
      if (!ok) return { ok: false, error: 'forbidden' };
      const { data: existing } = await context.supabase.from('team_licenses').select('status').eq('team_id', data.teamId).maybeSingle();
      if (existing && ['active', 'past_due', 'trialing'].includes(existing.status)) return { ok: false, error: 'already_on_license' };

      const stripe = createStripeClient(data.environment);
      const customer = await ensureCustomer(context.userId, context.claims.email as string | undefined, data.environment);
      const listed = (await stripe.prices.list({ lookup_keys: [LICENSE_PRICE_KEYS[data.tier]] })).data[0];
      if (!listed) return { ok: false, error: 'price_not_found' };
      // The catalog and the price the leader sees must agree, or the app would
      // show one amount and charge another.
      const shown = LICENSES.find(l => l.id === data.tier);
      if (!shown || listed.unit_amount !== shown.cents) return { ok: false, error: 'price_mismatch' };
      const meta = { kind: 'license', user_id: context.userId, team_id: data.teamId, tier: data.tier, userId: context.userId };
      const session = await stripe.checkout.sessions.create({
        line_items: [{ price: listed.id, quantity: 1 }], mode: 'subscription', ui_mode: 'embedded_page',
        customer, locale: data.lang === 'es' ? 'es-419' : 'en',
        managed_payments: { enabled: true },
        metadata: meta, subscription_data: { metadata: meta },
      } as never);
      if (!session.client_secret) return { ok: false, error: 'no_client_secret' };
      return { ok: true, clientSecret: session.client_secret, returnUrl: `${data.origin}/plan/seats` };
    } catch (error) {
      return { ok: false, error: getStripeErrorMessage(error) };
    }
  });

/**
 * Schedules a plan switch for the end of the paid month instead of changing it
 * now, so nobody loses features they already paid for. Uses a subscription
 * schedule: the current phase runs to the period end, then the new plan starts.
 */
export const schedulePlanChange = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ target: z.enum(['growth', 'pro', 'free']), environment }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true; at: string } | { ok: false; error: string }> => {
    const { createStripeClient, getStripeErrorMessage, subscriptionPeriodEnd } = await import('@/lib/stripe.server');
    try {
      const { data: b } = await context.supabase.from('billing_accounts').select('plan, stripe_subscription_id, renews_at, status').eq('user_id', context.userId).maybeSingle();
      if (!b?.stripe_subscription_id || b.plan === 'free') return { ok: false, error: 'no_subscription' };
      if (b.plan === data.target) return { ok: false, error: 'already_on_plan' };

      const stripe = createStripeClient(data.environment);
      const sub = await stripe.subscriptions.retrieve(b.stripe_subscription_id);
      const currentPrice = sub.items?.data?.[0]?.price?.id;
      if (!currentPrice) return { ok: false, error: 'no_subscription' };
      const endAt = subscriptionPeriodEnd(sub) ?? (b.renews_at ? Math.floor(new Date(b.renews_at).getTime() / 1000) : null);
      if (!endAt) return { ok: false, error: 'no_period_end' };

      const nextMeta = { kind: 'plan', user_id: context.userId, plan: data.target, period: 'month', userId: context.userId };
      let nextPrice: string | null = null;
      if (data.target !== 'free') {
        const listed = (await stripe.prices.list({ lookup_keys: [PLAN_PRICE_KEYS[data.target]] })).data[0];
        if (!listed) return { ok: false, error: 'price_not_found' };
        nextPrice = listed.id;
      }

      const schedule = await stripe.subscriptionSchedules.create({ from_subscription: sub.id });
      const current = schedule.phases[0];
      if (!current) return { ok: false, error: 'no_subscription' };
      await stripe.subscriptionSchedules.update(schedule.id, {
        end_behavior: data.target === 'free' ? 'cancel' : 'release',
        phases: [
          { start_date: current.start_date, end_date: endAt, items: [{ price: currentPrice }], metadata: current.metadata ?? {} },
          ...(nextPrice ? [{ start_date: endAt, end_date: null, items: [{ price: nextPrice, metadata: nextMeta }], metadata: nextMeta }] : []),
        ],
      } as never);

      await context.supabase.from('billing_accounts').update({ pending_plan: data.target, pending_plan_at: new Date(endAt * 1000).toISOString() }).eq('user_id', context.userId);
      return { ok: true, at: new Date(endAt * 1000).toISOString() };
    } catch (error) {
      return { ok: false, error: getStripeErrorMessage(error) };
    }
  });

/** Hosted billing page where a person cancels, updates a card or sees invoices. */
export const openBillingPortal = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ origin, environment }).parse(d))
  .handler(async ({ data, context }): Promise<Result> => {
    const { createStripeClient, getStripeErrorMessage } = await import('@/lib/stripe.server');
    try {
      const customer = await ensureCustomer(context.userId, context.claims.email as string | undefined, data.environment);
      const portal = await createStripeClient(data.environment).billingPortal.sessions.create({ customer, return_url: `${data.origin}/plan` });
      return { ok: true, url: portal.url };
    } catch (error) {
      return { ok: false, error: getStripeErrorMessage(error) };
    }
  });

export const startConnectOnboarding = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ origin }).parse(d))
  .handler(async ({ data, context }): Promise<Result> => {
    const { stripe, stripeKey } = await import('./billing/stripe.server');
    if (!stripeKey()) return notConnected;
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: b } = await supabaseAdmin.from('billing_accounts').select('connect_account_id').eq('user_id', context.userId).maybeSingle();
    let acct = b?.connect_account_id;
    if (!acct) {
      const a = await stripe<{ id: string }>('accounts', { type: 'express', email: context.claims.email as string | undefined, metadata: { user_id: context.userId }, capabilities: { card_payments: { requested: true }, transfers: { requested: true } } });
      acct = a.id;
      await supabaseAdmin.from('billing_accounts').upsert({ user_id: context.userId, connect_account_id: acct, connect_status: 'pending' }, { onConflict: 'user_id' });
    }
    const link = await stripe<{ url: string }>('account_links', { account: acct, type: 'account_onboarding', refresh_url: `${data.origin}/plan?connect=retry`, return_url: `${data.origin}/plan?connect=done` });
    return { ok: true, url: link.url };
  });

/** Public (guests have no account): start paying for a gathering or challenge spot. */
export const startTicketCheckout = createServerFn({ method: 'POST' })
  .inputValidator((d: unknown) => z.object({
    eventId: z.string().uuid(), first: z.string().trim().min(1).max(60), last: z.string().trim().max(60), phone: z.string().trim().max(30), email: z.string().trim().email().max(200),
    plusOnes: z.number().int().min(0).max(3), sms: z.boolean(), mail: z.boolean(), lang: z.enum(['en', 'es']), origin, waiverName: z.string().trim().max(120).optional().default(''), promo: z.string().max(20).optional().default(''), adult: z.boolean().optional().default(false),
  }).parse(d))
  .handler(async ({ data }): Promise<Result> => {
    // Purchasers must be adults; the unchecked attestation is required server-side.
    if (data.adult !== true) return { ok: false, error: 'adult_required' };
    const { stripe, stripeKey } = await import('./billing/stripe.server');
    const { getRequestHeader } = await import('@tanstack/react-start/server');
    const waiverIp = (getRequestHeader('cf-connecting-ip') ?? getRequestHeader('x-forwarded-for') ?? '').split(',')[0]!.trim().slice(0, 64);
    if (!stripeKey()) return notConnected;
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: ev } = await supabaseAdmin.from('events').select('id, title, host_id, price_cents, pass_fee, cover_service_fee, status, visibility, requires_waiver, refund_policy').eq('id', data.eventId).maybeSingle();
    if (!ev || ev.status !== 'published' || ev.visibility !== 'public' || !ev.price_cents) return { ok: false, error: 'not_open' };
    if (ev.requires_waiver && data.waiverName.length < 2) return { ok: false, error: 'waiver_required' };
    const { data: b } = await supabaseAdmin.from('billing_accounts').select('connect_account_id, connect_status').eq('user_id', ev.host_id).maybeSingle();
    if (!b?.connect_account_id || b.connect_status !== 'active') return { ok: false, error: 'host_not_ready' };
    const qty = 1 + data.plusOnes;
    const promo = await promoFor(supabaseAdmin, data.promo, 'gathering', ev.id, data.email);
    if (promo && !promo.ok) return { ok: false, error: `promo_${promo.error}` };
    const discount = promo?.ok ? promoDiscount(ev.price_cents * qty, promo) : 0;
    const net = ev.price_cents * qty - discount;
    const { data: feeRaw } = await supabaseAdmin.rpc('platform_fee_cents', { _host: ev.host_id, _amount: net });
    const fee = Number(feeRaw ?? 0);
    const booking = ev.pass_fee ? fee : 0;
    // Guest service fee: its own line, or covered by the coach (taken from the payout, guest sees one all-in price).
    const { data: svcRaw } = await supabaseAdmin.rpc('service_fee_cents', { _host: ev.host_id, _amount: net });
    const service = Number(svcRaw ?? 0);
    const covered = ev.cover_service_fee;
    const items: Record<string, unknown>[] = [discount
      ? { quantity: 1, price_data: { currency: 'usd', unit_amount: net, product_data: { name: `${ev.title} × ${qty} (${promo!.ok ? promo!.code : ''})` } } }
      : { quantity: qty, price_data: { currency: 'usd', unit_amount: ev.price_cents, product_data: { name: ev.title } } }];
    if (booking) items.push({ quantity: 1, price_data: { currency: 'usd', unit_amount: booking, product_data: { name: data.lang === 'es' ? 'Cargo por reservación' : 'Booking fee' } } });
    if (service && !covered) items.push({ quantity: 1, price_data: { currency: 'usd', unit_amount: service, product_data: { name: data.lang === 'es' ? 'Cargo por servicio' : 'Service fee' } } });
    const meta = { kind: 'gathering', event_id: ev.id, first: data.first, last: data.last, phone: data.phone, email: data.email, plus: String(data.plusOnes), sms: String(data.sms), mail: String(data.mail), lang: data.lang, waiver: ev.requires_waiver ? data.waiverName : '', waiver_ip: ev.requires_waiver ? waiverIp : '' };
    const s = await stripe<{ id: string; url: string }>('checkout/sessions', {
      mode: 'payment', customer_email: data.email, locale: data.lang === 'es' ? 'es-419' : 'en', line_items: items,
      custom_text: { submit: { message: refundText(asRefundPolicy(ev.refund_policy), data.lang) } }, metadata: meta,
      payment_intent_data: { application_fee_amount: fee + service, transfer_data: { destination: b.connect_account_id }, metadata: meta },
      success_url: `${data.origin}/e/${ev.id}?paid=1`, cancel_url: `${data.origin}/e/${ev.id}`,
    });
    await supabaseAdmin.from('payments').insert({ kind: 'gathering', event_id: ev.id, host_id: ev.host_id, buyer_name: `${data.first} ${data.last}`.trim(), buyer_email: data.email,
      amount_cents: net + booking + (covered ? 0 : service), fee_cents: fee, booking_fee_cents: booking, service_fee_cents: service, service_fee_covered: covered, stripe_session_id: s.id, promo_id: promo?.ok ? promo.id : null, discount_cents: discount, buyer_key: data.email.toLowerCase() });
    return { ok: true, url: s.url };
  });

/** Host-only refunds: one payment or everyone for a gathering. */
export const refundPayments = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ paymentId: z.string().uuid().optional(), eventId: z.string().uuid().optional() }).refine(v => !!v.paymentId !== !!v.eventId).parse(d))
  .handler(async ({ data, context }) => {
    const { stripe, stripeKey } = await import('./billing/stripe.server');
    if (!stripeKey()) return { ok: false as const, error: 'not_connected', refunded: 0 };
    let q = context.supabase.from('payments').select('id, stripe_payment_intent').eq('host_id', context.userId).eq('status', 'paid');
    q = data.paymentId ? q.eq('id', data.paymentId) : q.eq('event_id', data.eventId!);
    const { data: rows } = await q;
    let refunded = 0;
    for (const p of rows ?? []) {
      if (!p.stripe_payment_intent) continue;
      try { await stripe('refunds', { payment_intent: p.stripe_payment_intent, reverse_transfer: true, refund_application_fee: true }); refunded++; } catch { /* reported by count */ }
    }
    return { ok: true as const, refunded };
  });

/** Signed-in member pays to join a paid challenge; the webhook adds them once paid. */
export const startChallengeCheckout = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ challengeId: z.string().uuid(), origin, lang: z.enum(['en', 'es']), promo: z.string().max(20).optional().default('') }).parse(d))
  .handler(async ({ data, context }): Promise<Result> => {
    const { data: adult } = await context.supabase.rpc('is_adult', {});
    if (!adult) return { ok: false, error: 'adult_required' };
    const { stripe, stripeKey } = await import('./billing/stripe.server');
    if (!stripeKey()) return notConnected;
    const { data: c } = await context.supabase.from('challenges').select('id, title_en, title_es, created_by, is_paid, price_cents').eq('id', data.challengeId).maybeSingle();
    if (!c?.is_paid || !c.price_cents) return { ok: false, error: 'not_open' };
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: b } = await supabaseAdmin.from('billing_accounts').select('connect_account_id, connect_status, pass_fee').eq('user_id', c.created_by).maybeSingle();
    if (!b?.connect_account_id || b.connect_status !== 'active') return { ok: false, error: 'host_not_ready' };
    const email = ((context.claims.email as string) ?? '').toLowerCase();
    const promo = await promoFor(supabaseAdmin, data.promo, 'challenge', c.id, email || context.userId);
    if (promo && !promo.ok) return { ok: false, error: `promo_${promo.error}` };
    const discount = promo?.ok ? promoDiscount(c.price_cents, promo) : 0;
    const net = c.price_cents - discount;
    const { data: feeRaw } = await supabaseAdmin.rpc('platform_fee_cents', { _host: c.created_by, _amount: net });
    const fee = Number(feeRaw ?? 0);
    const booking = b.pass_fee ? fee : 0;
    const name = (data.lang === 'es' ? c.title_es : c.title_en) || c.title_en || c.title_es;
    const items: Record<string, unknown>[] = [{ quantity: 1, price_data: { currency: 'usd', unit_amount: net, product_data: { name } } }];
    if (booking) items.push({ quantity: 1, price_data: { currency: 'usd', unit_amount: booking, product_data: { name: data.lang === 'es' ? 'Cargo por reservación' : 'Booking fee' } } });
    const meta = { kind: 'challenge', challenge_id: c.id, user_id: context.userId };
    const s = await stripe<{ id: string; url: string }>('checkout/sessions', {
      mode: 'payment', customer_email: context.claims.email as string | undefined, locale: data.lang === 'es' ? 'es-419' : 'en', line_items: items, metadata: meta,
      payment_intent_data: { application_fee_amount: fee, transfer_data: { destination: b.connect_account_id }, metadata: meta },
      success_url: `${data.origin}/challenge/${c.id}?paid=1`, cancel_url: `${data.origin}/challenge/${c.id}`,
    });
    await supabaseAdmin.from('payments').insert({ kind: 'challenge', challenge_id: c.id, host_id: c.created_by, buyer_email: (context.claims.email as string) ?? null, amount_cents: net + booking, fee_cents: fee, booking_fee_cents: booking, stripe_session_id: s.id, promo_id: promo?.ok ? promo.id : null, discount_cents: discount, buyer_key: email || context.userId });
    return { ok: true, url: s.url };
  });
