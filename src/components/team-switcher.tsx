import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { setActiveTeam, teamsQuery, workspaceQuery } from '@/lib/account';

export function useSwitchTeam(userId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return async (teamId: string) => {
    try {
      await setActiveTeam(userId, teamId);
      await queryClient.invalidateQueries({ queryKey: ['profile', userId] });
      await queryClient.invalidateQueries({ queryKey: ['workspace', userId] });
    } catch { toast.error(t('profile.saveError')); }
  };
}

/** Compact switcher; renders nothing for people in a single team. */
export function TeamSwitcher({ userId, className = '' }: { userId: string; className?: string }) {
  const { t } = useTranslation();
  const { data: teams = [] } = useQuery(teamsQuery(userId));
  const { data: active } = useQuery(workspaceQuery(userId));
  const switchTeam = useSwitchTeam(userId);
  if (!active || (teams.length < 2 && !active.inherited)) return null;
  return <Select value={active.teamId} onValueChange={switchTeam}>
    <SelectTrigger className={`team-switcher ${className}`} aria-label={t('profile.switchTeam')}><SelectValue /></SelectTrigger>
    <SelectContent>{(teams.some(team => team.teamId === active.teamId) ? teams : [...teams, active]).map(team => <SelectItem key={team.teamId} value={team.teamId}>{team.name} · {t(`roles.${team.role}`)}</SelectItem>)}</SelectContent>
  </Select>;
}
