type ResourcePage = Record<string, any> & { coverUrl: string | null; content: Record<string, any>[]; fileUrl: string | null };

export async function readResource(client: import('@supabase/supabase-js').SupabaseClient, kind: string, id: string): Promise<ResourcePage | null> {
  const { data, error } = await client.rpc('get_resource_page', { _kind: kind, _id: id });
  if (error) throw new Error('resource_unavailable');
  if (!data) return null;
  const row = data as Record<string, any>;
  // The caller's RPC resolves visibility and entitlement before privileged signing.
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const sign = async (bucket: string, path: unknown) => typeof path === 'string' ? (await supabaseAdmin.storage.from(bucket).createSignedUrl(path, 600)).data?.signedUrl ?? null : null;
  const cover = await sign(kind === 'offer' || kind === 'quiz' ? 'media' : 'learn-media', row['cover_path']);
  const content = await Promise.all((Array.isArray(row['content']) ? row['content'] : []).map(async (l: Record<string, any>) => {
    const { storage_path, ...safe } = l;
    return { ...safe, fileUrl: row['access'] ? await sign('learn-media', storage_path) : null };
  }));
  const { cover_path, file_path, ...safe } = row;
  return { ...safe, coverUrl: cover, content, fileUrl: row['access'] ? await sign('offer-files', file_path) : null };
}

