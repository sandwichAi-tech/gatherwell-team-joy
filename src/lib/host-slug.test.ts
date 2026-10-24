import { describe, expect, it } from 'vitest';
import { normalizeProfileSlug, validateProfileSlug, slugErrorKey, RESERVED_PROFILE_SLUGS } from './host-slug';

describe('normalizeProfileSlug', () => {
  it('lowercases and hyphenates', () => {
    expect(normalizeProfileSlug('Maria Lopez')).toBe('maria-lopez');
    expect(normalizeProfileSlug('  Yoga  With  Ana  ')).toBe('yoga-with-ana');
  });
  it('folds Spanish accents', () => {
    expect(normalizeProfileSlug('José Niño')).toBe('jose-nino');
    expect(normalizeProfileSlug('Müller')).toBe('muller');
  });
  it('strips punctuation and collapses repeats', () => {
    expect(normalizeProfileSlug('ana--maria!!')).toBe('ana-maria');
    expect(normalizeProfileSlug('--fit--')).toBe('fit');
  });
  it('caps at 40 chars', () => {
    expect(normalizeProfileSlug('a'.repeat(60)).length).toBe(40);
  });
});

describe('validateProfileSlug', () => {
  it('accepts normal slugs', () => {
    expect(validateProfileSlug('maria-lopez')).toBeNull();
    expect(validateProfileSlug('studio42')).toBeNull();
  });
  it('rejects too-short and bad-character slugs', () => {
    expect(validateProfileSlug('ab')).toBe('invalid_slug');
    expect(validateProfileSlug('-abc')).toBe('invalid_slug');
    expect(validateProfileSlug('!!!')).toBe('invalid_slug');
  });
  it('rejects reserved routes and platform words', () => {
    for (const word of ['admin', 'api', 'login', 'discover', 'pricing', 'support', 'h', 't', 'e', 'o', 'me', 'events', 'learn', 'zoheewell']) {
      expect(RESERVED_PROFILE_SLUGS).toContain(word);
      expect(validateProfileSlug(word)).toBe('reserved_slug');
    }
  });
});

describe('slugErrorKey', () => {
  it('maps server errors to copy keys', () => {
    expect(slugErrorKey('reserved_slug')).toBe('reserved');
    expect(slugErrorKey('slug_taken')).toBe('taken');
    expect(slugErrorKey('rate_limited')).toBe('rateLimited');
    expect(slugErrorKey('invalid_slug')).toBe('invalid');
    expect(slugErrorKey('anything else')).toBe('failed');
  });
});
