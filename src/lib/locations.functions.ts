import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

/** Signs only the photos published on this public location; never accepts a storage path from the caller. */
export const publicLocationPhotos = createServerFn({ method: 'GET' })
  .inputValidator((data: unknown) => z.object({ slug: z.string().min(3).max(81) }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: loc } = await supabaseAdmin.from('locations').select('host_id, photos').eq('slug', data.slug.toLowerCase()).maybeSingle();
    if (!loc) return [] as string[];
    const paths = (loc.photos ?? []).filter(p => p.startsWith(`${loc.host_id}/location-`)).slice(0, 6);
    if (!paths.length) return [] as string[];
    const { data: signed } = await supabaseAdmin.storage.from('media').createSignedUrls(paths, 3600);
    return (signed ?? []).map(s => s.signedUrl).filter((u): u is string => !!u);
  });
