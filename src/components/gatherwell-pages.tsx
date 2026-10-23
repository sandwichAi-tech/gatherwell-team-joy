import { BarChart3 } from '@/components/icons';
import { TemplateEditor, type TemplateDraft } from '@/components/templates';
import { CustomerHome } from '@/components/customer-home';
import { FoundingCommitmentsCard } from '@/components/founding';
import { CoachLaunchCard } from '@/components/coach-launch';
import { Feature } from '@/lib/feature-flags';
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
  const { t } = useTranslation(); const { userId } = useGatherwell(); const { profile, workspace } = useAccount(); const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [draft, setDraft] = useState<TemplateDraft | null>(null);
  const role = profile?.role_intent ?? 'member';
  const item = (title: string, text: string, action: React.ReactNode, done = false) => <div className={`next-item ${done ? 'is-done' : ''}`}><span className="next-status">{done ? <Check /> : null}</span><div className="person-info"><h3>{title}</h3><p>{text}</p></div>{action}</div>;
  return <section className="panel next-panel"><span className="eyebrow">{t('next.label')}</span>
    {role === 'leader' && <>
      {item(t('next.inviteTitle'), t('next.inviteText'), <Button variant={copied ? 'secondary' : 'default'} disabled={!workspace} onClick={async () => { if (!workspace) return; await navigator.clipboard.writeText(joinLink(workspace.joinCode)); setCopied(true); window.setTimeout(() => setCopied(false), 2000); }}>{copied ? <Check /> : <Copy />}{copied ? t('next.copied') : t('next.inviteAction')}</Button>, copied)}
      {item(t('next.templateTitle'), t('next.templateText'), <Button variant={copied ? 'default' : 'secondary'} onClick={() => setDraft({ checklist: [], default_duration_minutes: 60, visibility_default: 'team' })}>{t('next.templateAction')}</Button>)}
      {workspace && <TemplateEditor draft={draft} teamId={workspace.teamId} userId={userId} onClose={() => setDraft(null)} />}
    </>}
    {role === 'host' && item(t('next.hostTitle'), t('next.hostText'), <Button onClick={() => void navigate({ to: '/gathering/new' })}><Plus />{t('next.hostAction')}</Button>)}
    {role === 'member' && item(t('next.memberTitle'), t('next.memberText'), <Button asChild><Link to="/events">{t('next.memberAction')}<ArrowRight /></Link></Button>)}
  </section>;
}

function SignOutButton() {
  const { t } = useTranslation(); const queryClient = useQueryClient(); const navigate = useNavigate();
  return <Button variant="secondary" className="sign-out" onClick={async () => { await queryClient.cancelQueries(); queryClient.clear(); await supabase.auth.signOut(); void navigate({ to: '/login', replace: true }); }}><LogOut />{t('me.signOut')}</Button>;
}

function HomeTemplates() { const { workspace } = useAccount(); return workspace ? <FromYourLeader teamId={workspace.teamId} role={workspace.role} /> : null; }
function MobileTeamSwitcher() { const { userId } = useGatherwell(); return <TeamSwitcher userId={userId} className="mobile-switcher" />; }
function HomeFeatured() { const { workspace } = useAccount(); return workspace ? <><Feature flag="feature_network"><FeaturedFromNetwork teamId={workspace.teamId} /></Feature><TeamOffersStrip teamId={workspace.teamId} /></> : null; }

/** Real team numbers only; each block hides when it has nothing to show. */
function HomeRealData() {
  const { t, i18n } = useTranslation(); const { workspace } = useAccount();
  const teamId = workspace?.teamId; const manage = !!workspace && workspace.role !== 'member';
  const q = useQuery({ queryKey: ['home-real', teamId, manage], enabled: !!teamId, queryFn: async () => {
    const now = new Date(); const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const [members, upcoming, checkins] = await Promise.all([
      supabase.from('team_members').select('user_id', { count: 'exact', head: true }).eq('team_id', teamId!),
      supabase.from('events').select('id, title, starts_at, location_name', { count: 'exact' }).eq('team_id', teamId!).eq('status', 'published').gte('starts_at', now.toISOString()).order('starts_at').limit(3),
      manage ? supabase.from('rsvps').select('id, events!inner(team_id)', { count: 'exact', head: true }).eq('events.team_id', teamId!).gte('checked_in_at', monthStart) : Promise.resolve({ count: null }),
    ]);
    return { members: members.count ?? 0, upcomingCount: upcoming.count ?? 0, upcoming: upcoming.data ?? [], checkins: checkins.count };
  } });
  if (!q.data) return null;
  const d = q.data; const lang = i18n.resolvedLanguage ?? 'en';
  const tiles = [{ key: 'members', Icon: UsersRound, value: d.members }, { key: 'events', Icon: CalendarDays, value: d.upcomingCount }, ...(d.checkins != null ? [{ key: 'checkins', Icon: CircleCheck, value: d.checkins }] : [])];
  return <>
    <section className="stats-grid" aria-label={t('home.statsLabel')}>{tiles.map(({ key, Icon, value }) => <article className="stat-card" key={key}><div className="stat-heading"><span>{t(`stats.${key}.label`)}</span><Icon /></div><strong className="stat-value">{value.toLocaleString(lang)}</strong></article>)}</section>
    {d.upcoming.length > 0 && <section className="panel upcoming-panel"><div className="section-heading"><h2>{t('home.upcoming')}</h2><Button asChild variant="link"><Link to="/events">{t('home.viewAll')}<ArrowRight /></Link></Button></div>
      <div className="event-list">{d.upcoming.map(e => <Link key={e.id} to="/event/$id" params={{ id: e.id }} className="event-row"><div className="date-tile"><span>{new Date(e.starts_at).toLocaleDateString(lang, { month: 'short' })}</span><strong>{new Date(e.starts_at).getDate()}</strong></div><div className="event-info"><h3>{e.title}</h3><p>{new Date(e.starts_at).toLocaleTimeString(lang, { hour: 'numeric', minute: '2-digit' })}{e.location_name ? ` · ${e.location_name}` : ''}</p></div></Link>)}</div></section>}
  </>;
}

export function HomePage() {
  const { t } = useTranslation(); const { openCreate, openDetail, openPlaceholder } = useGatherwell(); const { profile } = useAccount();
  const guest = profile?.role_intent === 'guest';
  const { userId } = useGatherwell();
  if (guest) return <><div className="greeting page-heading"><div><h1>{t('home.greeting', { name: firstName(profile?.full_name) || t('common.name') })}</h1></div></div><DailyBriefCard /><CustomerHome userId={userId} /></>;
  const stats = [{ key: 'members', Icon: UsersRound }, { key: 'events', Icon: CalendarDays }, { key: 'attendance', Icon: Repeat2 }, { key: 'checkins', Icon: CircleCheck }] as const;
  return <>
    <MobileTeamSwitcher />
    <div className="greeting page-heading"><div><span className="eyebrow">{t('home.eyebrow')}</span><h1>{t('home.greeting', { name: firstName(profile?.full_name) || t('common.name') })}</h1><p>{t('home.subtitle')}</p></div><Button className="page-create" onClick={openCreate}><Plus />{t('common.create')}</Button></div>
    <DailyBriefCard />
    <HomeRealData />
    {!guest && <FoundingCommitmentsCard />}
    {!guest && <CoachLaunchCard />}
    {!guest && <PlaybookCard context="brief" compact />}
    <FollowupsHomeCard />
    <MemberPlanCard />
    {!guest && <NextCard />}
    <ActiveChallengeCard />
    <HomeFeatured />
    {!guest && <HomeTemplates />}
    {!guest && <LeaderInsightsLink />}
    <Feature flag="feature_network"><section className="network-panel"><div className="circle-lines" aria-hidden="true" /><span className="eyebrow">{t('home.networkLabel')}</span><h2>{t('home.networkTitle')}</h2><p>{t('home.networkText')}</p><Button asChild className="peach-button"><Link to="/network">{t('home.networkAction')}<ArrowRight /></Link></Button></section></Feature>
  </>;
}
function LeaderInsightsLink() {
  const { t } = useTranslation(); const { userId } = useGatherwell();
  const { data: workspace } = useQuery(workspaceQuery(userId));
  if (workspace?.role !== 'leader') return null;
  return <section className="panel leader-insights-link"><Link to="/team/insights" className="insights-compact"><span className="insights-compact-icon"><BarChart3 /></span><span className="insights-compact-text"><span className="eyebrow">{t('insights.eyebrow')}</span><strong>{t('insights.title')}</strong><small>{t('insights.homeShort')}</small></span><ArrowRight className="settings-chevron" /></Link>
    <Feature flag="feature_team_map"><Link to="/team/map" className="insights-compact-map">{t('insights.mapLink')}</Link></Feature></section>;
}
