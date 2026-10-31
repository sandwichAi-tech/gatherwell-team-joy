import { expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
const state = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('./personal-home.functions', () => ({ getPersonalHome: state.fetch }));
import { personalHomeQuery } from './personal-home-query';
it('never caches a server response authenticated as B beneath account A', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  state.fetch.mockResolvedValue({ caller_id: 'ZZ-TEST-B', mode: 'hosting', events: [{ id: 'B-private' }] });
  await expect(client.fetchQuery(personalHomeQuery('ZZ-TEST-A'))).rejects.toThrow('personal_home_identity_changed');
  expect(client.getQueryData(['personal-home', 'ZZ-TEST-A'])).toBeUndefined();
});
it('accepts matching authenticated caller and keeps distinct user keys', async () => {
  const client = new QueryClient();
  state.fetch.mockResolvedValue({ caller_id: 'ZZ-TEST-A', mode: 'attending', events: [] });
  expect((await client.fetchQuery(personalHomeQuery('ZZ-TEST-A'))).caller_id).toBe('ZZ-TEST-A');
  expect(client.getQueryData(['personal-home', 'ZZ-TEST-B'])).toBeUndefined();
});