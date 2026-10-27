import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { validAddonImagePath } from './addon-images';
import type { ChallengeAddon } from './challenge-templates';

export const challengeAddonImages = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: c, error } = await context.supabase.from('challenges').select('addons').eq('id', data.id).maybeSingle();
    if (error || !c) throw new Error('not_allowed');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    return Promise.all((c.addons as unknown as ChallengeAddon[]).map(async ({ image_path, ...a }) => {
      const signed = image_path && validAddonImagePath(image_path) ? await supabaseAdmin.storage.from('media').createSignedUrl(image_path, 600) : null;
      return { ...a, image: signed?.data?.signedUrl ?? null };
    }));
  });