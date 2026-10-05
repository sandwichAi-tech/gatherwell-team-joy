import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import shareImage from '@/assets/gatherwell-share.jpg';
import { getRequest } from '@tanstack/react-start/server';

/** Only public marketing slots; no profile or team content crosses this boundary. */
export const publicShareImage = createServerFn({ method: 'GET' })
  .inputValidator((d: unknown) => z.object({ slot: z.enum(['hero_card_1', 'og_share_image']) }).parse(d))
  .handler(async ({ data }) => {
    const fallback = new URL(shareImage, getRequest().url).href;
    const key = process.env['SUPABASE_PUBLISHABLE_KEY']; const url = process.env['SUPABASE_URL'];
    if (!key || !url) return fallback;
    const { createClient } = await import('@supabase/supabase-js');
    const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => {
      const h = new Headers(init?.headers); if (key.startsWith('sb_') && h.get('Authorization') === `Bearer ${key}`) h.delete('Authorization'); h.set('apikey', key); return fetch(input, { ...init, headers: h });
    } } });
    const { data: row } = await sb.from('site_media').select('image_path,default_url').eq('slot', data.slot).maybeSingle();
    if (!row) return fallback;
    if (row.image_path) { const { data: signed } = await sb.storage.from('site-media').createSignedUrl(row.image_path, 604800); return signed?.signedUrl ?? fallback; }
    return fallback;
  });