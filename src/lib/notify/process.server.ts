// Sends due outbox rows. Missing secrets => status "simulated" (treated as sent everywhere else).
import { APP_URL, renderEmail, renderPush, renderSms } from './templates.server';
import { sendWebPush } from './webpush.server';

type Row = { id: string; channel: string; recipient: string; language: string; template: string; kind: string; payload: Record<string, unknown>; user_id: string | null; attempts: number; skip_reason: string | null; unsub_token: string | null };
type Result = { status: 'sent' | 'simulated' | 'failed' | 'skipped'; providerId?: string | null; error?: string | null };

const RESEND_FROM = 'ZoheeWell <hello@mail.yourdomain.com>';
const MAILGUN_FROM = 'Your Team on ZoheeWell <team@team.yourdomain.com>';

async function sendEmail(row: Row): Promise<Result> {
  const lang = row.language === 'es' ? 'es' : 'en';
  const unsub = row.unsub_token ? `${APP_URL}/unsubscribe/${row.unsub_token}` : null;
  const msg = renderEmail(row.template, lang, row.payload, unsub);
  if (!msg) return { status: 'skipped', error: 'unknown_template' };
  const env = process.env;
  if (row.template === 'team_announcement') {
    const key = env['MAILGUN_API_KEY']; const domain = env['MAILGUN_DOMAIN'];
    if (!key || !domain) { console.info('[outbox] simulated mailgun', row.id, row.template); return { status: 'simulated' }; }
    const form = new URLSearchParams({ from: MAILGUN_FROM, to: row.recipient, subject: msg.subject, html: msg.html, text: msg.text });
    if (unsub) { form.set('h:List-Unsubscribe', `<${unsub}>`); form.set('h:List-Unsubscribe-Post', 'List-Unsubscribe=One-Click'); }
    const res = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, { method: 'POST', headers: { Authorization: `Basic ${btoa(`api:${key}`)}` }, body: form });
    const text = await res.text();
    if (!res.ok) return { status: 'failed', error: `mailgun ${res.status}: ${text.slice(0, 300)}` };
    let id: string | null = null; try { id = (JSON.parse(text) as { id?: string }).id ?? null; } catch { /* ignore */ }
    return { status: 'sent', providerId: id };
  }
  const key = env['RESEND_API_KEY'];
  if (!key) { console.info('[outbox] simulated resend', row.id, row.template); return { status: 'simulated' }; }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: RESEND_FROM, to: [row.recipient], subject: msg.subject, html: msg.html, text: msg.text, ...(unsub ? { headers: { 'List-Unsubscribe': `<${unsub}>` } } : {}) }),
  });
  const text = await res.text();
  if (!res.ok) return { status: 'failed', error: `resend ${res.status}: ${text.slice(0, 300)}` };
  let id: string | null = null; try { id = (JSON.parse(text) as { id?: string }).id ?? null; } catch { /* ignore */ }
  return { status: 'sent', providerId: id };
}

async function sendSms(row: Row): Promise<Result> {
  const body = renderSms(row.template, row.language === 'es' ? 'es' : 'en', row.payload);
  if (!body) return { status: 'skipped', error: 'no_sms_template' };
  const env = process.env; const sid = env['TWILIO_ACCOUNT_SID']; const token = env['TWILIO_AUTH_TOKEN']; const from = env['TWILIO_FROM'];
  if (!sid || !token || !from) { console.info('[outbox] simulated sms', row.id, row.template); return { status: 'simulated' }; }
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST', headers: { Authorization: `Basic ${btoa(`${sid}:${token}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ To: row.recipient, From: from, Body: body }),
  });
  const text = await res.text();
  if (!res.ok) return { status: 'failed', error: `twilio ${res.status}: ${text.slice(0, 300)}` };
  let id: string | null = null; try { id = (JSON.parse(text) as { sid?: string }).sid ?? null; } catch { /* ignore */ }
  return { status: 'sent', providerId: id };
}

type Admin = Awaited<typeof import('@/integrations/supabase/client.server')>['supabaseAdmin'];

async function sendPush(row: Row, admin: Admin): Promise<Result> {
  const msg = renderPush(row.template, row.language === 'es' ? 'es' : 'en', row.payload);
  if (!msg) return { status: 'skipped', error: 'unknown_template' };
  const publicKey = process.env['VAPID_PUBLIC_KEY']; const privateKey = process.env['VAPID_PRIVATE_KEY'];
  if (!publicKey || !privateKey) return { status: 'simulated' };
  const { data: subs } = await admin.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', row.user_id ?? row.recipient);
  if (!subs?.length) return { status: 'skipped', error: 'no_device' };
  let delivered = 0; const errors: string[] = [];
  for (const sub of subs) {
    try {
      const r = await sendWebPush(sub, msg, { publicKey, privateKey });
      if (r.ok) delivered++;
      else if (r.status === 404 || r.status === 410) await admin.from('push_subscriptions').delete().eq('id', sub.id);
      else errors.push(`${r.status} ${r.text.slice(0, 120)}`);
    } catch (e) { errors.push(e instanceof Error ? e.message : 'push_error'); }
  }
  if (delivered) return { status: 'sent' };
  return errors.length ? { status: 'failed', error: errors.join('; ') } : { status: 'skipped', error: 'no_device' };
}

export async function processOutbox(limit = 100) {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data, error } = await supabaseAdmin.rpc('claim_outbox', { _limit: limit });
  if (error) throw new Error(`claim_outbox: ${error.message}`);
  const rows = (data ?? []) as Row[];
  const tally: Record<string, number> = {};
  for (const row of rows) {
    let result: Result;
    try {
      if (row.skip_reason) result = { status: 'skipped', error: row.skip_reason };
      else if (row.channel === 'email') result = await sendEmail(row);
      else if (row.channel === 'sms') result = await sendSms(row);
      else result = await sendPush(row, supabaseAdmin);
    } catch (e) { result = { status: 'failed', error: e instanceof Error ? e.message : 'send_error' }; }
    if (result.status === 'failed') console.error('[outbox] failed', row.id, row.attempts, result.error);
    tally[result.status] = (tally[result.status] ?? 0) + 1;
    await supabaseAdmin.from('notification_outbox').update({
      status: result.status, error: result.error ?? null, provider_message_id: result.providerId ?? null, locked_at: null,
      sent_at: result.status === 'sent' || result.status === 'simulated' ? new Date().toISOString() : null,
    }).eq('id', row.id);
  }
  // Advance due journey runs through the same pipeline (sends enqueue here, gates apply).
  let journeys = 0;
  try {
    const adv = await supabaseAdmin.rpc('advance_journey_runs', { _limit: 50 });
    const resourceAdv = await supabaseAdmin.rpc('advance_resource_journeys', { _limit: 50 });
    if (resourceAdv.error) console.error('[outbox] resource_journeys', resourceAdv.error.message);
    if (!adv.error) journeys = typeof adv.data === 'number' ? adv.data : 0;
    else console.error('[outbox] advance_journey_runs', adv.error.message);
  } catch (e) { console.error('[outbox] advance_journey_runs', e); }
  return { processed: rows.length, journeys, ...tally };
}
