import { roleAllows } from './workspace';
import type { WorkspaceRole } from '@/components/workspace-settings';

/** Navigation only: own-host and team analytics retain their separate server scopes. */
export function showInsightsNavigation(role: WorkspaceRole | 'owner' | null, isLeader: boolean, isGuest: boolean): boolean {
  return !isGuest && (isLeader || role === 'host' || roleAllows(role, 'analytics'));
}

export function navigationPathActive(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(`${path}/`);
}

export function insightsNavigationLabel(language: string | undefined, translate: (key: string, options: { defaultValue: string }) => unknown): string {
  const fallback = language?.startsWith('es') ? 'Estadísticas' : 'Insights';
  const label = translate('nav.insights', { defaultValue: fallback });
  return typeof label === 'string' && label.trim() && label !== 'nav.insights' ? label : fallback;
}