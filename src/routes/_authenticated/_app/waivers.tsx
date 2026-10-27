import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import i18n from '@/lib/i18n';
import { useGatherwell } from '@/components/gatherwell-shell';
import { WaiverLibrary } from '@/components/waiver-library';
import { EmptyState, RetryState } from '@/components/launch-states';
import { workspaceQuery } from '@/lib/account';
import { roleAllows } from '@/lib/workspace';
import { NOINDEX_META } from '@/lib/seo';
import type { WorkspaceRole } from '@/components/workspace-settings';

export const Route = createFileRoute('/_authenticated/_app/waivers')({
  head: () => {
    const title = `${i18n.t('hostForms.title')} · ${i18n.t('brand')}`; const description = i18n.t('hostForms.subtitle');
    return { meta: [{ title }, { name: 'description', content: description }, { property: 'og:title', content: title }, { property: 'og:description', content: description }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { ...NOINDEX_META }] };
  },
  component: WaiversPage,
  errorComponent: ({ reset }) => <RetryState retry={reset} />,
});

function WaiversPage() {
  const { t } = useTranslation(); const { userId } = useGatherwell();
  const { data: workspace, isPending } = useQuery(workspaceQuery(userId));
  const role = workspace ? ((workspace.ownerId === userId ? 'owner' : workspace.workspaceRole) as WorkspaceRole | 'owner') : null;
  const canHost = !!workspace && (workspace.role === 'leader' || roleAllows(role, 'events'));
  return <div className="tools-page">
    <header className="page-heading"><div><h1>{t('hostForms.title')}</h1><p>{t('hostForms.subtitle')}</p></div></header>
    {isPending ? <p role="status">{t('publicEvent.loading')}</p> : canHost ? <WaiverLibrary teamId={workspace.teamId} userId={userId} /> : <EmptyState compact icon="FileText" text={t('hostForms.loginNeeded')} />}
  </div>;
}
