import { describe, expect, it } from 'vitest';
import { createCheckinQueue, isRetryableCheckinError } from './checkin-queue';

describe('private memory-only check-in queue', () => {
  it('deduplicates retries and keeps the latest attendance intent', () => {
    const q = createCheckinQueue();
    q.add({ key: 'r1', eventId: 'e1', rsvpId: 'r1', undo: false });
    q.add({ key: 'r1', eventId: 'e1', rsvpId: 'r1', undo: true });
    expect(q.items()).toHaveLength(1);
    expect(q.items()[0]?.undo).toBe(true);
    q.remove('r1'); expect(q.items()).toEqual([]);
  });
  it('returns snapshots and does not retain attendance in a new instance', () => {
    const q = createCheckinQueue(); q.add({ key: 'qr', eventId: 'e', code: 'private-code', undo: false });
    q.items().pop(); expect(q.items()).toHaveLength(1);
    expect(createCheckinQueue().items()).toEqual([]);
  });
  it('retries connection/server failures, not authorization/validation failures', () => {
    expect(isRetryableCheckinError({ code: '' }, 0)).toBe(true);
    expect(isRetryableCheckinError({ code: 'PGRST' }, 503)).toBe(true);
    expect(isRetryableCheckinError({ code: 'P0001' }, 400)).toBe(false);
    expect(isRetryableCheckinError({ code: '42501' }, 403)).toBe(false);
  });
});