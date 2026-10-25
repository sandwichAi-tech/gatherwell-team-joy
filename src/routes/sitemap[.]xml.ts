import { createFileRoute } from '@tanstack/react-router';
import { SITE_URL } from '@/lib/seo';

// Canonical public indexable routes only. Auth, token/code, account, admin, and
// filtered-permutation URLs are excluded by policy (see docs/SEO-AEO-AUDIT.md).
// No lastmod entries: there is no authoritative page-specific content timestamp.
const PATHS = ['/', '/discover', '/pricing', '/faq', '/hosts', '/studios', '/about', '/careers', '/terms', '/privacy', '/credits', '/legal/host', '/legal/guest', '/legal/sms', '/legal/cookies'];

export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: async () => {
        const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${PATHS.map(p => `<url><loc>${SITE_URL}${p}</loc></url>`).join('')}</urlset>`;
        return new Response(body, { headers: { 'content-type': 'application/xml', 'cache-control': 'public, max-age=3600' } });
      },
    },
  },
});
