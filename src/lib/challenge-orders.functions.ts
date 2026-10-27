import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

export type PublicChallenge = { id: string; title_en: string; title_es: string; description_en: string | null; description_es: string | null; starts_on: string; ends_on: string; is_paid: boolean; price_cents: number; currency: string; enrollment: string; addons: { id: string; name: string; description: string; price_cents: number; max_quantity: number; inventory: number | null; available: boolean }[] };
export const getPublicChallenge = createServerFn({ method: 'GET' })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }): Promise<PublicChallenge | null> => {
    const { createClient } = await import('@supabase/supabase-js');
    const url = process.env['SUPABASE_URL']; const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
    if (!url || !key) return null;
    const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => {
      const h = new Headers(init?.headers); if (key.startsWith('sb_') && h.get('Authorization') === `Bearer ${key}`) h.delete('Authorization'); h.set('apikey', key); return fetch(input, { ...init, headers: h });
    } } });
    const r = await db.rpc('get_public_challenge', { _id: data.id }); if (r.error) throw new Error('challenge_unavailable');
    return r.data as PublicChallenge | null;
  });

export const beginChallengeOrder = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), request: z.string().uuid(), extras: z.array(z.object({ id: z.string().min(1).max(100), quantity: z.number().int().min(1).max(20) })).max(8), environment: z.enum(['sandbox', 'live']), origin: z.string().url().refine(u => /^https:\/\//.test(u) || /^http:\/\/localhost(:\d+)?$/.test(u)), lang: z.enum(['en', 'es']) }).parse(d))
  .handler(async ({ data, context }): Promise<{ enrolled?: boolean; url?: string; error?: string }> => {
    const { data: c, error } = await context.supabase.from('challenges').select('is_paid,addons').eq('id', data.id).maybeSingle();
    if (error || !c) return { error: 'not_allowed' };
    const extras = c.addons as unknown as PublicChallenge['addons'];
    const paid = c.is_paid || data.extras.some(s => (extras.find(a => a.id === s.id)?.price_cents ?? 0) > 0);
    if (paid && !process.env[data.environment === 'live' ? 'STRIPE_LIVE_API_KEY' : 'STRIPE_SANDBOX_API_KEY']) return { error: 'checkout_setup_required' };
    const r = await context.supabase.rpc('create_challenge_order', { _c: data.id, _request: data.request, _extras: data.extras, _environment: data.environment });
    if (r.error) return { error: r.error.message };
    const intent = r.data as { id?: string; enrolled?: boolean; status?: string };
    if (intent.enrolled) return { enrolled: true };
    if (!intent.id || intent.status !== 'pending') return { error: 'checkout_pending' };
    const { createStripeClient, getStripeErrorMessage } = await import('@/lib/stripe.server');
    try {
      // Authorization came from the caller-scoped atomic order RPC. Privileged reads are limited to that returned order.
      const { supabaseAdmin: db } = await import('@/integrations/supabase/client.server');
      const order = (await db.from('orders').select('*').eq('id', intent.id).eq('buyer_user_id', context.userId).single()).data;
      if (!order?.connected_account_id) return { error: 'checkout_setup_required' };
      const stripe = createStripeClient(data.environment);
      if (order.stripe_checkout_session_id) {
        const session = await stripe.checkout.sessions.retrieve(order.stripe_checkout_session_id);
        return session.url ? { url: session.url } : { error: 'checkout_pending' };
      }
      const lines = (await db.from('order_items').select('*').eq('order_id', order.id)).data ?? [];
      const session = await stripe.checkout.sessions.create({ mode: 'payment', expires_at: Math.floor(new Date(order.reservation_expires_at ?? '').getTime() / 1000), line_items: lines.filter(i => i.unit_cents > 0).map(i => ({ quantity: i.quantity, price_data: { currency: order.currency, unit_amount: i.unit_cents, product_data: { name: i.description ?? 'Challenge' } } })), metadata: { kind: 'challenge_order', order_id: order.id, user_id: context.userId }, payment_intent_data: { application_fee_amount: order.platform_fee_cents, transfer_data: { destination: order.connected_account_id }, metadata: { kind: 'challenge_order', order_id: order.id } }, success_url: `${data.origin}/c/${data.id}`, cancel_url: `${data.origin}/c/${data.id}`, locale: data.lang === 'es' ? 'es-419' : 'en' }, { idempotencyKey: order.idempotency_key });
      const saved = await db.from('orders').update({ stripe_checkout_session_id: session.id }).eq('id', order.id).eq('status', 'pending');
      if (saved.error) throw saved.error;
      return session.url ? { url: session.url } : { error: 'checkout_pending' };
    } catch (e) { return { error: getStripeErrorMessage(e) }; }
  });