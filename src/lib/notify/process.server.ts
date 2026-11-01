// Sends due outbox rows. Missing secrets => status "simulated" (treated as sent everywhere else).
import { APP_URL, renderEmail, renderPush, renderSms } from './templates.server';
import { sendWebPush } from './webpush.server';

type Row = { id: string; channel: string; recipient: string; language: string; template: string; kind: string; payload: Record<string, unknown>; user_id: string | null; attempts: number; skip_reason: string | null; unsub_token: string | null };
type Result = { status: 'sent' | 'simulated' | 'failed' | 'skipped'; providerId?: string | null; error?: string | null };

import { EMAIL_SENDERS, teamAnnouncementFrom } from '@/lib/company';

import { isTestRecipient } from '@/lib/qa-lab';
export { isTestRecipient };

/** Sends one rendered email through Resend. No key => simulated, never a fake "sent". */
async function sendViaResend(to: string, msg: { subject: string; html: string; text: string }, from: string, unsub: string | null): Promise<Result> {
  const key = process.env['RESEND_API_KEY'];
  if (!key) return { status: 'simulated' };
  const headers = unsub ? { 'List-Unsubscribe': `<${unsub}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } : undefined;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], reply_to: EMAIL_SENDERS.replyTo, subject: msg.subject, html: msg.html, text: msg.text, ...(headers ? { headers } : {}) }),
  });
  const text = await res.text();
  if (!res.ok) return { status: 'failed', error: `resend ${res.status}: ${text.slice(0, 300)}` };
  let id: string | null = null; try { id = (JSON.parse(text) as { id?: string }).id ?? null; } catch { /* ignore */ }
  return { status: 'sent', providerId: id };
}

/** Admin console test: one message to the signed-in admin. */
export async function sendAdminTestEmail(to: string, lang: 'en' | 'es'): Promise<Result> {
  if (isTestRecipient(to)) return { status: 'skipped', error: 'test_account' };
  const msg = renderEmail('admin_test', lang, {}, null);
  if (!msg) return { status: 'skipped', error: 'unknown_template' };
  return sendViaResend(to, msg, EMAIL_SENDERS.app, null);
}

// Kept for reference; team announcements now send through Resend.
const MAILGUN_FROM = teamAnnouncementFrom(null);

async function sendEmail(row: Row, testName: string | null = null): Promise<Result> {
  const lang = row.language === 'es' ? 'es' : 'en';
  const unsub = row.unsub_token ? `${APP_URL}/unsubscribe/${row.unsub_token}` : null;
  const msg = renderEmail(row.template, lang, row.payload, unsub);
  if (!msg) return { status: 'skipped', error: 'unknown_template' };
  if (isTestRecipient(row.recipient, testName)) return { status: 'skipped', error: 'test_account' };
  const from = row.template === 'team_announcement' ? teamAnnouncementFrom(typeof row.payload['author'] === 'string' ? row.payload['author'] : null) : EMAIL_SENDERS.app;
  const result = await sendViaResend(row.recipient, msg, from, unsub);
  if (result.status === 'simulated') console.info('[outbox] simulated resend', row.id, row.template);
  return result;
}

/** Unused: Mailgun path retained for a possible future switch. */
export async function sendViaMailgun(row: Row, msg: { subject: string; html: string; text: string }, unsub: string | null): Promise<Result> {
  const env = process.env;
  const key = env['MAILGUN_API_KEY']; const domain = env['MAILGUN_DOMAIN'];
  if (!key || !domain) return { status: 'simulated' };
  const form = new URLSearchParams({ from: MAILGUN_FROM, to: row.recipient, subject: msg.subject, html: msg.html, text: msg.text });
  if (unsub) { form.set('h:List-Unsubscribe', `<${unsub}>`); form.set('h:List-Unsubscribe-Post', 'List-Unsubscribe=One-Click'); }
  const res = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, { method: 'POST', headers: { Authorization: `Basic ${btoa(`api:${key}`)}` }, body: form });
  const text = await res.text();
  if (!res.ok) return { status: 'failed', error: `mailgun ${res.status}: ${text.slice(0, 300)}` };
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
    let testName: string | null = null; let testFlag = false;
    if (row.user_id) {
      const { data: prof } = await supabaseAdmin.from('profiles').select('full_name, is_test').eq('id', row.user_id).maybeSingle();
      testName = prof?.full_name ?? null; testFlag = prof?.is_test === true;
    }
    try {
      if (row.skip_reason) result = { status: 'skipped', error: row.skip_reason };
      // Test accounts: suppressed and logged (shown in Admin > QA Lab), never sent on any channel.
      else if (testFlag || isTestRecipient(row.recipient, testName)) result = { status: 'skipped', error: 'test_account' };
      else if (typeof row.payload['attendance_audience'] === 'string') {
        const { data: eligible, error } = await supabaseAdmin.rpc('attendance_message_eligible', {
          _rsvp: String(row.payload['rsvp_id'] ?? ''), _audience: row.payload['attendance_audience'], _channel: row.channel,
        });
        if (error) result = { status: 'failed', error: 'eligibility_check_failed' };
        else if (!eligible) result = { status: 'skipped', error: 'attendance_or_preference_changed' };
        else if (row.channel === 'email') result = await sendEmail(row, testName);
        else if (row.channel === 'sms') result = await sendSms(row);
        else result = { status: 'skipped', error: 'invalid_channel' };
      }
      else if (row.channel === 'email') result = await sendEmail(row, testName);
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
  let journeys = 0; let resourceJourneys = 0;
  try {
    const adv = await supabaseAdmin.rpc('advance_journey_runs', { _limit: 50 });
    const attendanceAdv = await supabaseAdmin.rpc('process_attendance_journeys', { _limit: 50 });
    if (attendanceAdv.error) console.error('[outbox] attendance_journeys', attendanceAdv.error.message);
    const resourceAdv = await supabaseAdmin.rpc('advance_resource_journeys', { _limit: 50 });
    if (resourceAdv.error) console.error('[outbox] resource_journeys', resourceAdv.error.message);
    else resourceJourneys = typeof resourceAdv.data === 'number' ? resourceAdv.data : 0;
    if (!adv.error) journeys = typeof adv.data === 'number' ? adv.data : 0;
    else console.error('[outbox] advance_journey_runs', adv.error.message);
  } catch (e) { console.error('[outbox] advance_journey_runs', e); }
  return { processed: rows.length, journeys, resourceJourneys, ...tally };
}
