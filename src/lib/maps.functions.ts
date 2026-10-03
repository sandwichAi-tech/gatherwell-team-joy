import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

/**
 * Browser map key for signed-in users. Maps keys are meant for browsers (restrict them by site address).
 * When the secret is missing we return null and the app shows its "not connected yet" preview.
 */
export const getMapsConfig = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const key = process.env['GOOGLE_MAPS_API_KEY'] ?? '';
    if (!key) console.info('[maps] GOOGLE_MAPS_API_KEY missing — serving map preview mock');
    return { key: key || null };
  });
