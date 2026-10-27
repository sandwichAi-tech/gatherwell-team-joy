import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import type { PersonalHome } from './personal-home';

/** No client identity or scope input: the database uses auth.uid() and saved display mode. */
export const getPersonalHome = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc('personal_home');
    if (error) throw new Error('personal_home_unavailable');
    return data as unknown as PersonalHome;
  });