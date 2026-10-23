import { describe, expect, it } from 'vitest';
import { returnPathOr, safeReturnPath } from './return-to';

describe('safeReturnPath', () => {
  it.each(['/e/abc-123', '/l/my-course', '/t/team-slug', '/offer/0b2c', '/join/ABC123', '/learn/track/x1', '/home', '/gathering/new', '/e/abc?k=tok_1'])('allows %s', p => expect(safeReturnPath(p)).toBe(p));
  it.each([
    'https://evil.com', '//evil.com', '/\\evil.com', 'javascript:alert(1)', '/e/abc%0d%0a', '/e/../admin', '/admin', '/admin-login',
    '/e/abc#x', 'e/abc', '', '/e/' + 'a'.repeat(600), '/e/a b', '/e/\u0000x', '/home/', '/api/public/x', '/login?next=//evil.com',
  ])('rejects %s', p => expect(safeReturnPath(p)).toBeNull());
  it('rejects non-strings and falls back to home', () => {
    expect(safeReturnPath(42)).toBeNull();
    expect(returnPathOr({ p: '/e/x' })).toBe('/home');
    expect(returnPathOr('//evil.com', '/discover')).toBe('/discover');
  });
});
