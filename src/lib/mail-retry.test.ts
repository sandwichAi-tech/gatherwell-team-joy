import { describe, expect, it } from 'vitest';
import { canRetryMessage } from './mail-retry';

describe('admin message retry eligibility', () => {
  it('allows failed messages with no delivery acknowledgement', () => {
    expect(canRetryMessage({ status: 'failed', provider_message_id: null, sent_at: null })).toBe(true);
  });
  it.each(['pending', 'sending', 'sent', 'simulated', 'skipped'])('does not requeue %s messages', status => {
    expect(canRetryMessage({ status, provider_message_id: null, sent_at: null })).toBe(false);
  });
  it('blocks messages acknowledged by a provider', () => {
    expect(canRetryMessage({ status: 'failed', provider_message_id: 'acknowledged', sent_at: null })).toBe(false);
  });
  it('blocks messages with a recorded delivery time', () => {
    expect(canRetryMessage({ status: 'failed', provider_message_id: null, sent_at: '2026-10-16T21:52:00Z' })).toBe(false);
  });
});