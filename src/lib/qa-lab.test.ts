import { afterEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), update: vi.fn(), eq: vi.fn(), profile: { full_name: 'Real Name', is_test: true } as { full_name: string; is_test: boolean } | null }));
vi.mock('@/integrations/supabase/client.server', () => ({ supabaseAdmin: { rpc: mocks.rpc, from: (t: string) => t === 'profiles'
  ? { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: mocks.profile }) }) }) }
  : { update: mocks.update } } }));
import { processOutbox } from './notify/process.server';
import { QA_PERSONAS, blocksLiveCharge, isTestRecipient, qaEmail, qaName, qaPhone } from './qa-lab';

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
const run = (row: object) => {
  mocks.rpc.mockImplementation((n: string) => Promise.resolve({ data: n === 'claim_outbox' ? [row] : 0, error: null }));
  mocks.update.mockReturnValue({ eq: mocks.eq }); mocks.eq.mockResolvedValue({ error: null });
  return processOutbox(1);
};
const base = { id: 'q', recipient: 'x', language: 'en', template: 'rsvp_confirmed', kind: 'transactional', payload: { title: 'T' }, user_id: null, attempts: 0, skip_reason: null, unsub_token: null };

describe('QA personas', () => {
  it('are ten ZZ-TEST personas with example.com emails and 555-01xx phones', () => {
    expect(QA_PERSONAS).toHaveLength(10);
    QA_PERSONAS.forEach((p, i) => {
      expect(qaName(p.label)).toMatch(/^ZZ-TEST /);
      expect(qaEmail(p.slug)).toMatch(/^zz-test\+[a-z]+@example\.com$/);
      expect(qaPhone(i)).toMatch(/^\+131055501\d\d$/);
      expect(isTestRecipient(qaEmail(p.slug))).toBe(true);
      expect(isTestRecipient(qaPhone(i))).toBe(true);
    });
    expect(QA_PERSONAS.find(p => p.key === 'p1')?.account).toBe(false);
    expect(QA_PERSONAS.find(p => p.key === 'p7')?.lang).toBe('es');
  });
  it('does not treat real numbers as test numbers', () => {
    expect(isTestRecipient('+19496303386')).toBe(false);
    expect(isTestRecipient('+13105550200')).toBe(false);
  });
});

describe('messages to test accounts are suppressed and logged', () => {
  it('push to a test-flagged account is skipped as test_account', async () => {
    const f = vi.fn(); vi.stubGlobal('fetch', f);
    expect(await run({ ...base, channel: 'push', recipient: 'u1', user_id: 'u1' })).toMatchObject({ skipped: 1 });
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'skipped', error: 'test_account' }));
    expect(f).not.toHaveBeenCalled();
  });
  it('SMS to a 555-01xx number is skipped even with Twilio configured', async () => {
    vi.stubEnv('TWILIO_ACCOUNT_SID', 'a'); vi.stubEnv('TWILIO_AUTH_TOKEN', 'b'); vi.stubEnv('TWILIO_FROM', 'c');
    const f = vi.fn(); vi.stubGlobal('fetch', f);
    expect(await run({ ...base, channel: 'sms', recipient: qaPhone(3) })).toMatchObject({ skipped: 1 });
    expect(f).not.toHaveBeenCalled();
  });
  it('email to a test-flagged account with a real-looking address is skipped', async () => {
    vi.stubEnv('RESEND_API_KEY', 'k'); const f = vi.fn(); vi.stubGlobal('fetch', f);
    expect(await run({ ...base, channel: 'email', recipient: 'someone@gmail.com', user_id: 'u1' })).toMatchObject({ skipped: 1 });
    expect(f).not.toHaveBeenCalled();
  });
});

describe('test accounts are never charged in live mode', () => {
  it('blocks live checkout for test emails, allows Stripe test mode', () => {
    expect(blocksLiveCharge('sk_live_x', 'zz-test+member@example.com')).toBe(true);
    expect(blocksLiveCharge('sk_test_x', 'zz-test+member@example.com')).toBe(false);
    expect(blocksLiveCharge('sk_live_x', 'buyer@gmail.com')).toBe(false);
  });
});
