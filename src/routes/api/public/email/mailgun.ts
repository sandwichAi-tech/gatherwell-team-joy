import { createFileRoute } from '@tanstack/react-router';
import { createHmac, timingSafeEqual } from 'crypto';

// Delivery reports for team announcement email (signed webhook).
export const Route = createFileRoute('/api/public/email/mailgun')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env['MAILGUN_WEBHOOK_SIGNING_KEY'];
        if (!key) return new Response('Email reports not connected yet', { status: 503 });
        let body: { signature?: { timestamp?: string; token?: string; signature?: string }; 'event-data'?: { event?: string; severity?: string; recipient?: string; message?: { headers?: { 'message-id'?: string } } } };
        try { body = await request.json(); } catch { return new Response('Bad JSON', { status: 400 }); }
        const sig = body.signature ?? {};
        if (!sig.timestamp || !sig.token || !sig.signature || Math.abs(Date.now() / 1000 - Number(sig.timestamp)) > 600) return new Response('Invalid', { status: 401 });
        const expected = Buffer.from(createHmac('sha256', key).update(sig.timestamp + sig.token).digest('hex'));
        const given = Buffer.from(sig.signature);
        if (given.length !== expected.length || !timingSafeEqual(given, expected)) return new Response('Invalid signature', { status: 401 });
        const e = body['event-data'] ?? {};
        const kind = e.event === 'delivered' ? 'delivered' : e.event === 'complained' ? 'complained' : e.event === 'failed' && e.severity === 'permanent' ? 'bounced' : null;
        if (kind) {
          const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
          await supabaseAdmin.rpc('record_delivery_event', { _provider: 'mailgun', _message_id: e.message?.headers?.['message-id'] ?? '', _event: kind, _email: e.recipient ?? '', _payload: { event: e.event, severity: e.severity ?? null } });
        }
        return new Response('ok');
      },
    },
  },
});
