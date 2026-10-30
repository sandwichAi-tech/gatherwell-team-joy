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

describe('Resources return paths (row 62)', () => {
  it('a signed-out recipe link returns to the recipe after sign-in', () => expect(safeReturnPath('/learn/recipe/6a460379-f28c')).toBe('/learn/recipe/6a460379-f28c'));
  it('a signed-out quiz link returns to the quiz after sign-in', () => expect(safeReturnPath('/learn/quiz/ab12')).toBe('/learn/quiz/ab12'));
  it('still refuses unknown nested learn paths', () => expect(safeReturnPath('/learn/admin/x')).toBeNull());
});

import { safeReturnPath as srp } from './return-to';
describe('public challenge return path', () => {
  it('returns signed-out visitors to the same public challenge after sign-in', () => {
    expect(srp('/c/7a1b2c3d-0000-4000-8000-000000000000')).toBe('/c/7a1b2c3d-0000-4000-8000-000000000000');
    expect(srp('//c/evil')).toBeNull();
  });
});
