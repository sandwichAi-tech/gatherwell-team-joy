import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Link, useRouterState } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Home, CalendarDays, UsersRound, BookOpen, UserRound, Plus, Sparkles, ArrowUpRight, Megaphone, Flag, X, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import i18n from '@/lib/i18n';

type Theme = 'system' | 'light' | 'dark';
type Creation = 'event' | 'announcement' | 'challenge' | 'training' | 'profile' | 'team' | 'learn';
const AppContext = createContext<{ openCreate: () => void; openPlaceholder: (kind: Creation) => void; theme: Theme; setTheme: (theme: Theme) => void }>({ openCreate: () => {}, openPlaceholder: () => {}, theme: 'system', setTheme: () => {} });
export const useGatherwell = () => useContext(AppContext);
const tabs = [
  { key: 'home', path: '/', icon: Home },
  { key: 'events', path: '/events', icon: CalendarDays },
  { key: 'team', path: '/team', icon: UsersRound },
  { key: 'learn', path: '/learn', icon: BookOpen },
  { key: 'me', path: '/me', icon: UserRound },
] as const;
const creations = [ { key: 'event', icon: CalendarDays }, { key: 'announcement', icon: Megaphone }, { key: 'challenge', icon: Flag }, { key: 'training', icon: BookOpen } ] as const;

export function GatherwellShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const pathname = useRouterState({ select: state => state.location.pathname });
  const [sheet, setSheet] = useState<'create' | 'assistant' | Creation | null>(null);
  const [theme, updateTheme] = useState<Theme>('system');
  const [ready, setReady] = useState(false);
  const current = tabs.find(tab => tab.path === pathname) ?? tabs[0];
  useEffect(() => {
    const language = localStorage.getItem('gatherwell-language') ?? (navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en');
    void i18n.changeLanguage(language);
    const stored = localStorage.getItem('gatherwell-theme');
    if (stored === 'dark' || stored === 'light' || stored === 'system') updateTheme(stored);
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      document.documentElement.classList.toggle('dark', theme === 'dark' || (theme === 'system' && media.matches));
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme, ready]);
  useEffect(() => {
    const applyLanguage = () => { document.documentElement.lang = i18n.resolvedLanguage ?? 'en'; };
    applyLanguage();
    i18n.on('languageChanged', applyLanguage);
    return () => { i18n.off('languageChanged', applyLanguage); };
  }, []);
  const setTheme = (value: Theme) => { updateTheme(value); localStorage.setItem('gatherwell-theme', value); };
  return (
    <AppContext.Provider value={{ openCreate: () => setSheet('create'), openPlaceholder: kind => setSheet(kind), theme, setTheme }}>
      <div className="min-h-dvh bg-background text-foreground">
        <aside className="desktop-sidebar">
          <Link to="/" className="brand" aria-label={t('brand')}><span className="brand-mark" aria-hidden="true">g<span>✳</span></span><span>{t('brand')}</span></Link>
          <p className="sidebar-tagline">{t('common.yourSpace')}</p>
          <nav className="sidebar-nav" aria-label={t('nav.label')}>
            {tabs.map(({ key, path, icon: Icon }) => <Link key={key} to={path} activeOptions={{ exact: true }} className={`sidebar-link ${pathname === path ? 'is-active' : ''}`}><Icon size={21} strokeWidth={1.8} /><span>{t(`nav.${key}`)}</span>{pathname === path && <span className="active-dot" />}</Link>)}
          </nav>
          <div className="sidebar-bottom"><div className="sidebar-flower" aria-hidden="true">✳</div><p>{t('tagline')}</p><div className="sidebar-profile"><div className="avatar"><UserRound size={20} /></div><div><strong>{t('common.hello')}</strong><span>{t('common.you')}</span></div><Link to="/me" aria-label={t('me.profile')}><ArrowUpRight size={19} /></Link></div></div>
        </aside>
        <div className="app-main">
          <header className="app-header">
            <Link to="/" className="brand mobile-brand"><span className="brand-mark" aria-hidden="true">g<span>✳</span></span><span>{t('brand')}</span></Link>
            <span className="desktop-header-label">{t(`nav.${current.key}`)}</span>
            <div className="header-actions"><Button variant="secondary" size="icon" className="assistant-button" aria-label={t('common.assistant')} title={t('common.assistant')} onClick={() => setSheet('assistant')}><Sparkles size={21} /></Button><Link to="/me" className="header-avatar" aria-label={t('me.profile')}><UserRound size={20} /></Link></div>
          </header>
          <main className="page-content"><div key={pathname} className="page-transition">{children}</div></main>
        </div>
        <Button size="icon" className="floating-create" onClick={() => setSheet('create')} aria-label={t('common.create')} title={t('common.create')}><Plus size={28} strokeWidth={2} /></Button>
        <nav className="bottom-nav" aria-label={t('nav.label')}>{tabs.map(({ key, path, icon: Icon }) => <Link key={key} to={path} activeOptions={{ exact: true }} className={`bottom-link ${pathname === path ? 'is-active' : ''}`}><Icon size={22} strokeWidth={pathname === path ? 2.3 : 1.7} /><span>{t(`nav.${key}`)}</span></Link>)}</nav>
        <Drawer open={sheet !== null} onOpenChange={open => { if (!open) setSheet(null); }} shouldScaleBackground={false}>
          <DrawerContent className="gatherwell-sheet">
            <div className="sheet-heading"><div><DrawerTitle>{sheet === 'create' ? t('create.title') : sheet === 'assistant' ? t('common.assistant') : sheet ? t(`placeholder.${sheet}`) : ''}</DrawerTitle><DrawerDescription className={sheet === 'create' ? 'mt-3' : 'sr-only'}>{sheet === 'create' ? t('create.description') : t('common.comingSoon')}</DrawerDescription></div><Button variant="ghost" size="icon" onClick={() => setSheet(null)} aria-label={t('common.close')}><X size={21} /></Button></div>
            {sheet === 'create' ? <div className="creation-options">{creations.map(({ key, icon: Icon }) => <Button key={key} variant="ghost" className="creation-option" onClick={() => setSheet(key)}><span className={`creation-icon creation-${key}`}><Icon size={24} /></span><span><strong>{t(`create.${key}`)}</strong><small>{t(`create.${key}Text`)}</small></span><ArrowUpRight size={20} /></Button>)}</div> : sheet === 'assistant' ? <div className="empty-assistant" /> : <div className="placeholder-state"><Heart size={36} /><p>{t('common.comingSoon')}</p></div>}
          </DrawerContent>
        </Drawer>
      </div>
    </AppContext.Provider>
  );
}
