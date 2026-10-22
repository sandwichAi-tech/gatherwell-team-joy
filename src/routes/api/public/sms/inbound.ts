import { createFileRoute } from '@tanstack/react-router';
import { createHmac, timingSafeEqual } from 'crypto';
import { smsHelp } from '@/lib/notify/templates.server';

const twiml = (msg?: string) => new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${msg ? `<Message>${msg.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</Message>` : ''}</Response>`, { headers: { 'Content-Type': 'text/xml' } });

// Inbound text replies: STOP / START / HELP (English and Spanish).
export const Route = createFileRoute('/api/public/sms/inbound')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = process.env['TWILIO_AUTH_TOKEN'];
        if (!token) return new Response('Texting not connected yet', { status: 503 });
        const raw = await request.text();
        const params = new URLSearchParams(raw);
        const url = request.headers.get('x-forwarded-host') ? `https://${request.headers.get('x-forwarded-host')}${new URL(request.url).pathname}` : request.url;
        const data = url + [...params.keys()].sort().map(k => k + (params.get(k) ?? '')).join('');
        const expected = createHmac('sha1', token).update(data).digest('base64');
        const given = request.headers.get('x-twilio-signature') ?? '';
        if (!given || given.length !== expected.length || !timingSafeEqual(Buffer.from(given), Buffer.from(expected))) return new Response('Invalid signature', { status: 401 });
        const from = (params.get('From') ?? '').slice(0, 32); const body = (params.get('Body') ?? '').slice(0, 160);
        const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
        const { data: reply } = await supabaseAdmin.rpc('handle_sms_reply', { _from: from, _body: body });
        const result = (reply as { result?: string } | null)?.result;
        const spanish = /cancelar|ayuda|alto|baja|iniciar|s[ií]\b/i.test(body);
        if (result === 'help') return twiml(smsHelp(spanish ? 'es' : 'en'));
        if (result === 'started') return twiml(spanish ? 'ZoheeWell: volverás a recibir recordatorios. Responde STOP para no recibir más.' : 'ZoheeWell: you will receive reminders again. Reply STOP to opt out.');
        if (result === 'no_invite') return twiml(spanish ? 'ZoheeWell: no encontramos una invitación reciente para este número. Responde STOP para no recibir más.' : "ZoheeWell: we couldn't find a recent invite for this number. Reply STOP to opt out.");
        return twiml(); // RSVP confirmations go out through the outbox; STOP confirmations come from the carrier
      },
    },
  },
});
