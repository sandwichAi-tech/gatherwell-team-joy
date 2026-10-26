import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

/** Signs only the cover published on this public host; never accepts a storage path. */
export const publicHostCover = createServerFn({ method: 'GET' })
  .inputValidator((data: unknown) => z.object({ slug: z.string().min(1).max(160) }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: host, error } = await supabaseAdmin.rpc('get_public_host', { _slug: data.slug });
    if (error || !host || typeof host !== 'object' || Array.isArray(host)) return null;
    const id = host['id'];
    const path = host['cover_url'];
    if (typeof id !== 'string' || typeof path !== 'string' || !path.startsWith(`${id}/cover-`)) return null;
    const { signRendition } = await import('@/lib/media-renditions');
    return signRendition(supabaseAdmin.storage.from('media'), path, 3600);
  });

/** Signs only the cover of a published public/unlisted offer; never accepts a storage path. */
export const publicOfferCover = createServerFn({ method: 'GET' })
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: offer, error } = await supabaseAdmin.rpc('get_public_offer', { _id: data.id });
    if (error || !offer || typeof offer !== 'object' || Array.isArray(offer)) return null;
    const hostId = offer['host_id'];
    const path = offer['cover_url'];
    if (typeof hostId !== 'string' || typeof path !== 'string' || !path.startsWith(`${hostId}/`)) return null;
    const { signRendition } = await import('@/lib/media-renditions');
    return signRendition(supabaseAdmin.storage.from('media'), path, 3600);
  });