/**
 * Site-wide SEO/AEO policy helpers.
 *
 * Indexability policy (see docs/SEO-AEO-AUDIT.md):
 * - Indexable: public marketing/discovery routes and published public detail
 *   pages (/, /discover unfiltered, /pricing, /faq, /hosts, /studios, /terms,
 *   /privacy, /credits, /legal/*, /e/:id, /h/:slug, /l/:slug, /t/:slug,
 *   /o/:id, /verify/:number).
 * - noindex: auth/onboarding, token/code routes, account/team/admin/creator
 *   tools, saved/private content, filtered Discover permutations, error states.
 *
 * The canonical base is the production domain only — never a preview URL.
 */

export const SITE_URL = 'https://zoheewell.com';

/** Absolute canonical URL for a public path (path must start with '/'). */
export function canonicalUrl(path: string): string {
  return `${SITE_URL}${path === '/' ? '/' : path}`;
}

/** robots meta entry that keeps a route out of search indexes. */
export const NOINDEX_META = { name: 'robots', content: 'noindex, nofollow' } as const;

/** Canonical + og:url pair for an indexable public route. */
export function publicIndexing(path: string) {
  const url = canonicalUrl(path);
  return {
    meta: [{ property: 'og:url', content: url }],
    links: [{ rel: 'canonical', href: url }],
  };
}
