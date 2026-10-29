import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { eventPhotoSlot, displayTitleCase } from '@/lib/event-presentation';
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
    const e = ev as null | { category?: string | null; title: string; starts_at: string; timezone: string; cover_url: string | null; location_name: string | null; address: string | null; lat: number | null; lng: number | null; status: string; is_online?: boolean; host?: { name?: string | null } | null };
    if (!e) return null;
    const { data: pr } = await sb.rpc('event_price', { _id: data.id });
    const priceCents = (pr as { price_cents?: number } | null)?.price_cents ?? null;
    let image: string | null = null;
    let cover: import('@/lib/media-renditions').Rendition | null = null;
    if (e.cover_url) {
      if (/^https:/.test(e.cover_url)) { image = e.cover_url; cover = { src: e.cover_url }; }
      else {
        try {
          const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
          const { signRendition } = await import('@/lib/media-renditions');
          // Path comes from the published event resolved by id, never from the caller.
          cover = await signRendition(supabaseAdmin.storage.from('media'), e.cover_url, 60 * 60 * 24 * 7);
          image = cover?.src ?? null;
        } catch { image = null; }
      }
    }
    if (!cover) {
      const { data: photos } = await sb.from('site_media').select('slot,image_path,default_url').in('slot', [eventPhotoSlot(e.category), 'hero_card_1']);
      const row = photos?.find(p => p.slot === eventPhotoSlot(e.category) && (p.image_path || p.default_url)) ?? photos?.find(p => p.slot === 'hero_card_1');
      if (row?.image_path) {
        const { data: signed } = await sb.storage.from('site-media').createSignedUrl(row.image_path, 60 * 60 * 24 * 7);
        image = signed?.signedUrl ?? null;
      } else if (row?.default_url) image = new URL(row.default_url, getRequest().url).href;
      if (image) cover = { src: image };
    }
    const mapsKey = process.env['GOOGLE_MAPS_API_KEY'] ?? '';
    const where = e.lat != null && e.lng != null ? `${e.lat},${e.lng}` : (e.address || e.location_name || '');
    const staticMap = mapsKey && where
      ? `https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(where)}&zoom=15&size=640x260&scale=2&markers=color:0x2F2340%7C${encodeURIComponent(where)}&key=${mapsKey}`
      : null;
    return { cover, title: e.title, startsAt: e.starts_at, timezone: e.timezone, image, staticMap, cancelled: e.status === 'cancelled', host: displayTitleCase(e.host?.name), place: e.location_name || null, online: !!e.is_online, priceCents };
  });
