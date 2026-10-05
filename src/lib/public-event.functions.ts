import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import shareImage from '@/assets/gatherwell-share.jpg';
import { getRequest } from '@tanstack/react-start/server';

/** Public link-preview data for /e/:id (no contact details), plus a static map URL when the maps key exists. */
export const getPublicEventMeta = createServerFn({ method: 'GET' })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { createClient } = await import('@supabase/supabase-js');
    const url = process.env['SUPABASE_URL']; const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
    if (!url || !key) return null;
    const sb = createClient(url, key, { auth: { storage: undefined, persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => {
      const h = new Headers(init?.headers); if (key.startsWith('sb_') && h.get('Authorization') === `Bearer ${key}`) h.delete('Authorization'); h.set('apikey', key); return fetch(input, { ...init, headers: h });
    } } });
    const { data: ev } = await sb.rpc('get_public_event', { _id: data.id });
    const e = ev as null | { title: string; starts_at: string; timezone: string; cover_url: string | null; location_name: string | null; address: string | null; lat: number | null; lng: number | null; status: string };
    if (!e) return null;
    let image: string | null = null;
    if (e.cover_url) {
      if (/^https:/.test(e.cover_url)) image = e.cover_url;
      else {
        try {
          const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
          const { data: signed } = await supabaseAdmin.storage.from('media').createSignedUrl(e.cover_url, 60 * 60 * 24 * 7);
          image = signed?.signedUrl ?? null;
        } catch { image = null; }
      }
    }
    const mapsKey = process.env['GOOGLE_MAPS_API_KEY'] ?? '';
    const where = e.lat != null && e.lng != null ? `${e.lat},${e.lng}` : (e.address || e.location_name || '');
    const staticMap = mapsKey && where
      ? `https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(where)}&zoom=15&size=640x260&scale=2&markers=color:0x2F2340%7C${encodeURIComponent(where)}&key=${mapsKey}`
      : null;
    return { title: e.title, startsAt: e.starts_at, timezone: e.timezone, image: image ?? new URL(shareImage, getRequest().url).href, staticMap, cancelled: e.status === 'cancelled' };
  });
