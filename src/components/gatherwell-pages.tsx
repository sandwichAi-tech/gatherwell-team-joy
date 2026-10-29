import { personalHomeQuery } from '@/lib/personal-home-query';
import { PersonalHomeResources } from '@/components/personal-home-resources';
import { homeNextAction } from '@/lib/event-day-home';
import type { PersonalHome } from '@/lib/personal-home';
import { CustomerHome } from '@/components/customer-home';
import { HostCheckinActions } from '@/components/host-checkin-actions';
import { FoundingCommitmentsCard } from '@/components/founding';
import { CoachLaunchCard } from '@/components/coach-launch';
import { FollowupsHomeCard } from '@/components/smart';
import { TeamSwitcher } from '@/components/team-switcher';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Plus, ChevronRight } from '@/components/icons';
import { useState } from 'react';
import { useStartHosting } from '@/lib/switch-mode';
import { Button } from '@/components/ui/button';
import { useGatherwell } from './gatherwell-shell';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { firstName, profileQuery, workspaceQuery } from '@/lib/account';
import { EmptyState } from './launch-states';
import { formatWhen } from '@/lib/guest';

function useAccount() {
  const { userId } = useGatherwell();
  const { data: profile } = useQuery(profileQuery(userId));
  const { data: workspace } = useQuery(workspaceQuery(userId));
  return { profile, workspace };
}

function NextCard({ home }: { home: PersonalHome }) {
  const { t } = useTranslation(); const next = homeNextAction(home);
  if (!next) return null;
  return <section className="next-panel mb-6" aria-label={t('next.label')}><span className="eyebrow">{t('next.label')}</span><h2>{t(next.kind === 'draft' ? 'next.finishDraft' : 'next.hostTitle')}</h2>
    {next.kind === 'draft' ? <><p>{next.title}</p><Button asChild className="min-h-12 whitespace-normal"><Link to="/gathering/$id/edit" params={{ id: next.id }}>{t('next.finishDraft')}<ArrowRight /></Link></Button></> : <Button asChild className="min-h-12 whitespace-normal"><Link to="/gathering/new"><Plus />{t('next.hostAction')}</Link></Button>}
  </section>;
}

export function HomePage() {
  const { t, i18n } = useTranslation(); const { userId, openCreate } = useGatherwell(); const { profile } = useAccount();
  const { data } = useSuspenseQuery(personalHomeQuery(userId));
  const hosting = data.mode === 'hosting';
  const name = firstName(profile?.full_name);
  return <>
    {hosting && <MobileTeamSwitcher />}
    <div className="greeting page-heading"><div><span className="eyebrow">{t(hosting ? 'personalHome.hosting' : 'personalHome.attending')}</span><h1>{name ? t('home.greeting', { name }) : t('home.greetingFallback')}</h1><p>{t('personalHome.subtitle')}</p></div>{hosting && <Button className="page-create" onClick={openCreate}><Plus />{t('common.create')}</Button>}</div>
    {data.events[0] && <section className="brief-card morning-brief" aria-labelledby="personal-brief"><div className="section-heading"><h2 id="personal-brief">{t('smart.brief.title')}</h2></div><p>{data.events[0].title} · {formatWhen(data.events[0].starts_at, i18n.resolvedLanguage ?? 'en')}</p></section>}
    {hosting ? <>
      <HostCheckinActions userId={userId} />
      {data.drafts > 0 && <section className="panel"><Link to="/events" search={{ tab: 'hosting' }}>{t('personalHome.drafts', { count: data.drafts })}<ArrowRight /></Link></section>}
      <section className="panel upcoming-panel"><div className="section-heading"><h2>{t('home.upcoming')}</h2><Button asChild variant="link"><Link to="/events" search={{ tab: 'hosting' }}>{t('home.viewAll')}<ArrowRight /></Link></Button></div>
        {!data.events.length && <EmptyState compact icon="CalendarDays" text={t('events.empty.hosting')} />}
        <ul className="customer-list">{data.events.map(e => <li key={e.id}><Link to="/event/$id" params={{ id: e.id }} className="customer-item-head"><strong>{e.title}</strong><small>{formatWhen(e.starts_at, i18n.resolvedLanguage ?? 'en')}</small><ChevronRight /></Link></li>)}</ul>
      </section>
      <FoundingCommitmentsCard /><CoachLaunchCard /><FollowupsHomeCard /><NextCard home={data} />
    </> : <><StartHostingCard userId={userId} /><CustomerHome userId={userId} /></>}
    <PersonalHomeResources resources={data.resources} />
  </>;
}
function StartHostingCard({ userId }: { userId: string }) {
  const { t } = useTranslation(); const startHosting = useStartHosting(userId); const [busy, setBusy] = useState(false);
  return <section className="next-panel mb-6" aria-labelledby="start-hosting-title"><h2 id="start-hosting-title">{t('customerHome.hostFree')}</h2><Button className="min-h-12 whitespace-normal" disabled={busy} onClick={async () => { setBusy(true); if (!(await startHosting())) setBusy(false); }}><Plus />{t('customerHome.startHosting')}</Button></section>;
}
function MobileTeamSwitcher() { const { userId } = useGatherwell(); return <TeamSwitcher userId={userId} className="mobile-switcher" />; }
