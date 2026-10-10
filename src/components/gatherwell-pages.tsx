import { FoundingCommitmentsCard } from '@/components/founding';
import { CoachLaunchCard } from '@/components/coach-launch';
import { PlaybookCard } from '@/components/playbook';
import { DailyBriefCard, FollowupsHomeCard, MemberPlanCard } from '@/components/smart';
import { ActiveChallengeCard } from '@/components/challenges';
import { FromYourLeader } from '@/components/templates';
import { TeamSwitcher } from '@/components/team-switcher';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Plus, UsersRound, CalendarDays, Repeat2, CircleCheck, Globe2, Sun, Moon, Monitor, BookOpen, ChevronRight } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { useGatherwell } from './gatherwell-shell';
import { FeaturedFromNetwork } from '@/components/network-page';
import { TeamOffersStrip } from '@/components/offers';
import i18n from '@/lib/i18n';
import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Copy, LogOut } from '@/components/icons';
import { supabase } from '@/integrations/supabase/client';
import { firstName, initialsOf, joinLink, profileQuery, workspaceQuery } from '@/lib/account';

function useAccount() {
  const { userId } = useGatherwell();
  const { data: profile } = useQuery(profileQuery(userId));
  const { data: workspace } = useQuery(workspaceQuery(userId));
  return { profile, workspace };
}

function NextCard() {
  const { t } = useTranslation(); const { openPlaceholder } = useGatherwell(); const { profile, workspace } = useAccount();
  const [copied, setCopied] = useState(false);
  const role = profile?.role_intent ?? 'member';
  const item = (title: string, text: string, action: React.ReactNode, done = false) => <div className={`next-item ${done ? 'is-done' : ''}`}><span className="next-status">{done ? <Check /> : null}</span><div className="person-info"><h3>{title}</h3><p>{text}</p></div>{action}</div>;
  return <section className="panel next-panel"><span className="eyebrow">{t('next.label')}</span>
    {role === 'leader' && <>
      {item(t('next.inviteTitle'), t('next.inviteText'), <Button variant={copied ? 'secondary' : 'default'} disabled={!workspace} onClick={async () => { if (!workspace) return; await navigator.clipboard.writeText(joinLink(workspace.joinCode)); setCopied(true); window.setTimeout(() => setCopied(false), 2000); }}>{copied ? <Check /> : <Copy />}{copied ? t('next.copied') : t('next.inviteAction')}</Button>, copied)}
      {item(t('next.templateTitle'), t('next.templateText'), <Button variant={copied ? 'default' : 'secondary'} onClick={() => openPlaceholder('event')}>{t('next.templateAction')}</Button>)}
    </>}
    {role === 'host' && item(t('next.hostTitle'), t('next.hostText'), <Button onClick={() => openPlaceholder('event')}><Plus />{t('next.hostAction')}</Button>)}
    {role === 'member' && item(t('next.memberTitle'), t('next.memberText'), <Button asChild><Link to="/events">{t('next.memberAction')}<ArrowRight /></Link></Button>)}
  </section>;
}

function SignOutButton() {
  const { t } = useTranslation(); const queryClient = useQueryClient(); const navigate = useNavigate();
  return <Button variant="secondary" className="sign-out" onClick={async () => { await queryClient.cancelQueries(); queryClient.clear(); await supabase.auth.signOut(); void navigate({ to: '/login', replace: true }); }}><LogOut />{t('me.signOut')}</Button>;
}

const events = [{ key: 'camp', day: 26, count: 24, total: 30 }, { key: 'habits', day: 28, count: 18, total: 40 }, { key: 'growth', day: 30, count: 32, total: 50 }] as const;
const people = ['sofia', 'james', 'emily'] as const;
export function EventRows() {
  const { t } = useTranslation();
  const { openDetail } = useGatherwell();
  return <div className="event-list">{events.map(event => <div className="event-row" key={event.key}>
    <div className="date-tile"><span>{t('sampleEvents.month')}</span><strong>{event.day}</strong></div>
    <div className="event-info"><h3>{t(`sampleEvents.${event.key}.title`)}</h3><p>{t(`sampleEvents.${event.key}.time`)}</p><div className="event-registration"><span className={`chip ${event.key === 'camp' ? 'warm-chip' : ''}`}>{t(`sampleEvents.${event.key}.chip`)}</span><span>{t('sampleEvents.registered', event)}</span></div><progress className="attendance-progress" value={event.count} max={event.total} aria-label={t('sampleEvents.registered', event)} /></div>
    <Button variant="secondary" size="sm" onClick={() => openDetail(t(`sampleEvents.${event.key}.title`), `${t(`sampleEvents.${event.key}.time`)} · ${t('sampleEvents.registered', event)}`)}>{t('sampleEvents.manage')}</Button>
  </div>)}</div>;
}
function PeopleRows({ follow = false }: { follow?: boolean }) {
  const { t } = useTranslation(); const { openDetail } = useGatherwell();
  return <div>{people.map(person => <div className="person-row" key={person}><div className={`initial-avatar avatar-${person}`}>{t(`people.${person}.initials`)}</div><div className="person-info"><h3>{t(`people.${person}.name`)}</h3><p>{t(`people.${person}.${follow ? 'note' : 'role'}`)}</p></div><Button variant="secondary" size="sm" onClick={() => openDetail(t(`people.${person}.name`), t(`people.${person}.${follow ? 'note' : 'role'}`))}>{follow ? t('home.followAction') : <ChevronRight aria-label={t('home.viewDetails')} />}</Button></div>)}</div>;
}
function HomeTemplates() { const { workspace } = useAccount(); return workspace ? <FromYourLeader teamId={workspace.teamId} role={workspace.role} /> : null; }
function MobileTeamSwitcher() { const { userId } = useGatherwell(); return <TeamSwitcher userId={userId} className="mobile-switcher" />; }
function HomeFeatured() { const { workspace } = useAccount(); return workspace ? <><FeaturedFromNetwork teamId={workspace.teamId} /><TeamOffersStrip teamId={workspace.teamId} /></> : null; }

export function HomePage() {
  const { t } = useTranslation(); const { openCreate, openDetail, openPlaceholder } = useGatherwell(); const { profile } = useAccount();
  const stats = [{ key: 'members', Icon: UsersRound }, { key: 'events', Icon: CalendarDays }, { key: 'attendance', Icon: Repeat2 }, { key: 'checkins', Icon: CircleCheck }] as const;
  return <>
    <MobileTeamSwitcher />
    <FoundingCommitmentsCard />
    <CoachLaunchCard />
    <DailyBriefCard />
    <PlaybookCard context="brief" compact />
    <FollowupsHomeCard />
    <MemberPlanCard />
    <NextCard />
    <ActiveChallengeCard />
    <HomeFeatured />
    <HomeTemplates />
    <LeaderInsightsLink />
    <div className="greeting page-heading"><div><span className="eyebrow">{t('home.eyebrow')}</span><h1>{t('home.greeting', { name: firstName(profile?.full_name) || t('common.name') })}</h1><p>{t('home.subtitle')}</p><span className="chip sample-badge mobile-sample">{t('common.sample')}</span></div><Button className="page-create" onClick={openCreate}><Plus />{t('common.create')}</Button></div>
    <section className="stats-grid" aria-label={t('common.sample')}>
      {stats.map(({ key, Icon }) => <article className="stat-card" key={key}><div className="stat-heading"><span>{t(`stats.${key}.label`)}</span><Icon /></div><strong className="stat-value">{t(`stats.${key}.value`)}</strong><p className={key === 'events' ? '' : 'positive-change'}>{t(`stats.${key}.note`)}</p><Button variant="link" className="detail-link" onClick={() => openDetail(t(`stats.${key}.label`), `${t(`stats.${key}.value`)} · ${t(`stats.${key}.note`)}`)}>{t('home.viewDetails')}<ArrowRight /></Button></article>)}
    </section>
    <div className="dashboard-columns">
      <section className="panel upcoming-panel"><div className="section-heading"><h2>{t('home.upcoming')}</h2><Button asChild variant="link"><Link to="/events">{t('home.viewAll')}<ArrowRight /></Link></Button></div><EventRows /></section>
      <div className="dashboard-right"><section className="network-panel"><div className="circle-lines" aria-hidden="true" /><span className="eyebrow">{t('home.networkLabel')}</span><h2>{t('home.networkTitle')}</h2><p>{t('home.networkText')}</p><Button asChild className="peach-button"><Link to="/network">{t('home.networkAction')}<ArrowRight /></Link></Button></section>
      <section className="panel pulse-panel"><h2>{t('home.pulse')}</h2><div className="pulse-list">{(['sofia', 'challenge', 'maria'] as const).map(key => <div className="pulse-item" key={key}><span className="pulse-dot" /><div><h3>{t(`pulse.${key}.title`)}</h3><p>{t(`pulse.${key}.time`)}</p></div></div>)}</div></section></div>
    </div>
    <section className="panel follow-panel"><div className="section-heading"><div><h2>{t('home.followTitle')}</h2><p>{t('home.followSubtitle')}</p></div><span className="chip warm-chip">{t('home.followChip')}</span></div><PeopleRows follow /></section>
  </>;
}
export function EmptyPage({ page }: { page: 'events' | 'team' | 'learn' | 'me' }) {
  const { t } = useTranslation(); const { openPlaceholder, openDetail, theme, setTheme } = useGatherwell(); const { profile, workspace } = useAccount();
  const actions = { events: 'event', team: 'team', learn: 'training', me: 'profile' } as const;
  const changeLanguage = (language: 'en' | 'es') => { void i18n.changeLanguage(language); localStorage.setItem('gatherwell-language', language); };
  return <>
    {page === 'team' && <MobileTeamSwitcher />}
    <div className="page-heading"><div><span className="eyebrow">{t(`${page}.eyebrow`)}</span><h1>{t(`${page}.title`)}</h1><p>{t(`${page}.sentence`)}</p></div><Button onClick={() => openPlaceholder(actions[page])}><Plus />{t(`${page}.button`)}</Button></div>
    <section className="panel tab-panel"><div className="section-heading"><h2>{t(`${page}.heading`)}</h2><span className="chip sample-badge">{t('common.sample')}</span></div>
      {page === 'events' && <EventRows />}
      {page === 'team' && <PeopleRows />}
      {page === 'learn' && <div>{(['hosts', 'connections', 'routines'] as const).map(key => <div className="person-row training-row" key={key}><span className="initial-avatar"><BookOpen /></span><div className="person-info"><h3>{t(`trainingRows.${key}.title`)}</h3><p>{t(`trainingRows.${key}.note`)}</p></div><Button variant="secondary" onClick={() => openDetail(t(`trainingRows.${key}.title`), t(`trainingRows.${key}.note`))}>{t(`trainingRows.${key}.status`)}<ArrowRight /></Button></div>)}</div>}
      {page === 'me' && <div><div className="person-row"><span className="initial-avatar">{initialsOf(profile?.full_name)}</span><div className="person-info"><h3>{profile?.full_name}</h3><p>{[workspace?.name, profile?.city].filter(Boolean).join(' · ')}</p></div></div>{(['activity', 'workspace'] as const).map(key => <div className="profile-row" key={key}><h3>{t(`profileRows.${key}`)}</h3><p>{t(`profileRows.${key}Value`)}</p></div>)}</div>}
    </section>
    {page === 'me' && <section className="panel preferences"><h2>{t('me.preferences')}</h2><div className="preference-row"><div className="preference-label"><Globe2 /><span>{t('me.language')}</span></div><div className="segmented" role="group" aria-label={t('me.language')}>{(['en', 'es'] as const).map(lang => <Button key={lang} variant="ghost" aria-pressed={i18n.resolvedLanguage === lang} className={i18n.resolvedLanguage === lang ? 'selected' : ''} onClick={() => changeLanguage(lang)}>{t(lang === 'en' ? 'me.english' : 'me.spanish')}</Button>)}</div></div><div className="preference-row"><div className="preference-label"><Sun /><span>{t('me.appearance')}</span></div><div className="segmented" role="group" aria-label={t('me.appearance')}>{([{ value: 'light', Icon: Sun }, { value: 'dark', Icon: Moon }, { value: 'system', Icon: Monitor }] as const).map(({ value, Icon }) => <Button key={value} variant="ghost" size="icon" className={theme === value ? 'selected' : ''} aria-pressed={theme === value} aria-label={t(`me.${value}`)} title={t(`me.${value}`)} onClick={() => setTheme(value)}><Icon /></Button>)}</div></div><SignOutButton /></section>}
  </>;
}

function LeaderInsightsLink() {
  const { t } = useTranslation(); const { userId } = useGatherwell();
  const { data: workspace } = useQuery(workspaceQuery(userId));
  if (workspace?.role !== 'leader') return null;
  return <section className="panel leader-insights-link"><div className="section-heading"><div><span className="eyebrow">{t('insights.eyebrow')}</span><h2>{t('insights.title')}</h2><p>{t('insights.homeText')}</p></div>
    <div className="leader-links"><Button asChild><Link to="/team/insights">{t('insights.homeLink')}<ArrowRight /></Link></Button><Button asChild variant="secondary"><Link to="/team/map">{t('insights.mapLink')}</Link></Button></div></div></section>;
}
