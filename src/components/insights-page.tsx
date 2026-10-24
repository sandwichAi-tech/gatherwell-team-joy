import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { EmptyState, ListSkeleton } from '@/components/launch-states';
import { GwFeatureTile, GwIcon } from '@/components/gw-icon';
import { downloadCsv } from '@/lib/csv';
import { formatMoney } from '@/lib/billing';
import { useGatherwell } from '@/components/gatherwell-shell';
import { workspaceQuery } from '@/lib/account';
import { roleAllows } from '@/lib/workspace';
import { getHostAnalytics, getTeamAnalytics } from '@/lib/insights.functions';
import { attendanceRate, eventsCsv, offersCsv, totals, type HostAnalytics } from '@/lib/insights';

const useLang = () => { const { i18n } = useTranslation(); return i18n.resolvedLanguage === 'es' ? 'es' : 'en'; };
const fmtDate = (iso: string | null, lang: string) => iso ? new Intl.DateTimeFormat(lang === 'es' ? 'es-MX' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(iso)) : '—';

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return <div className="panel stat-card"><p className="stat-value">{value}</p><p className="stat-label">{label}</p>{hint && <p className="stat-hint">{hint}</p>}</div>;
}

export function InsightsPage() {
  const { t } = useTranslation();
  const lang = useLang();
  const { userId } = useGatherwell();
  const hostFn = useServerFn(getHostAnalytics);
  const teamFn = useServerFn(getTeamAnalytics);
  const { data: workspace } = useQuery(workspaceQuery(userId));
  const { data, isLoading } = useQuery({ queryKey: ['host-analytics', userId], queryFn: () => hostFn() });
  const canTeamAnalytics = roleAllows(workspace?.role, 'analytics');
  const { data: team } = useQuery({
    queryKey: ['team-analytics', workspace?.teamId],
    enabled: canTeamAnalytics && !!workspace?.teamId,
    queryFn: () => teamFn({ data: { teamId: workspace!.teamId } }),
  });

  if (isLoading || !data) return <ListSkeleton />;
  const analytics = data as HostAnalytics;
  const t4 = totals(analytics.events);
  const hasSales = analytics.sales.orders > 0;

  return <div className="page-stack">
    <header className="page-heading">
      <div>
        <p className="eyebrow">{t('insights.eyebrow')}</p>
        <h1>{t('insights.title')}</h1>
        <p>{t('insights.subtitle')}</p>
      </div>
    </header>

    <section className="stats-grid" aria-label={t('insights.eventsHeading')}>
      <StatCard label={t('insights.registered')} value={String(t4.going)} />
      <StatCard label={t('insights.attended')} value={String(t4.attended)} />
      <StatCard label={t('insights.waitlisted')} value={String(t4.waitlist)} />
      <StatCard label={t('insights.cancelled')} value={String(t4.cancelled)} />
    </section>

    <section className="panel">
      <div className="section-heading"><h2>{t('insights.eventsHeading')}</h2></div>
      {analytics.events.length === 0
        ? <EmptyState compact icon="CalendarDays" text={t('insights.eventsEmpty')} />
        : <>
          <div className="table-scroll"><table className="data-table">
            <thead><tr>
              <th>{t('insights.colEvent')}</th><th>{t('insights.colDate')}</th><th>{t('insights.registered')}</th>
              <th>{t('insights.attended')}</th><th>{t('insights.attendanceRate')}</th><th>{t('insights.waitlisted')}</th><th>{t('insights.cancelled')}</th>
            </tr></thead>
            <tbody>{analytics.events.map(e => {
              const rate = attendanceRate(e);
              return <tr key={e.id}>
                <td>{e.title}</td><td>{fmtDate(e.starts_at, lang)}</td><td>{e.going}</td><td>{e.attended}</td>
                <td>{rate === null ? '—' : `${rate}%`}</td><td>{e.waitlist}</td><td>{e.cancelled}</td>
              </tr>;
            })}</tbody>
          </table></div>
          <Button variant="secondary" className="export-btn" onClick={() => {
            const csv = eventsCsv(analytics.events);
            const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
            const url = URL.createObjectURL(blob); const a = document.createElement('a');
            a.href = url; a.download = 'event-analytics.csv'; document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 30_000);
          }}><GwIcon name="Download" size={16} />{t('insights.exportEvents')}</Button>
        </>}
    </section>

    <section className="panel">
      <div className="section-heading"><h2>{t('insights.offersHeading')}</h2></div>
      {analytics.offers.length === 0
        ? <EmptyState compact icon="BookOpen" text={t('insights.offersEmpty')} />
        : <>
          <div className="table-scroll"><table className="data-table">
            <thead><tr>
              <th>{t('insights.colOffering')}</th><th>{t('insights.colKind')}</th><th>{t('insights.enrollments')}</th>
              <th>{t('insights.learnersStarted')}</th><th>{t('insights.certificates')}</th>
            </tr></thead>
            <tbody>{analytics.offers.map(o => <tr key={o.id}>
              <td>{o.title}</td><td>{t(`offers.kind_${o.kind}`, { defaultValue: o.kind })}</td>
              <td>{o.enrollments}</td><td>{o.learners_started}</td><td>{o.certificates}</td>
            </tr>)}</tbody>
          </table></div>
          <Button variant="secondary" className="export-btn" onClick={() => {
            const csv = offersCsv(analytics.offers);
            const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
            const url = URL.createObjectURL(blob); const a = document.createElement('a');
            a.href = url; a.download = 'offering-analytics.csv'; document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 30_000);
          }}><GwIcon name="Download" size={16} />{t('insights.exportOffers')}</Button>
        </>}
    </section>

    <section className="panel">
      <div className="section-heading"><h2>{t('insights.salesHeading')}</h2></div>
      {hasSales
        ? <div className="stats-grid">
            <StatCard label={t('insights.gross')} value={formatMoney(analytics.sales.gross_cents, lang)} />
            <StatCard label={t('insights.platformFees')} value={formatMoney(analytics.sales.platform_fee_cents, lang)} hint={t('insights.feeHint')} />
            <StatCard label={t('insights.net')} value={formatMoney(analytics.sales.net_cents, lang)} />
          </div>
        : <EmptyState compact icon="CreditCard" text={t('insights.salesEmpty')} />}
    </section>

    {canTeamAnalytics && workspace && <section className="panel">
      <div className="section-heading"><h2>{t('insights.teamHeading', { team: workspace.name })}</h2></div>
      {!team
        ? <EmptyState compact icon="UsersRound" text={t('insights.teamEmpty')} />
        : <div className="stats-grid">
            <StatCard label={t('insights.teamMembers')} value={String(team.members)} />
            <StatCard label={t('insights.teamEvents')} value={String(team.events)} hint={t('insights.teamEvents30d', { count: team.events_30d })} />
            <StatCard label={t('insights.registered')} value={String(team.registrations)} />
            <StatCard label={t('insights.attended')} value={String(team.attended)} />
            <StatCard label={t('insights.enrollments')} value={String(team.enrollments)} />
          </div>}
      <p className="stat-hint">{t('insights.teamNote')}</p>
    </section>}
  </div>;
}
