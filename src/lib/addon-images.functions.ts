import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { ownAddonImagePath, publicAddon, validAddonImagePath } from '@/lib/addon-images';
import type { Addon } from '@/lib/event-builder';

const input = z.object({ id: z.string().uuid(), token: z.string().max(200).nullable().optional() });

/** Resolve guest visibility first; paths are loaded from the authorized event, not supplied by callers. */
export const publicEventAddons = createServerFn({ method: 'GET' })
  .inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ data }) => {
    const url = process.env['SUPABASE_URL']; const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
    if (!url || !key) throw new Error('media_unavailable');
    const { createClient } = await import('@supabase/supabase-js');
    const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (i, init) => {
      const h = new Headers(init?.headers); if (key.startsWith('sb_') && h.get('Authorization') === `Bearer ${key}`) h.delete('Authorization'); h.set('apikey', key); return fetch(i, { ...init, headers: h });
    } } });
    const { data: visible, error } = await sb.rpc('get_public_event_k', { _id: data.id, _token: data.token ?? null });
    if (error || !visible) return [];
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: row, error: readError } = await supabaseAdmin.from('events').select('addons').eq('id', data.id).maybeSingle();
    if (readError) throw new Error('media_unavailable');
    const addons = (Array.isArray(row?.addons) ? row.addons : []) as Addon[];
    return Promise.all(addons.map(async a => {
      const p = a.image_path;
      const signed = p && validAddonImagePath(p) ? await supabaseAdmin.storage.from('media').createSignedUrl(p, 3600) : null;
      return publicAddon(a, signed?.data?.signedUrl ?? null);
    }));
  });

export const eventAddonImages = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase.from('events').select('addons').eq('id', data.id).maybeSingle();
    if (error || !row) return [];
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    return Promise.all((Array.isArray(row.addons) ? row.addons as Addon[] : []).map(async a => {
      const signed = a.image_path && validAddonImagePath(a.image_path) ? await supabaseAdmin.storage.from('media').createSignedUrl(a.image_path, 3600) : null;
      return publicAddon(a, signed?.data?.signedUrl ?? null);
    }));
  });

/** Only uploader-owned add-on files, and only when no saved event or draft references them. */
export const cleanupAddonImages = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ paths: z.array(z.string()).max(32) }).parse(d))
  .handler(async ({ data, context }) => {
    const paths = data.paths.filter(p => ownAddonImagePath(p, context.userId));
    if (!paths.length) return;
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    for (const p of paths) {
      const [events, drafts] = await Promise.all([
        supabaseAdmin.from('events').select('id').contains('addons', [{ image_path: p }]).limit(1),
        supabaseAdmin.from('event_builder_drafts').select('event_id,events!inner(status)').eq('events.status', 'draft').contains('snapshot', { details: { addons: [{ image_path: p }] } }).limit(1),
      ]);
      if (!events.error && !drafts.error && !events.data?.length && !drafts.data?.length) await context.supabase.storage.from('media').remove([p]);
    }
  });