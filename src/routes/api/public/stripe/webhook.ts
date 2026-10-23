// Legacy bring-your-own-key endpoint. Kept so an older connection keeps working;
// the platform-managed endpoint at /api/public/payments/webhook is the live one.
// Both share the same purchase, cancel, refund and failed-payment rules.
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/public/stripe/webhook')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env['STRIPE_WEBHOOK_SECRET'];
        if (!secret || !process.env['STRIPE_SECRET_KEY']) return new Response('Payments not connected', { status: 503 });
        const body = await request.text();
        const { verifyStripeSignature } = await import('@/lib/billing/stripe.server');
        if (!verifyStripeSignature(body, request.headers.get('stripe-signature'), secret)) return new Response('Invalid signature', { status: 401 });
        const evt = JSON.parse(body) as { id: string; type: string; data: { object: any } };
        const { supabaseAdmin: db } = await import('@/integrations/supabase/client.server');
        const { handlePaymentEvent } = await import('@/lib/billing/webhook-events.server');
        const result = await handlePaymentEvent(db, evt);
        if (result === 'failed') return new Response('error', { status: 500 });
        return new Response('ok');
      },
    },
  },
});
