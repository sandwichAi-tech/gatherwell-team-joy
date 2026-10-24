import { describe, expect, it } from 'vitest';
import { hostProfileReadiness, validHostLink } from '@/components/host-profile';

describe('validHostLink', () => {
  it('accepts https website links', () => {
    expect(validHostLink({ label: 'Site', url: 'https://example.com/about', kind: 'website' })).toBe(true);
  });
  it('rejects non-https links', () => {
    expect(validHostLink({ label: 'Site', url: 'http://example.com', kind: 'website' })).toBe(false);
    expect(validHostLink({ label: 'x', url: 'javascript:alert(1)', kind: 'website' })).toBe(false);
  });
  it('restricts social links to the platform allowlist', () => {
    expect(validHostLink({ label: 'IG', url: 'https://instagram.com/yoga', kind: 'social' })).toBe(true);
    expect(validHostLink({ label: 'IG', url: 'https://www.instagram.com/yoga', kind: 'social' })).toBe(true);
    expect(validHostLink({ label: 'Bad', url: 'https://evil.example.com', kind: 'social' })).toBe(false);
  });
  it('rejects overlong labels and urls', () => {
    expect(validHostLink({ label: 'x'.repeat(41), url: 'https://example.com', kind: 'website' })).toBe(false);
    expect(validHostLink({ label: 'ok', url: `https://example.com/${'a'.repeat(300)}`, kind: 'website' })).toBe(false);
  });
});

describe('hostProfileReadiness', () => {
  it('reports each missing basic truthfully', () => {
    const r = hostProfileReadiness({ full_name: null, bio: null, avatar_url: null, host_categories: null, host_languages: null });
    expect(r.every(x => !x.done)).toBe(true);
    expect(r.map(x => x.key)).toEqual(['name', 'bio', 'photo', 'categories', 'languages']);
  });
  it('marks filled fields done', () => {
    const r = hostProfileReadiness({ full_name: 'Ana', bio: 'Yoga teacher', avatar_url: 'a/b.jpg', host_categories: ['Yoga'], host_languages: ['en', 'es'] });
    expect(r.every(x => x.done)).toBe(true);
  });
});
