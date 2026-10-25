import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

/**
 * Batch-signs cover/avatar images for public Discover cards. The SQL validator
 * (public_cover_paths) re-checks that every ref is a published, public item or a
 * published host profile, so caller-supplied storage paths are never signed.
 */
export const publicCovers = createServerFn({ method: 'GET' })
  .inputValidator((data: unknown) => z.object({
    refs: z.array(z.object({ kind: z.enum(['event', 'offer', 'host']), id: z.string().uuid() })).max(60),
  }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: rows, error } = await supabaseAdmin.rpc('public_cover_paths', { _refs: data.refs });
    if (error || !Array.isArray(rows)) return {} as Record<string, string>;
    const out: Record<string, string> = {};
    await Promise.all((rows as { key?: unknown; path?: unknown }[]).map(async (row) => {
      const key = row?.key;
      const path = row?.path;
      if (typeof key !== 'string' || typeof path !== 'string' || !path) return;
      if (/^https:/.test(path)) { out[key] = path; return; }
      const { data: signed } = await supabaseAdmin.storage.from('media').createSignedUrl(path, 3600);
      if (signed?.signedUrl) out[key] = signed.signedUrl;
    }));
    return out;
  });
