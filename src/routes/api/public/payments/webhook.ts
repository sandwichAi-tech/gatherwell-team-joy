// Platform-managed payment notifications land here (the integration registers
// this path with an ?env= query). The signature is the only caller check — there
// is no session token on these requests — so verification runs before any write.
import { createFileRoute } from '@tanstack/react-router';
import { type StripeEnv, verifyWebhook } from '@/lib/stripe.server';

export const Route = createFileRoute('/api/public/payments/webhook')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get('env');
        if (rawEnv !== 'sandbox' && rawEnv !== 'live') {
          console.error('[payments webhook] invalid or missing env query parameter:', rawEnv);
          return Response.json({ received: true, ignored: 'invalid env' });
        }
        const env: StripeEnv = rawEnv;
        try {
          const evt = await verifyWebhook(request, env);
          const { supabaseAdmin: db } = await import('@/integrations/supabase/client.server');
          const { handlePaymentEvent } = await import('@/lib/billing/webhook-events.server');
          const result = await handlePaymentEvent(db, evt as any, env);
          if (result === 'failed') return new Response('error', { status: 500 });
          return Response.json({ received: true });
        } catch (e) {
          console.error('[payments webhook]', e);
          return new Response('Webhook error', { status: 400 });
        }
      },
    },
  },
});
