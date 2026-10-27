import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';

const input = (v: unknown) => z.object({ kind: z.enum(['track', 'recipe', 'quiz', 'offer']), id: z.string().uuid() }).parse(v);

export const publicResourcePage = createServerFn({ method: 'GET' }).inputValidator(input).handler(async ({ data }) => {
  const { createClient } = await import('@supabase/supabase-js');
  const key = process.env['SUPABASE_PUBLISHABLE_KEY'] ?? '';
  const url = process.env['SUPABASE_URL'];
  if (!key || !url) throw new Error('resource_unavailable');
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => {
    const h = new Headers(init?.headers); if (key.startsWith('sb_') && h.get('Authorization') === `Bearer ${key}`) h.delete('Authorization'); h.set('apikey', key); return fetch(input, { ...init, headers: h });
  } } });
  const { data: visible, error } = await client.rpc('public_resource_metadata', { _kind: data.kind, _id: data.id });
  if (error) throw new Error('resource_unavailable');
  if (!visible) return null;
  // Only an anonymous-visible resource can proceed to privileged path resolution/signing.
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { readResource } = await import('./resource-page.server');
  return readResource(supabaseAdmin, data.kind, data.id);
});

export const myResourcePage = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).inputValidator(input).handler(async ({ data, context }) => { const { readResource } = await import('./resource-page.server'); return readResource(context.supabase, data.kind, data.id); });