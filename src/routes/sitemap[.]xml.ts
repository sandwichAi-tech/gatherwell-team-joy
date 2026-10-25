import { createFileRoute } from '@tanstack/react-router';

const BASE = 'https://gatherwell-team-joy.lovable.app';
const PATHS = ['/', '/discover', '/pricing', '/faq', '/login', '/terms', '/privacy', '/credits', '/legal/host', '/legal/guest', '/legal/sms', '/legal/cookies'];

export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: async () => {
        const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${PATHS.map(p => `<url><loc>${BASE}${p}</loc></url>`).join('')}</urlset>`;
        return new Response(body, { headers: { 'content-type': 'application/xml', 'cache-control': 'public, max-age=3600' } });
      },
    },
  },
});
