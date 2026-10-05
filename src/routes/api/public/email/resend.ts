import { createFileRoute } from '@tanstack/react-router';
import { createHmac, timingSafeEqual } from 'crypto';

// Delivery reports for transactional email (signed webhook).
export const Route = createFileRoute('/api/public/email/resend')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env['RESEND_WEBHOOK_SECRET'];
        if (!secret) return new Response('Email reports not connected yet', { status: 503 });
        const id = request.headers.get('svix-id') ?? ''; const ts = request.headers.get('svix-timestamp') ?? ''; const sigs = request.headers.get('svix-signature') ?? '';
        const body = await request.text();
        if (!id || !ts || Math.abs(Date.now() / 1000 - Number(ts)) > 600) return new Response('Invalid', { status: 401 });
        const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
        const expected = Buffer.from(createHmac('sha256', key).update(`${id}.${ts}.${body}`).digest('base64'));
        const ok = sigs.split(' ').some(s => { const v = Buffer.from(s.split(',')[1] ?? ''); return v.length === expected.length && timingSafeEqual(v, expected); });
        if (!ok) return new Response('Invalid signature', { status: 401 });
        let evt: { type?: string; data?: { email_id?: string; to?: string[] } };
        try { evt = JSON.parse(body); } catch { return new Response('Bad JSON', { status: 400 }); }
        const map: Record<string, string> = { 'email.delivered': 'delivered', 'email.bounced': 'bounced', 'email.complained': 'complained' };
        const kind = map[evt.type ?? ''];
        if (kind) {
          const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
          await supabaseAdmin.rpc('record_delivery_event', { _provider: 'resend', _message_id: evt.data?.email_id ?? '', _event: kind, _email: evt.data?.to?.[0] ?? '', _payload: { type: evt.type } });
        }
        return new Response('ok');
      },
    },
  },
});
