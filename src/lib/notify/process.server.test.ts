import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), update: vi.fn(), eq: vi.fn() }));
vi.mock('@/integrations/supabase/client.server', () => ({
  supabaseAdmin: { rpc: mocks.rpc, from: () => ({ update: mocks.update }) },
}));
import { processOutbox } from './process.server';

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe('retried messages use normal outbox delivery', () => {
  const row = { id: 'retry-test', channel: 'email', recipient: 'retry-test@example.invalid', language: 'en', template: 'rsvp_confirmed', kind: 'transactional', payload: { title: 'Test gathering' }, user_id: null, attempts: 1, skip_reason: null, unsub_token: null };
  it('records simulation instead of contacting a provider when no sending secret exists', async () => {
    vi.stubEnv('RESEND_API_KEY', undefined);
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    mocks.rpc.mockResolvedValue({ data: [row], error: null });
    mocks.update.mockReturnValue({ eq: mocks.eq }); mocks.eq.mockResolvedValue({ error: null });
    expect(await processOutbox(1)).toEqual({ processed: 1, journeys: 0, resourceJourneys: 0, simulated: 1 });
    expect(fetch).not.toHaveBeenCalled();
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'simulated', error: null, locked_at: null }));
    expect(mocks.eq).toHaveBeenCalledWith('id', 'retry-test');
  });
  it('skips retried messages when the queue marks their recipient as opted out', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    mocks.rpc.mockResolvedValue({ data: [{ ...row, skip_reason: 'unsubscribed' }], error: null });
    mocks.update.mockReturnValue({ eq: mocks.eq }); mocks.eq.mockResolvedValue({ error: null });
    expect(await processOutbox(1)).toEqual({ processed: 1, journeys: 0, resourceJourneys: 0, skipped: 1 });
    expect(fetch).not.toHaveBeenCalled();
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'skipped', error: 'unsubscribed', sent_at: null }));
  });
  it('advances resource runs through the existing processor without a sending provider', async () => {
    mocks.rpc.mockImplementation((name: string) => Promise.resolve({ data: name === 'claim_outbox' ? [] : name === 'advance_resource_journeys' ? 2 : 0, error: null }));
    expect(await processOutbox(1)).toEqual({ processed: 0, journeys: 0, resourceJourneys: 2 });
    expect(mocks.rpc).toHaveBeenCalledWith('advance_resource_journeys', { _limit: 50 });
  });
  it('rechecks attendance eligibility before contacting any sending provider', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    mocks.rpc.mockImplementation((name: string) => Promise.resolve({ data: name === 'claim_outbox' ? [{ ...row, payload: { attendance_audience: 'attended', rsvp_id: 'fixture-rsvp' } }] : name === 'attendance_message_eligible' ? false : 0, error: null }));
    mocks.update.mockReturnValue({ eq: mocks.eq }); mocks.eq.mockResolvedValue({ error: null });
    expect(await processOutbox(1)).toEqual({ processed: 1, journeys: 0, resourceJourneys: 0, skipped: 1 });
    expect(fetch).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledWith('attendance_message_eligible', { _rsvp: 'fixture-rsvp', _audience: 'attended', _channel: 'email' });
  });
});