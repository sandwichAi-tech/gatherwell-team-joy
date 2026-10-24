import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { WorkspaceSettings } from '@/components/workspace-settings';
import { useGatherwell } from '@/components/gatherwell-shell';
import { workspaceQuery } from '@/lib/account';
import { ListSkeleton } from '@/components/launch-states';
import i18n from '@/lib/i18n';

export const Route = createFileRoute('/_authenticated/_app/team/settings')({
  head: () => ({ meta: [{ title: `${i18n.t('workspace.title')} · ${i18n.t('brand')}` }, { name: 'robots', content: 'noindex,nofollow' }] }),
  component: function TeamSettingsPage() {
    const { t } = useTranslation();
    const { userId } = useGatherwell();
    const { data: workspace, isLoading } = useQuery(workspaceQuery(userId));
    if (isLoading) return <ListSkeleton />;
    if (!workspace) return <p className="auth-subtitle">{t('workspace.none')}</p>;
    return <>
      <h1 className="page-title">{t('workspace.title')}</h1>
      <WorkspaceSettings teamId={workspace.teamId} userId={userId} teamName={workspace.name} />
    </>;
  },
});
