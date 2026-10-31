import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { clearIdentityCache, clearPersonalModeCache } from './personal-cache';
describe('personal cache boundaries', () => {
  it('mode switching removes Teams membership, sharing and leader insight caches', async () => {
    const client = new QueryClient();
    const keys = [['my-team-states', 'A'], ['workspace', 'A'], ['team-member-insights', 'team', 'coach', 'A'], ['team-metric-share', 'team', 'A']];
    for (const key of keys) client.setQueryData(key, 'private');
    await clearPersonalModeCache(client, 'A');
    for (const key of keys) expect(client.getQueryData(key)).toBeUndefined();
  });
  it('removes mode-dependent Home, brief and QR state rather than retaining invalidated content', async () => {
    const client = new QueryClient();
    for (const key of ['personal-home', 'daily-brief-personal', 'host-checkin-events', 'followups']) client.setQueryData([key, 'ZZ-TEST-A'], { private: 'A' });
    client.setQueryData(['personal-home', 'ZZ-TEST-B'], { private: 'B' });
    await clearPersonalModeCache(client, 'ZZ-TEST-A');
    for (const key of ['personal-home', 'daily-brief-personal', 'host-checkin-events', 'followups']) expect(client.getQueryData([key, 'ZZ-TEST-A'])).toBeUndefined();
    expect(client.getQueryData(['personal-home', 'ZZ-TEST-B'])).toEqual({ private: 'B' });
  });
  it('synchronously clears both accounts before identity transition cancellation resolves', async () => {
    const client = new QueryClient(); client.setQueryData(['personal-home', 'A'], 'private'); client.setQueryData(['personal-home', 'B'], 'private');
    const pending = clearIdentityCache(client);
    expect(client.getQueryCache().getAll()).toHaveLength(0);
    await pending;
  });
  it('cancelled late responses cannot repopulate another account cache', async () => {
    const client = new QueryClient(); let resolve: ((value: string) => void) | undefined;
    const request = client.fetchQuery({ queryKey: ['personal-home', 'A'], queryFn: () => new Promise<string>(done => { resolve = done; }) }).catch(() => undefined);
    await clearIdentityCache(client); resolve?.('A private'); await request;
    client.setQueryData(['personal-home', 'B'], 'B only');
    expect(client.getQueryData(['personal-home', 'A'])).toBeUndefined(); expect(client.getQueryData(['personal-home', 'B'])).toBe('B only');
  });
});