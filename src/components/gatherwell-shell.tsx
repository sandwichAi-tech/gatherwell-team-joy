import { GwIcon } from '@/components/gw-icon';
import { BrandLogo } from '@/components/brand-logo';
import { AssistantPanel } from '@/components/assistant/assistant-panel';
import { PlatformNotices } from '@/components/report-button';
import { PushPrompt } from '@/components/notifications';
import { BadgeEarnedWatcher } from '@/components/recognition';
import { FromYourLeader } from '@/components/templates';
import { TeamSwitcher } from '@/components/team-switcher';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { ClientOnly, Link, useNavigate, useRouterState } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Home, CalendarDays, UsersRound, BookOpen, UserRound, Plus, Sparkles, ArrowUpRight, Megaphone, Flag, X, CircleHelp, Compass, BarChart3 } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { profileQuery, workspaceQuery, initialsOf, firstName } from '@/lib/account';
import { roleAllows } from '@/lib/workspace';
import type { WorkspaceRole } from '@/components/workspace-settings';
import { useFeature } from '@/lib/feature-flags';
import { ListSkeleton, QueryFeedback } from '@/components/launch-states';

type Theme = 'system' | 'light' | 'dark';
type Creation = 'event' | 'announcement' | 'challenge' | 'training' | 'profile' | 'team' | 'learn';
const AppContext = createContext<{ openCreate: () => void; openPlaceholder: (kind: Creation) => void; openDetail: (title: string, description: string) => void; theme: Theme; setTheme: (theme: Theme) => void; userId: string }>({ userId: '', openCreate: () => {}, openPlaceholder: () => {}, openDetail: () => {}, theme: 'system', setTheme: () => {} });
export const useGatherwell = () => useContext(AppContext);
const tabs = [{ key: 'home', path: '/home', icon: Home }, { key: 'events', path: '/events', icon: CalendarDays }, { key: 'team', path: '/team', icon: UsersRound }, { key: 'learn', path: '/learn', icon: BookOpen }, { key: 'me', path: '/me', icon: UserRound }] as const;
const guestTabs = [{ key: 'home', path: '/home', icon: Home }, { key: 'discover', path: '/discover', icon: Compass }, { key: 'circles', path: '/circles', icon: UsersRound }, { key: 'learn', path: '/learn', icon: BookOpen }, { key: 'progress', path: '/progress', icon: BarChart3 }, { key: 'me', path: '/me', icon: UserRound }] as const;
const creations = [{ key: 'event', icon: CalendarDays }, { key: 'announcement', icon: Megaphone }, { key: 'challenge', icon: Flag }, { key: 'training', icon: BookOpen }] as const;
export function GatherwellShell({ children, userId }: { children: ReactNode; userId: string }) {
 const { t } = useTranslation();
 const { data: profile } = useQuery(profileQuery(userId));
 const { data: workspace } = useQuery(workspaceQuery(userId));
 const initials = initialsOf(profile?.full_name);
 const pathname = useRouterState({ select: state => state.location.pathname });
 const [sheet, setSheet] = useState<'create' | 'assistant' | Creation | null>(null);
 const [detail, setDetail] = useState<{ title: string; description: string } | null>(null);
 const [memberView, setMemberView] = useState(false);
 const navigate = useNavigate();
 const { data: unread = 0 } = useQuery({
   queryKey: ['notifications-unread'],
   queryFn: async () => (await supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null)).count ?? 0,
   refetchInterval: 60_000,
 });
 const [theme, updateTheme] = useState<Theme>('system');
 const [ready, setReady] = useState(false);
 const [learnOn] = useFeature('feature_learn');
 const wsRole = workspace ? ((workspace.ownerId === userId ? 'owner' : workspace.workspaceRole) as 'owner' | WorkspaceRole) : null;
 const canContent = workspace?.role === 'leader' || roleAllows(wsRole, 'content');
 const canManageTeam = workspace?.role === 'leader' || roleAllows(wsRole, 'members');
 const coachTabs = [...tabs.slice(0, 4), ...(canContent || canManageTeam ? [{ key: 'communications', path: '/communications', icon: Megaphone } as const] : []), tabs[4]];
 const navTabs = (profile?.role_intent === 'guest' ? guestTabs : coachTabs).filter(tab => tab.key !== 'learn' || learnOn);
 const isActive = (path: string) => pathname === path || (pathname.startsWith(`${path}/`));
 const current = navTabs.find(tab => isActive(tab.path)) ?? tabs[0];
 useEffect(() => {
  const stored = localStorage.getItem('gatherwell-theme');
  if (stored === 'dark' || stored === 'light' || stored === 'system') updateTheme(stored);
  setReady(true);
 }, []);
 useEffect(() => {
  if (!ready) return;
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const apply = () => { document.documentElement.classList.toggle('dark', theme === 'dark' || (theme === 'system' && media.matches)); };
  apply();media.addEventListener('change', apply);return () => media.removeEventListener('change', apply);
 }, [theme, ready]);
 const setTheme = (value: Theme) => { updateTheme(value); localStorage.setItem('gatherwell-theme', value); };
 const openSheet = (value: 'create' | 'assistant' | Creation) => { setDetail(null); setSheet(value); };
 return <AppContext.Provider value={{ openCreate: () => openSheet('create'), openPlaceholder: openSheet, openDetail: (title, description) => { setDetail({ title, description }); setSheet('profile'); }, theme, setTheme, userId }}>
  <div className="min-h-dvh bg-background text-foreground">
   <aside className="desktop-sidebar">
    <Link to="/home" className="brand" aria-label={t('brand')}><BrandLogo /><span className="sr-only">{t('brand')}</span></Link>
    <div className="workspace-card"><span className="initial-avatar" aria-label={profile?.full_name ?? t('common.you')}>{initials}</span><div><strong>{workspace?.name ?? t('workspace.none')}</strong><p>{workspace ? t(`plans.${workspace.plan}`) : profile?.full_name}</p></div></div>
    <TeamSwitcher userId={userId} className="sidebar-switcher" />
    <nav className="sidebar-nav" aria-label={t('nav.label')}>{navTabs.map(({ key, path, icon: Icon }) => <Link key={key} to={path} activeOptions={{ exact: true }} className={`sidebar-link ${isActive(path) ? 'is-active' : ''}`}><Icon /><span>{t(`nav.${key}`)}</span></Link>)}{profile?.role_intent !== 'guest' && <Link to="/discover" className="sidebar-link"><GwIcon name="Compass"/><span>{t('marketing.discover')}</span></Link>}</nav>
   </aside>
   <div className="app-main">
    <header className="app-header">
     <Link to="/home" className="brand mobile-brand"><BrandLogo /><span className="sr-only">{t('brand')}</span></Link>
     <span className="desktop-header-label">{t('common.workspaceLabel')}<span>/</span><strong>{t(`nav.${current.key}`)}</strong></span>
     <div className="header-actions"><Link to="/notifications" className="header-bell" aria-label={t('notifications.title')}><GwIcon name="Bell" size={20}/>{unread > 0 && <span className="header-bell-badge" aria-label={t('notifications.unread')}>{unread > 99 ? '99+' : unread}</span>}</Link><Link to="/discover" className="gw-app-discover" aria-label={t('marketing.discover')}><GwIcon name="Compass" size={20}/><span>{t('marketing.discover')}</span></Link><Button variant="ghost" size="icon" className="assistant-button" aria-label={t('common.assistant')} title={t('common.assistant')} onClick={() => openSheet('assistant')}><Sparkles /></Button><Link to="/me" className="header-avatar" aria-label={t('me.profile')}>{initials}</Link></div>
    </header>
    <main id="main-content" className="page-content"><ClientOnly fallback={<ListSkeleton />}><PlatformNotices teamId={workspace?.teamId} /><QueryFeedback /><div key={pathname} className="page-transition">{children}</div></ClientOnly></main>
   </div>
   {userId && <ClientOnly><BadgeEarnedWatcher /><PushPrompt userId={userId} /></ClientOnly>}
   {pathname !== '/me' && <Button size="icon" className="floating-create" onClick={() => openSheet('create')} aria-label={t('common.create')} title={t('common.create')}><Plus /></Button>}
   <nav className={`bottom-nav ${navTabs.length > 5 ? 'expanded-nav' : ''} ${profile?.role_intent === 'guest' ? 'attendee-nav' : ''}`} aria-label={t('nav.label')}>{navTabs.map(({ key, path, icon: Icon }) => <Link key={key} to={path} activeOptions={{ exact: true }} className={`bottom-link ${isActive(path) ? 'is-active' : ''}`}><Icon /><span>{t(`nav.${key}`)}</span></Link>)}</nav>
   {userId && <ClientOnly><AssistantPanel open={sheet === 'assistant'} onOpenChange={o => setSheet(o ? 'assistant' : null)} screen={current.key as typeof tabs[number]['key']} name={firstName(profile?.full_name)} /></ClientOnly>}
    {sheet !== null && sheet !== 'assistant' && <Drawer open onOpenChange={open => { if (!open) { setSheet(null); setDetail(null); } }} shouldScaleBackground={false}>
    <DrawerContent className="gatherwell-sheet"><div className="sheet-heading"><div><DrawerTitle>{detail ? detail.title : sheet === 'create' ? t('create.title') : sheet ? t(`placeholder.${sheet}`) : ''}</DrawerTitle><DrawerDescription className={sheet === 'create' ? 'mt-3' : 'sr-only'}>{sheet === 'create' ? t('create.description') : t('common.comingSoon')}</DrawerDescription></div><Button variant="ghost" size="icon" onClick={() => setSheet(null)} aria-label={t('common.close')}><X /></Button></div>
    {sheet === 'create' ? <>{workspace && <FromYourLeader compact teamId={workspace.teamId} role={workspace.role} onLaunch={tpl => { setSheet(null); void navigate({ to: '/gathering/new', search: { template: tpl.id } }); }} />}<div className="creation-options">{creations.filter(c => c.key === 'event' || (c.key === 'training' && canContent && learnOn) || ((c.key === 'challenge' || c.key === 'announcement') && canManageTeam)).map(({ key, icon: Icon }) => <Button key={key} variant="ghost" className="creation-option" onClick={() => { if (key === 'event') { setSheet(null); void navigate({ to: '/gathering/new' }); } else if (key === 'challenge' && canManageTeam) { setSheet(null); void navigate({ to: '/team', hash: 'challenges' }); } else if (key === 'training' && canContent) { setSheet(null); void navigate({ to: '/learn/manage' }); } else if (key === 'announcement' && canManageTeam) { setSheet(null); void navigate({ to: '/team', hash: 'announce' }); } else openSheet(key); }}><span className="creation-icon"><Icon /></span><span><strong>{t(`create.${key}`)}</strong><small>{t(`create.${key}Text`)}</small></span><ArrowUpRight /></Button>)}</div></> : <div className="placeholder-state"><span className="chip sample-badge">{t('common.sample')}</span>{detail && <p>{detail.description}</p>}<p>{detail ? t('common.previewNote') : t('common.comingSoon')}</p></div>}
    </DrawerContent>
   </Drawer>}
  </div>
 </AppContext.Provider>;
}
