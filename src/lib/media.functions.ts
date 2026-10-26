import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

/**
 * Signs renditions of an event cover for a signed-in viewer who cannot sign another host's
 * private media directly. The path is read through the caller's own RLS (so only events they
 * may already see), never accepted from the client.
 */
export const eventCoverRendition = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase.from('events').select('cover_url').eq('id', data.id).maybeSingle();
    const path = row?.cover_url;
    if (error || !path) return null;
    const { signRendition } = await import('@/lib/media-renditions');
    if (/^https:/.test(path)) return { src: path };
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    return signRendition(supabaseAdmin.storage.from('media'), path, 3600);
  });
