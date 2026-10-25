import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

/**
 * Shared hosting/attending mode switch — one behavior for the Me page and the account menu.
 * View mode only changes what shows first; permissions come from team roles and event assignments.
 */
export function useSwitchMode(userId: string) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { t } = useTranslation();
  return async (mode: 'host' | 'guest'): Promise<boolean> => {
    const update = mode === 'host' ? { role_intent: 'host', view_mode: 'hosting', onboarded: false } : { role_intent: 'guest', view_mode: 'attending' };
    const { error } = await supabase.from('profiles').update(update).eq('id', userId);
    if (error) { toast.error(t('profile.saveError')); return false; }
    await queryClient.invalidateQueries({ queryKey: ['profile', userId] });
    void navigate({ to: mode === 'host' ? '/onboarding' : '/home' });
    return true;
  };
}
