import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { SITE_URL, canonicalUrl, publicIndexing, NOINDEX_META } from './seo';

describe('SEO policy helpers', () => {
  it('canonical base is the production domain, never a preview URL', () => {
    expect(SITE_URL).toBe('https://zoheewell.com');
    expect(SITE_URL).not.toContain('lovable.app');
  });

  it('canonicalUrl builds absolute self-referencing URLs', () => {
    expect(canonicalUrl('/')).toBe('https://zoheewell.com/');
    expect(canonicalUrl('/discover')).toBe('https://zoheewell.com/discover');
    expect(canonicalUrl('/e/abc-123')).toBe('https://zoheewell.com/e/abc-123');
  });

  it('publicIndexing returns a matching canonical link and og:url', () => {
    const { meta, links } = publicIndexing('/pricing');
    expect(links).toEqual([{ rel: 'canonical', href: 'https://zoheewell.com/pricing' }]);
    expect(meta).toEqual([{ property: 'og:url', content: 'https://zoheewell.com/pricing' }]);
  });

  it('noindex meta blocks indexing and following', () => {
    expect(NOINDEX_META).toEqual({ name: 'robots', content: 'noindex, nofollow' });
  });
});

describe('robots.txt', () => {
  const robots = readFileSync('public/robots.txt', 'utf8');

  it('points the sitemap at the production domain', () => {
    expect(robots).toContain('Sitemap: https://zoheewell.com/sitemap.xml');
    expect(robots).not.toContain('lovable.app');
  });

  it('allows crawling by default and blocks private/auth surfaces', () => {
    expect(robots).toContain('Allow: /');
    for (const path of ['/login', '/admin', '/onboarding', '/me', '/plan', '/learn', '/team', '/events', '/api/', '/unsubscribe/', '/r/', '/i/', '/join/', '/tools', '/communications', '/support', '/saved', '/ticket/']) {
      expect(robots).toContain(`Disallow: ${path}`);
    }
  });

  it('does not block public discovery surfaces', () => {
    for (const path of ['/discover', '/pricing', '/faq', '/hosts', '/studios', '/e/', '/h/', '/t/', '/l/']) {
      expect(robots).not.toContain(`Disallow: ${path}`);
    }
  });
});

describe('sitemap route', () => {
  const source = readFileSync('src/routes/sitemap[.]xml.ts', 'utf8');

  it('uses the production domain via SITE_URL', () => {
    expect(source).toContain("from '@/lib/seo'");
    expect(source).not.toContain('lovable.app');
  });

  it('includes only canonical public routes — no auth or token pages', () => {
    expect(source).toContain("'/discover'");
    expect(source).toContain("'/faq'");
    expect(source).toContain("'/hosts'");
    expect(source).toContain("'/studios'");
    expect(source).not.toContain("'/login'");
    expect(source).not.toContain("'/join'");
    expect(source).not.toContain("'/admin'");
  });

  it('omits lastmod (no authoritative page-specific timestamps)', () => {
    expect(source).not.toContain('lastmod');
  });
});
