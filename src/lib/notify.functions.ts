import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

// Signed-in: which channels are connected, plus the public push key.
export const getChannelStatus = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { channelStatus } = await import('@/lib/notify/channels.server');
    return { ...channelStatus(), pushKey: process.env['VAPID_PUBLIC_KEY'] ?? null };
  });
