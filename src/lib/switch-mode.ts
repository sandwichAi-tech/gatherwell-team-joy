import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { hostEligibilityQuery } from '@/lib/host-eligibility';

/** Profile fields written for a mode change. Eligible hosts return directly; new hosts go through onboarding. */
export function modeUpdate(mode: 'host' | 'guest', eligibleHost: boolean) {
  if (mode === 'guest') return { role_intent: 'guest', view_mode: 'attending' } as const;
  return eligibleHost ? { role_intent: 'host', view_mode: 'hosting' } as const : { role_intent: 'host', view_mode: 'hosting', onboarded: false } as const;
}

/**
 * Shared hosting/attending mode switch — one behavior for the Me page and the account menu.
 * View mode only changes what shows first; permissions come from team roles and event assignments.
 */
export function useSwitchMode(userId: string) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { t } = useTranslation();
  return async (mode: 'host' | 'guest'): Promise<boolean> => {
    let eligible = false;
    if (mode === 'host') {
      try { eligible = await queryClient.fetchQuery({ ...hostEligibilityQuery(userId), staleTime: 0 }); } catch { toast.error(t('profile.saveError')); return false; }
    }
    const { error } = await supabase.from('profiles').update(modeUpdate(mode, eligible)).eq('id', userId);
    if (error) { toast.error(t('profile.saveError')); return false; }
    await Promise.all([queryClient.invalidateQueries({ queryKey: ['profile', userId] }), queryClient.invalidateQueries({ queryKey: ['personal-home', userId] }), queryClient.invalidateQueries({ queryKey: ['daily-brief-personal', userId] })]);
    void navigate({ to: mode === 'host' && !eligible ? '/onboarding' : '/home' });
    return true;
  };
}

/** "Start hosting": switch to host view and go straight to event creation; the builder creates the personal host space if needed. */
export function useStartHosting(userId: string) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { t } = useTranslation();
  return async (): Promise<boolean> => {
    const { error } = await supabase.from('profiles').update({ role_intent: 'host', view_mode: 'hosting' }).eq('id', userId);
    if (error) { toast.error(t('profile.saveError')); return false; }
    await Promise.all([queryClient.invalidateQueries({ queryKey: ['profile', userId] }), queryClient.invalidateQueries({ queryKey: ['personal-home', userId] })]);
    void navigate({ to: '/gathering/new' });
    return true;
  };
}
