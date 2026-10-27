import { personalHomeQuery } from '@/lib/personal-home-query';
import { PersonalHomeResources } from '@/components/personal-home-resources';
import { BarChart3 } from '@/components/icons';
import { TemplateEditor, type TemplateDraft } from '@/components/templates';
import { CustomerHome } from '@/components/customer-home';
import { HostCheckinActions } from '@/components/host-checkin-actions';
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
import { useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Check, Copy, LogOut } from '@/components/icons';
import { supabase } from '@/integrations/supabase/client';
import { firstName, initialsOf, joinLink, profileQuery, workspaceQuery } from '@/lib/account';
import { useServerFn } from '@tanstack/react-start';
import { getAttendanceHistory } from '@/lib/insights.functions';
import { ListSkeleton, RetryState, EmptyState } from './launch-states';

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
      {item(t('next.inviteTitle'), t('next.inviteText'), <Button asChild disabled={!workspace}><Link to="/team" search={{ panel: 'invite' }}><Copy />{t('next.inviteAction')}</Link></Button>)}
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

export function HomePage() {
  const { t } = useTranslation(); const { userId, openCreate } = useGatherwell(); const { profile } = useAccount();
  const { data } = useSuspenseQuery(personalHomeQuery(userId));
  const hosting = data.mode === 'hosting';
  const name = firstName(profile?.full_name);
  return <>
    {hosting && <MobileTeamSwitcher />}
    <div className="greeting page-heading"><div><span className="eyebrow">{t(hosting ? 'personalHome.hosting' : 'personalHome.attending')}</span><h1>{name ? t('home.greeting', { name }) : t('home.greetingFallback')}</h1><p>{t('personalHome.subtitle')}</p></div>{hosting && <Button className="page-create" onClick={openCreate}><Plus />{t('common.create')}</Button>}</div>
    <DailyBriefCard />
    {hosting ? <>
      <HostCheckinActions userId={userId} />
      {data.drafts > 0 && <section className="panel"><Link to="/events" search={{ tab: 'hosting' }}>{t('personalHome.drafts', { count: data.drafts })}<ArrowRight /></Link></section>}
      <section className="panel upcoming-panel"><div className="section-heading"><h2>{t('home.upcoming')}</h2><Button asChild variant="link"><Link to="/events" search={{ tab: 'hosting' }}>{t('home.viewAll')}<ArrowRight /></Link></Button></div>
        {!data.events.length && <EmptyState compact icon="CalendarDays" text={t('events.empty.hosting')} />}
        <ul className="customer-list">{data.events.map(e => <li key={e.id}><Link to="/event/$id" params={{ id: e.id }} className="customer-item-head"><strong>{e.title}</strong><small>{e.starts_at}</small><ChevronRight /></Link></li>)}</ul>
      </section>
      <FoundingCommitmentsCard /><CoachLaunchCard /><FollowupsHomeCard /><NextCard />
    </> : <CustomerHome userId={userId} />}
    <PersonalHomeResources resources={data.resources} />
  </>;
}
function MobileTeamSwitcher() { const { userId } = useGatherwell(); return <TeamSwitcher userId={userId} className="mobile-switcher" />; }
