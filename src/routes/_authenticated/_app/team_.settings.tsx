import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { GwIcon } from '@/components/gw-icon';
import { WorkspaceSettings } from '@/components/workspace-settings';
import { useGatherwell } from '@/components/gatherwell-shell';
import { workspaceQuery } from '@/lib/account';
import { roleAllows } from '@/lib/workspace';
import { ListSkeleton } from '@/components/launch-states';
import i18n from '@/lib/i18n';

export const Route = createFileRoute('/_authenticated/_app/team_/settings')({
  head: () => ({ meta: [{ title: `${i18n.t('workspace.title')} · ${i18n.t('brand')}` }, { name: 'robots', content: 'noindex,nofollow' }] }),
  component: function TeamSettingsPage() {
    const { t } = useTranslation();
    const { userId } = useGatherwell();
    const { data: workspace, isLoading } = useQuery(workspaceQuery(userId));
    if (isLoading) return <ListSkeleton />;
    if (!workspace) return <p className="auth-subtitle">{t('workspace.none')}</p>;
    const isOwner = workspace.ownerId === userId;
    if (!isOwner && !roleAllows(workspace.workspaceRole as never, 'settings')) {
      return <p className="auth-subtitle" role="alert">{t('workspace.noAccess')}</p>;
    }
    return <>
      <h1 className="page-title">{t('workspace.title')}</h1>
      {workspace.role === 'leader' && <Button asChild variant="secondary" className="mb-4"><Link to="/team" search={{ panel: 'edit' }}><GwIcon name="Pencil" />{t('teamSpace.editTeam')}</Link></Button>}
      <WorkspaceSettings teamId={workspace.teamId} userId={userId} teamName={workspace.name} />
    </>;
  },
});
