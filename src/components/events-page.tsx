import { useState } from 'react';
import { ListSkeleton } from '@/components/launch-states';
import { Link, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, List, Map as MapIcon, ArrowRight } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { GatheringCover } from '@/components/gathering-cover';
import { useGatherwell } from '@/components/gatherwell-shell';
import { MapPlaceholder, RealMap } from '@/components/map-page';
import { teamsQuery, workspaceQuery } from '@/lib/account';
import { eventsTabQuery, isOnline, placeOf, type EventsTab, type Gathering } from '@/lib/gatherings';
import { useMapsKey } from '@/lib/maps-client';

export function GatheringCard({ e, lang }: { e: Gathering; lang: string }) {
  const { t } = useTranslation();
  const d = new Date(e.starts_at); const online = isOnline(e);
  const kind = e.theme === 'training' ? 'training' : online ? 'online' : 'person';
  return <Link to="/event/$id" params={{ id: e.id }} className="gathering-card">
    <GatheringCover path={e.cover_url} style={e.cover_style} title={e.title} className="card-strip" />
    <div className="gathering-card-body">
      <div className="date-tile"><span>{d.toLocaleDateString(lang, { month: 'short' })}</span><strong>{d.getDate()}</strong></div>
      <div className="event-info">
        <h3>{e.title}</h3>
        <p>{d.toLocaleTimeString(lang, { hour: 'numeric', minute: '2-digit' })} · {placeOf(e) ?? t('teamSpace.online')}</p>
        <div className="event-registration"><span className={`chip ${kind === 'person' ? 'warm-chip' : ''}`}>{t(`gathering.kind.${kind}`)}</span>
          {e.status !== 'published' && <span className="chip">{t(`teamSpace.status.${e.status}`)}</span>}
          <span className="tabular">{e.capacity ? t('gathering.goingOf', { count: e.going ?? 0, total: e.capacity }) : t('map.going', { count: e.going ?? 0 })}</span></div>
        {e.capacity ? <progress className="attendance-progress" value={Math.min(e.going ?? 0, e.capacity)} max={e.capacity} aria-hidden="true" /> : null}
      </div>
    </div>
  </Link>;
}

export function EventsPage({ tab }: { tab: EventsTab }) {
  const { t, i18n } = useTranslation(); const { userId } = useGatherwell(); const navigate = useNavigate(); const lang = i18n.resolvedLanguage ?? 'en';
  const { data: teams = [] } = useQuery(teamsQuery(userId)); const { data: workspace } = useQuery(workspaceQuery(userId));
  const ids = teams.map(x => x.teamId);
  const { data = [], isLoading } = useQuery({ ...eventsTabQuery(userId, ids, tab), enabled: teams.length > 0 || tab === 'hosting' });
  const [view, setView] = useState<'list' | 'map'>('list');
  const mapsKey = useMapsKey();
  const canCreate = workspace && workspace.role !== 'member';
  const setTab = (next: EventsTab) => navigate({ to: '/events', search: { tab: next }, replace: true });

  return <>
    <div className="page-heading"><div><span className="eyebrow">{t('events.eyebrow')}</span><h1>{t('events.title')}</h1><p>{t('events.liveSentence')}</p></div>
      <div className="blueprint-page-actions"><Button asChild variant="secondary"><Link to="/blueprints">{t('templates.heading')}</Link></Button>{canCreate && <Button asChild className="page-create"><Link to="/gathering/new"><Plus />{t('gathering.create')}</Link></Button>}</div></div>
    <div className="insights-filters">
      <div className="segmented" role="tablist" aria-label={t('events.title')}>{(['upcoming', 'hosting', 'past'] as const).map(k => <Button key={k} role="tab" variant="ghost" aria-selected={tab === k} className={tab === k ? 'selected' : ''} onClick={() => setTab(k)}>{t(`events.tabs.${k}`)}</Button>)}</div>
      <div className="segmented" role="group" aria-label={t('events.view')}>
        <Button variant="ghost" size="icon" aria-pressed={view === 'list'} className={view === 'list' ? 'selected' : ''} onClick={() => setView('list')} aria-label={t('events.list')} title={t('events.list')}><List /></Button>
        <Button variant="ghost" size="icon" aria-pressed={view === 'map'} className={view === 'map' ? 'selected' : ''} onClick={() => setView('map')} aria-label={t('events.map')} title={t('events.map')}><MapIcon /></Button></div>
    </div>
    {view === 'map' && <section className="panel map-panel">{mapsKey ? <RealMap apiKey={mapsKey} events={data} onPick={e => navigate({ to: '/event/$id', params: { id: e.id } })} /> : <MapPlaceholder />}</section>}
    {isLoading ? <ListSkeleton /> : data.length ? <div className="gathering-grid">{data.map(e => <GatheringCard key={e.id} e={e} lang={lang} />)}</div> : <>
      <section className="panel empty-gatherings"><h2>{t(`events.empty.${tab}`)}</h2><p>{t('events.emptyText')}</p>
        {canCreate && <Button asChild><Link to="/gathering/new"><Plus />{t('gathering.createFirst')}<ArrowRight /></Link></Button>}</section>
    </>}
  </>;
}
