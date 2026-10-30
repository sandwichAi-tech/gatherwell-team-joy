import { createFileRoute } from '@tanstack/react-router';
import { SITE_URL } from '@/lib/seo';

// Canonical public indexable routes only. Auth, token/code, account, admin, and
// filtered-permutation URLs are excluded by policy (see docs/SEO-AEO-AUDIT.md).
// No lastmod entries: there is no authoritative page-specific content timestamp.
const PATHS = ['/', '/discover', '/pricing', '/faq', '/hosts', '/studios', '/about', '/careers', '/terms', '/privacy', '/credits', '/legal', '/legal/host', '/legal/guest', '/legal/sms', '/legal/cookies'];

export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: async () => {
        // Launch mode: Careers/Studios stay out of the sitemap while feature_marketing_extra is off.
        let extraOn = false;
        try {
          const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
          const r = await fetch(`${process.env['SUPABASE_URL']}/rest/v1/feature_flags?key=eq.feature_marketing_extra&select=enabled`, { headers: { apikey: key ?? '' } });
          extraOn = r.ok && ((await r.json()) as { enabled: boolean }[])[0]?.enabled === true;
        } catch { extraOn = false; }
        const paths = PATHS.filter(p => extraOn || (p !== '/careers' && p !== '/studios'));
        const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map(p => `<url><loc>${SITE_URL}${p}</loc></url>`).join('')}</urlset>`;
        return new Response(body, { headers: { 'content-type': 'application/xml', 'cache-control': 'public, max-age=3600' } });
      },
    },
  },
});
