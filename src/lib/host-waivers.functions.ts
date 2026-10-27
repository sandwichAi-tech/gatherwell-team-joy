import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';
import { safeWaiverPdf } from '@/lib/event-agreements';
export const uploadHostWaiver = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((d: FormData) => d).handler(async ({ data, context }) => {
  const f = data.get('file');
  if (!(f instanceof File) || !safeWaiverPdf(f.size, f.type, await f.slice(0, 5).text())) throw new Error('invalid_file');
  const { data: workspace, error: accessError } = await context.supabase.rpc('my_workspace');
  if (accessError || !workspace) throw new Error('forbidden');
  const path = `${context.userId}/host-waivers/${crypto.randomUUID()}.pdf`;
  const { error } = await context.supabase.storage.from('media').upload(path, f, { contentType: 'application/pdf', upsert: false });
  if (error) throw new Error('upload_failed'); return { path };
});
export const signHostWaiver = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((d: unknown) => z.object({ id: z.string().uuid(), version: z.number().int().positive() }).parse(d)).handler(async ({ data, context }) => {
  const { data: owner } = await context.supabase.from('waiver_library').select('id').eq('id', data.id).eq('owner_id', context.userId).maybeSingle();
  if (!owner) return { url: null };
  const { data: v } = await context.supabase.from('waiver_library_versions').select('file_path').eq('waiver_id', data.id).eq('version', data.version).maybeSingle();
  if (!v?.file_path) return { url: null };
  const { data: signed } = await context.supabase.storage.from('media').createSignedUrl(v.file_path, 300); return { url: signed?.signedUrl ?? null };
});