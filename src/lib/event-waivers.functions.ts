import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

/**
 * Short-lived signed link to an event waiver document. The database resolves the path only for an
 * active waiver on a publicly visible (or invite-unlocked) event, or for the exact version an
 * attendee accepted (by their private RSVP code). Callers never supply or see storage paths.
 */
export const signEventWaiverFile = createServerFn({ method: 'POST' })
  .inputValidator((d: unknown) => z.object({
    waiverId: z.string().uuid(),
    token: z.string().max(200).nullable().optional(),
    code: z.string().max(40).nullable().optional(),
    version: z.number().int().min(1).nullable().optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: path, error } = await supabaseAdmin.rpc('event_waiver_file_path', {
      _waiver: data.waiverId, _token: data.token ?? '', _code: data.code ?? '', _version: data.version ?? (null as unknown as number),
    });
    if (error || typeof path !== 'string' || !path) return { url: null as string | null };
    const { data: signed } = await supabaseAdmin.storage.from('media').createSignedUrl(path, 600);
    return { url: signed?.signedUrl ?? null };
  });
