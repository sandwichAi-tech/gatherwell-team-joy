import { afterEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), update: vi.fn(), eq: vi.fn() }));
vi.mock('@/integrations/supabase/client.server', () => ({ supabaseAdmin: { rpc: mocks.rpc, from: () => ({ update: mocks.update }) } }));
import { processOutbox, isTestRecipient } from './process.server';
import { teamAnnouncementFrom } from '@/lib/company';
import { renderEmail } from './templates.server';

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
const base = { id: 'r1', channel: 'email', recipient: 'person@zoheewell.test', language: 'en', template: 'rsvp_confirmed', kind: 'transactional', payload: { title: 'T' }, user_id: null, attempts: 0, skip_reason: null, unsub_token: null };
function run(row: object) {
  mocks.rpc.mockImplementation((n: string) => Promise.resolve({ data: n === 'claim_outbox' ? [row] : 0, error: null }));
  mocks.update.mockReturnValue({ eq: mocks.eq }); mocks.eq.mockResolvedValue({ error: null });
  return processOutbox(1);
}
const ok = () => vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'x' }), { status: 200 }));

describe('Resend senders', () => {
  it('app emails come from hello@ with support reply-to', async () => {
    vi.stubEnv('RESEND_API_KEY', 'k'); const f = ok(); vi.stubGlobal('fetch', f);
    await run(base);
    const body = JSON.parse((f.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.from).toBe('ZoheeWell <hello@zoheewell.com>');
    expect(body.reply_to).toBe('support@zoheewell.com');
  });
  it('team announcements use the leader first name via Resend and keep unsubscribe headers', async () => {
    vi.stubEnv('RESEND_API_KEY', 'k'); const f = ok(); vi.stubGlobal('fetch', f);
    await run({ ...base, template: 'team_announcement', kind: 'announcements', payload: { team: 'A', author: 'Maria Lopez', body: 'hi' }, unsub_token: '00000000-0000-0000-0000-000000000001' });
    expect(f.mock.calls[0]![0]).toBe('https://api.resend.com/emails');
    const body = JSON.parse((f.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.from).toBe('Maria on ZoheeWell <team@zoheewell.com>');
    expect(body.reply_to).toBe('support@zoheewell.com');
    expect(body.headers['List-Unsubscribe']).toContain('/unsubscribe/');
    expect(body.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
  });
  it('test accounts never receive real email', async () => {
    vi.stubEnv('RESEND_API_KEY', 'k'); const f = vi.fn(); vi.stubGlobal('fetch', f);
    expect(await run({ ...base, recipient: 'zz-test-host@example.com' })).toMatchObject({ skipped: 1 });
    expect(f).not.toHaveBeenCalled();
    expect(isTestRecipient('a@example.com')).toBe(true);
    expect(isTestRecipient('real@gmail.com', 'ZZ-TEST Host')).toBe(true);
    expect(isTestRecipient('real@gmail.com', 'Ana')).toBe(false);
  });
  it('strips header characters from leader names', () => {
    expect(teamAnnouncementFrom('<x>')).toBe('x on ZoheeWell <team@zoheewell.com>');
    expect(teamAnnouncementFrom('')).toBe('Your team on ZoheeWell <team@zoheewell.com>');
  });
  it('footer carries the company address; unsubscribe only when a token exists', () => {
    const tx = renderEmail('rsvp_confirmed', 'en', { title: 'T' }, null)!;
    expect(tx.text).toContain('ZoheeWell LLC · 30 N Gould St, Ste R, Sheridan, WY 82801');
    expect(tx.text).not.toContain('unsubscribe');
    const mk = renderEmail('team_announcement', 'es', { team: 'A', body: 'b' }, 'https://z/unsubscribe/1')!;
    expect(mk.html).toContain('30 N Gould St');
    expect(mk.text).toContain('https://z/unsubscribe/1');
  });
});
