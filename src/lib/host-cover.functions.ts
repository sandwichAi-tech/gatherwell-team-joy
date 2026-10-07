import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

/** Signs only the cover published on this public host; never accepts a storage path. */
export const publicHostCover = createServerFn({ method: 'GET' })
  .inputValidator((data: unknown) => z.object({ slug: z.string().min(1).max(160) }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: host, error } = await supabaseAdmin.rpc('get_public_host', { _slug: data.slug });
    if (error || !host || typeof host !== 'object' || Array.isArray(host)) return null;
    const id = host.id;
    const path = host.cover_url;
    if (typeof id !== 'string' || typeof path !== 'string' || !path.startsWith(`${id}/cover-`)) return null;
    const { data: signed } = await supabaseAdmin.storage.from('media').createSignedUrl(path, 3600);
    return signed?.signedUrl ?? null;
  });