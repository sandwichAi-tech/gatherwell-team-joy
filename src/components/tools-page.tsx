import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useGatherwell } from '@/components/gatherwell-shell';
import { GwFeatureTile, GwIcon } from '@/components/gw-icon';
import { EmptyState } from '@/components/launch-states';
import { workspaceQuery } from '@/lib/account';
import { isAdminQuery } from '@/lib/site-media';
import { useFeature } from '@/lib/feature-flags';
import { paymentsReadinessQuery } from '@/components/payments-readiness';
import { canSellPaid } from '@/lib/payments-readiness';
import { buildToolSections, hasManagementTools } from '@/lib/tools-inventory';
import type { WorkspaceRole } from '@/components/workspace-settings';
import { Button } from '@/components/ui/button';

/**
 * Tools launchpad: every management destination the current person is authorized
 * to use, grouped by purpose. Visibility mirrors roleAllows/MANAGER_ROLES and the
 * feature flags; each destination still enforces its own server-side checks.
 */
export function ToolsPage() {
  const { t } = useTranslation();
  const { userId } = useGatherwell();
  const { data: workspace } = useQuery(workspaceQuery(userId));
  const { data: isAdmin } = useQuery(isAdminQuery(userId));
  const { data: readiness } = useQuery(paymentsReadinessQuery);
  const [learnOn, learnReady] = useFeature('feature_learn');
  const [mapOn, mapReady] = useFeature('feature_team_map');

  const wsRole = workspace ? ((workspace.ownerId === userId ? 'owner' : workspace.workspaceRole) as WorkspaceRole | 'owner') : null;
  const ready = workspace !== undefined && isAdmin !== undefined && learnReady && mapReady && readiness !== undefined;
  if (!ready) return <p className="auth-subtitle tools-loading">{t('publicEvent.loading')}</p>;

  const sections = buildToolSections({
    isLeader: workspace?.role === 'leader',
    workspaceRole: wsRole,
    isAdmin: !!isAdmin,
    learnOn,
    teamMapOn: mapOn,
    canSellPaid: readiness ? canSellPaid(readiness) : false,
  });

  return <div className="tools-page">
    <header className="page-heading">
      <div>
        <p className="eyebrow">{t('toolsPage.eyebrow')}</p>
        <h1>{t('toolsPage.title')}</h1>
        <p>{t('toolsPage.subtitle')}</p>
      </div>
    </header>

    {!hasManagementTools(sections) && (
      <section className="panel">
        <EmptyState
          icon="SquaresFour"
          title={t('toolsPage.emptyTitle')}
          text={t('toolsPage.emptyText')}
          action={<Button asChild variant="secondary"><Link to="/home">{t('toolsPage.emptyAction')}</Link></Button>}
        />
      </section>
    )}

    {sections.map(section => (
      <section key={section.id} className="panel tools-section" aria-labelledby={`tools-${section.id}`}>
        <div className="section-heading"><h2 id={`tools-${section.id}`}>{t(`toolsPage.sections.${section.id}`)}</h2></div>
        <ul className="tools-grid">
          {section.tools.map(tool => (
            <li key={tool.id}>
              <Link to={tool.to} className="tool-card">
                <GwFeatureTile name={tool.icon} size={24} className="settings-tile" />
                <span className="tool-card-body">
                  <span className="tool-card-title">
                    {t(`toolsPage.tools.${tool.id}.title`)}
                    {tool.badge === 'setup' && <span className="chip tool-badge">{t('toolsPage.badge.setup')}</span>}
                  </span>
                  <span className="tool-card-desc">{t(`toolsPage.tools.${tool.id}.desc`)}</span>
                </span>
                <GwIcon name="ChevronRight" className="settings-chevron" />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    ))}
  </div>;
}
