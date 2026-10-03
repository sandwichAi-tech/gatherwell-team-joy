import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Plus, Sun, CalendarDays, Sparkles, Heart, Globe2, Moon, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGatherwell } from './gatherwell-shell';
import i18n from '@/lib/i18n';
import gathering from '@/assets/gathering.jpg';
import people from '@/assets/people.jpg';

export function HomePage() {
  const { t } = useTranslation();
  const { openPlaceholder } = useGatherwell();
  return <>
    <div className="greeting"><div className="eyebrow"><Sun size={15} />{t('home.eyebrow')}</div><h1>{t('home.greeting', { name: t('common.friend') })}<span className="greeting-sun" aria-hidden="true">☀</span></h1><p>{t('home.subtitle')}</p></div>
    <section className="gathering-cover" aria-label={t('home.heroTitle')}><img src={gathering} width={1536} height={1024} alt={t('common.gatheringAlt')} /><div className="cover-shade" /><div className="cover-copy"><span className="cover-eyebrow"><span aria-hidden="true">✳</span>{t('brand')}</span><h2>{t('home.heroTitle')}</h2><p>{t('home.heroText')}</p><Button onClick={() => openPlaceholder('event')}>{t('home.heroButton')}<ArrowUpRightIcon /></Button></div></section>
    <section className="next-section"><div className="section-heading"><h2>{t('home.next')}</h2><Sparkles size={19} className="text-primary" /></div><div className="next-card"><div className="next-icon" aria-hidden="true"><span className="mini-star">✳</span><CalendarDays size={31} strokeWidth={1.5} /><span className="mini-heart"><Heart size={15} fill="currentColor" /></span></div><div className="next-copy"><span className="eyebrow">{t('home.nextLabel')}</span><h3>{t('home.nextTitle')}</h3><p>{t('home.nextText')}</p><Button onClick={() => openPlaceholder('event')}>{t('home.nextButton')}<Plus size={18} /></Button></div></div></section>
    <section className="horizon-section"><div className="section-heading"><h2>{t('home.upcoming')}</h2><Button asChild variant="ghost" className="view-all"><Link to="/events">{t('home.viewAll')}<ArrowRight size={16} /></Link></Button></div><div className="horizon-empty"><span className="empty-calendar"><CalendarDays size={24} strokeWidth={1.5} /></span><h3>{t('home.emptyTitle')}</h3><p>{t('home.emptyText')}</p><span className="empty-spark" aria-hidden="true">✧</span></div></section>
    <p className="home-footer"><Heart size={12} />{t('home.footer')}</p>
  </>;
}
function ArrowUpRightIcon() { return <ArrowRight size={18} className="-rotate-45" />; }

export function EmptyPage({ page }: { page: 'events' | 'team' | 'learn' | 'me' }) {
  const { t } = useTranslation();
  const { openPlaceholder, theme, setTheme } = useGatherwell();
  const actions = { events: 'event', team: 'team', learn: 'learn', me: 'profile' } as const;
  const changeLanguage = (language: 'en' | 'es') => { void i18n.changeLanguage(language); localStorage.setItem('gatherwell-language', language); };
  return <>
    <div className="page-title"><span className="eyebrow">{t(`${page}.eyebrow`)}</span><h1>{t(`${page}.title`)}</h1></div>
    <section className="friendly-empty"><div className={`illustration illustration-${page}`}><img src={people} width={1024} height={1024} alt={t('common.peopleAlt')} /></div><h2>{t(`${page}.heading`)}</h2><p>{t(`${page}.sentence`)}</p><Button onClick={() => openPlaceholder(actions[page])}>{t(`${page}.button`)}<Plus size={18} /></Button></section>
    {page === 'me' && <section className="preferences"><h2>{t('me.preferences')}</h2><div className="preference-row"><div className="preference-label"><Globe2 size={20} /><span>{t('me.language')}</span></div><div className="segmented" role="group" aria-label={t('me.language')}>{(['en', 'es'] as const).map(lang => <Button key={lang} variant="ghost" aria-pressed={i18n.resolvedLanguage === lang} className={i18n.resolvedLanguage === lang ? 'selected' : ''} onClick={() => changeLanguage(lang)}>{t(lang === 'en' ? 'me.english' : 'me.spanish')}</Button>)}</div></div><div className="preference-row"><div className="preference-label"><Sun size={20} /><span>{t('me.appearance')}</span></div><div className="segmented" role="group" aria-label={t('me.appearance')}>{([{ value: 'light', Icon: Sun }, { value: 'dark', Icon: Moon }, { value: 'system', Icon: Monitor }] as const).map(({ value, Icon }) => <Button key={value} variant="ghost" size="icon" className={theme === value ? 'selected' : ''} aria-pressed={theme === value} aria-label={t(`me.${value}`)} title={t(`me.${value}`)} onClick={() => setTheme(value)}><Icon size={19} /></Button>)}</div></div></section>}
  </>;
}
