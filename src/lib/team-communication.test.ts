import { describe, expect, it } from 'vitest';
import { channelKey, directChannelEligible, orderAnnouncements, safeChatUrl, textLinks, type Announcement } from './team-communication';
describe('Private team communication rules', () => {
  it('accepts safe links without enabling HTML or executable schemes', () => {
    expect(safeChatUrl('https://example.org/path')).toBe('https://example.org/path');
    for (const value of ['javascript:alert(1)', 'data:text/html,test', '//example.org', 'https://user:pass@example.org', 'https://example.org\\evil', 'https://example.org\n']) expect(safeChatUrl(value)).toBeNull();
    expect(textLinks('<script>bad()</script> https://example.org')[0]?.href).toBeNull();
    expect(textLinks('Visit https://example.org')[1]?.href).toBe('https://example.org/');
  });
  it('keeps pinned first and newer unpinned visible in predictable order', () => {
    const row = (id: string, pinned: boolean, created_at: string) => ({ id, pinned, created_at }) as Announcement;
    expect(orderAnnouncements([row('old', false, '2026-01-01'), row('new', false, '2026-02-01'), row('pin', true, '2025-01-01')]).map(x => x.id)).toEqual(['pin', 'new', 'old']);
  });
  it('does not treat a pending, removed, declined or expired invitation as active membership', () => {
    for (const role of ['pending','declined','removed','expired',null,'admin']) expect(directChannelEligible(false, role, false)).toBe(false);
    expect(directChannelEligible(false, 'member', false)).toBe(true);
    expect(directChannelEligible(true, null, false)).toBe(true);
    expect(directChannelEligible(true, 'leader', true)).toBe(false);
  });
  it('separates both team and viewer cache identities', () => {
    expect(channelKey('team-a','member')).not.toEqual(channelKey('team-b','member'));
    expect(channelKey('team-a','member')).not.toEqual(channelKey('team-a','outsider'));
  });
});