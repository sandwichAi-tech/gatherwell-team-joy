import { describe, expect, it } from 'vitest';
import { splitAppLink, validTopicId } from './app-link';

describe('splitAppLink', () => {
  it('splits a team discussion link into path and search', () => {
    expect(splitAppLink('/team?topic=5e5f1b85-0a3e-48bd-92c3-63a7a2c12455')).toEqual({ to: '/team', search: { topic: '5e5f1b85-0a3e-48bd-92c3-63a7a2c12455' } });
  });
  it('keeps plain paths unchanged', () => {
    expect(splitAppLink('/event/abc')).toEqual({ to: '/event/abc', search: {} });
  });
  it('refuses external and protocol-relative links', () => {
    expect(splitAppLink('https://evil.test/team')).toBeNull();
    expect(splitAppLink('//evil.test/team')).toBeNull();
    expect(splitAppLink(null)).toBeNull();
  });
});

describe('validTopicId', () => {
  it('accepts only well-formed ids', () => {
    expect(validTopicId('5E5F1B85-0A3E-48BD-92C3-63A7A2C12455')).toBe('5e5f1b85-0a3e-48bd-92c3-63a7a2c12455');
    expect(validTopicId('nope')).toBeUndefined();
    expect(validTopicId(undefined)).toBeUndefined();
  });
});
