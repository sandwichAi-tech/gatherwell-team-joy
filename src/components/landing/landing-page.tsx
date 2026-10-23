import { ResponsiveSheet } from '@/components/responsive-sheet';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { BrandImage } from '@/components/brand-image';
import { CATEGORY_ICONS, GwIcon, type GwIconName } from '@/components/gw-icon';
import { AvatarStack, GatheringCard, type Coords } from '@/components/landing/gathering-card';
import { StaticHeroStack, type HeroItem } from '@/components/landing/hero-stack';
import { LandingFrame, StickyFindBar } from '@/components/landing/landing-chrome';
import { LocationFilter, sortForFeed } from '@/components/landing/location-filter';
import { CATEGORIES, distanceKm, HERO_SLOTS, inNextDays, featureFlagsQuery, publicGatheringsQuery, socialProofQuery, testimonialsQuery, track, type Category, type FeedGathering } from '@/lib/landing';
import { QueryFeedback } from '@/components/launch-states';
import { Button } from '@/components/ui/button';
import { WhoItsFor } from '@/components/landing/marketing-pages';

const LiveStack = lazy(() => import('@/components/landing/live-stack'));
const PHOTO_CATEGORIES: Category[] = ['run', 'fitcamp', 'pilates', 'pickleball'];

export function LandingPage() {
  const { i18n } = useTranslation();
  const lang = i18n.resolvedLanguage === 'es' ? 'es' : 'en';
  const { data: gatherings = [] } = useQuery(publicGatheringsQuery(lang));
  const [category, setCategory] = useState<Category | null>(null);
  return <LandingFrame>
    <main id="main-content">
      <Hero gatherings={gatherings} />
      <QueryFeedback />
      <HomepagePaths />
      <HowItWorks />
      <HostTools />
      <CategoryRow selected={category} onSelect={setCategory} />
      <ThisWeek gatherings={gatherings} category={category} />
      <WhoItsFor />
      <HostBand />
      <LeadersBand />
      <Testimonials />
    </main>
    <StickyFindBar heroId="hero" />
  </LandingFrame>;
}

function Headline() {
  const { t } = useTranslation();
  return <h1 className="gw-display gw-hero-h1">{t('landing.hero.h1A_before')}<em className="gw-accent">{t('landing.hero.h1A_accent')}</em>{t('landing.hero.h1A_after')}</h1>;
}

function Hero({ gatherings }: { gatherings: FeedGathering[] }) {
  const { t } = useTranslation();
  const { data: showedUp = 0 } = useQuery(socialProofQuery());
  const [animate, setAnimate] = useState(false);
  useEffect(() => { const id = window.requestAnimationFrame(() => setAnimate(true)); return () => window.cancelAnimationFrame(id); }, []);

  const items = useMemo<HeroItem[]>(() => {
    const samples = gatherings.filter(g => g.isSample && g.hero);
    const real = gatherings.filter(g => !g.isSample).slice(0, 4);
    const pool = real.length ? real : samples;
    return HERO_SLOTS.map((slot, i) => pool[i]
      ? { key: `g-${pool[i].id}`, slot, kind: 'gathering' as const, g: pool[i] }
      : { key: `p-${slot}`, slot, kind: 'photo' as const, category: PHOTO_CATEGORIES[i] ?? 'more' });
  }, [gatherings]);
  const initials = gatherings.filter(g => !g.isSample).flatMap(g => g.initials).slice(0, 4);

  return <section className="gw-hero" id="hero">
    <div className="gw-aurora" aria-hidden="true"><span className="gw-blob gw-blob-lav" /><span className="gw-blob gw-blob-peach" /><span className="gw-glow" /></div>
    <div className="gw-container gw-hero-grid">
      <div className="gw-hero-copy">
        <span className="gw-label">{t('landing.hero.label')}</span>
        <Headline />
        <p className="gw-lede">{t('landing.hostFirst.intro')}</p>
        <div className="gw-hero-ctas">
          <Button asChild className="gw-btn gw-btn-lg"><Link to="/login" search={{ intent: 'host' }} onClick={() => track('hero_host_click', { variant: 'A' })}>{t('landing.hostFirst.start')}<GwIcon name="ArrowRight" size={18} /></Link></Button>
          <Button asChild variant="secondary" className="gw-btn gw-btn-lg"><Link to="/discover" search={{ near: 1 }} onClick={() => track('hero_find_click', { variant: 'A' })}>{t('landing.hostFirst.find')}</Link></Button>
        </div>
        {showedUp >= 50 && <p className="gw-proof">{initials.length > 0 && <AvatarStack letters={initials} size={32} />}<span>{t('landing.hero.proof', { count: showedUp })}</span></p>}
      </div>
      <div className="gw-hero-visual">
        {animate ? <Suspense fallback={<StaticHeroStack items={items} />}><LiveStack items={items} /></Suspense> : <StaticHeroStack items={items} />}
      </div>
    </div>
  </section>;
}

export function CategoryRow({ selected, onSelect }: { selected: Category | null; onSelect: (c: Category | null) => void }) {
  const { t } = useTranslation();
  const [allOpen, setAllOpen] = useState(false);
  const display: Category[] = ['run', 'fitcamp', 'yoga', 'pilates', 'hike', 'walk', 'pickleball', 'more'];
  return <section className="gw-band gw-band-white gw-cat-section"><div className="gw-container">
    <div className="gw-cat-row" role="group" aria-label={t('landing.cat.rowLabel')}>
      {display.map(c => {
        const on = selected === c;
        return <button key={c} type="button" className={`gw-cat ${on ? 'is-on' : ''}`} aria-pressed={on} onClick={() => { if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(10); track('category_click', { category: c }); if (c === 'more') setAllOpen(true); else onSelect(on ? null : c); }}>
          <span className="gw-cat-circle"><GwIcon name={CATEGORY_ICONS[c]} variant="marketing" size={32} /></span>
          <span className="gw-cat-label">{t(`landing.cat.${c}`)}</span>
        </button>;
      })}
    </div>
    <ResponsiveSheet open={allOpen} onOpenChange={setAllOpen} title={t('marketing.allCategories')} icon="SquaresFour">
      <div className="gw-category-options">{CATEGORIES.map(c => <Button key={c} variant="secondary" onClick={() => { onSelect(c); setAllOpen(false); track('category_click', { category: c }); }}><GwIcon name={CATEGORY_ICONS[c]} variant="marketing" size={24}/>{t(c === 'more' ? 'marketing.other' : `landing.cat.${c}`)}</Button>)}</div>
    </ResponsiveSheet>
  </div></section>;
}

function ThisWeek({ gatherings, category }: { gatherings: FeedGathering[]; category: Category | null }) {
  const { t } = useTranslation();
  const [near, setNear] = useState<Coords | null>(null);
  const week = gatherings.filter(g => inNextDays(g.startsAt, 7) && (!category || g.category === category));
  const list = sortForFeed(week, near, distanceKm).slice(0, 8);
  const hasSamples = list.some(g => g.isSample);
  return <section className="gw-section gw-container gw-band gw-band-canvas gw-weekly" aria-labelledby="this-week-title">
    <div className="gw-section-head">
      <div><span className="gw-label">{near ? t('landing.feed.label') : t('landing.feed.popular')}</span><h2 id="this-week-title" className="gw-display gw-h2">{t('landing.feed.title')}</h2></div>
      <Link to="/discover" search={category ? { cat: category } : {}} className="gw-see-all gw-weekly-desktop-link">{t('landing.feed.seeAll')}<GwIcon name="ArrowRight" size={16} /></Link>
    </div>
    <LocationFilter near={near} onNear={setNear} />
    {list.length ? <div className="gw-feed">{list.map(g => <GatheringCard key={g.id} g={g} near={near} showRsvp className="gw-feed-card" />)}</div>
      : <div className="gw-empty"><p>{category ? t('landing.feed.emptyCat') : t('landing.feed.empty')}</p><Link to="/login" search={{ intent: 'host' }} className="gw-btn gw-btn-secondary">{t('landing.feed.hostFirst')}</Link></div>}
    {hasSamples && <p className="gw-fine">{t('landing.feed.sampleNote')}</p>}
    <Button asChild variant="secondary" className="gw-weekly-mobile-link">
      <Link to="/discover" search={category ? { cat: category } : {}}>{t('landing.feed.seeAll')}<GwIcon name="ArrowRight" size={20} /></Link>
    </Button>
  </section>;
}

function HomepagePaths() {
  const { t } = useTranslation();
  return <section className="gw-home-paths gw-band gw-band-white"><div className="gw-container gw-home-path-grid">
    <div><h2>{t('landing.hostFirst.host')}</h2><p>{t('landing.hostFirst.hostBody')}</p><Button asChild className="gw-btn gw-btn-lg"><Link to="/login" search={{ intent: 'host' }}>{t('landing.hostFirst.start')}<GwIcon name="ArrowRight" /></Link></Button></div>
    <div><h2>{t('landing.hostFirst.attend')}</h2><p>{t('landing.hostFirst.attendBody')}</p><Button asChild variant="secondary" className="gw-btn gw-btn-lg"><Link to="/discover" search={{ near: 1 }}>{t('landing.hostFirst.find')}<GwIcon name="MapPin" /></Link></Button></div>
  </div></section>;
}

function HowItWorks() {
  const { t } = useTranslation();
  const steps = [['create', 'CalendarPlus'], ['share', 'Link2'], ['checkin', 'QrCode'], ['followup', 'MessageCircle']] as const;
  return <section className="gw-section gw-container gw-band gw-band-white" id="how-it-works" aria-labelledby="how-title">
    <span className="gw-label">{t('landing.hostFirst.howLabel')}</span>
    <h2 id="how-title" className="gw-display gw-h2">{t('landing.hostFirst.howTitle')}</h2>
    <ol className="gw-home-steps">{steps.map(([key, icon], i) => <li key={key}><span className="gw-home-tool-icon"><GwIcon name={icon} variant="marketing" size={24} /></span><span className="gw-how-num">0{i + 1}</span><h3>{t(`landing.hostFirst.steps.${key}`)}</h3></li>)}</ol>
  </section>;
}

function HostTools() {
  const { t } = useTranslation();
  const tools: { key: string; icon: GwIconName; paid?: boolean; premium?: boolean }[] = [
    { key: 'pages', icon: 'CalendarDays' }, { key: 'tickets', icon: 'CreditCard', paid: true },
    { key: 'weekly', icon: 'Repeat' }, { key: 'blueprints', icon: 'Layers' },
    { key: 'guests', icon: 'UsersRound' }, { key: 'csv', icon: 'Download' },
    { key: 'checkin', icon: 'QrCode' }, { key: 'reminders', icon: 'Bell' },
    { key: 'waivers', icon: 'ShieldCheck' }, { key: 'resources', icon: 'BookOpen', paid: true },
    { key: 'hostPage', icon: 'Globe2' }, { key: 'team', icon: 'Network' },
    { key: 'sms', icon: 'MessageSquare', premium: true }, { key: 'email', icon: 'Mail', premium: true },
    { key: 'calling', icon: 'Phone', premium: true },
  ];
  return <section className="gw-section gw-container" aria-labelledby="host-tools-title">
    <h2 id="host-tools-title" className="gw-display gw-h2">{t('landing.hostFirst.toolsTitle')}</h2>
    <ul className="gw-home-tools">{tools.map(tool => <li key={tool.key}><span className="gw-home-tool-icon"><GwIcon name={tool.icon} variant="marketing" size={24} /></span><div><h3>{t(`landing.hostFirst.tools.${tool.key}`)}</h3>{tool.premium ? <span className="gw-home-tool-tag">{t('landing.hostFirst.premiumSoon')}</span> : tool.paid ? <span className="gw-home-tool-tag">{t('landing.hostFirst.paidSoon')}</span> : tool.key === 'reminders' ? <span className="gw-home-tool-tag">{t('landing.hostFirst.deliverySoon')}</span> : null}</div></li>)}</ul>
    <p className="gw-home-studio">{t('landing.hostFirst.studios')}</p>
  </section>;
}

function HostBand() {
  const { t } = useTranslation();
  const [n, setN] = useState(11);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => setN(v => (v >= 18 ? 11 : v + 1)), 2600);
    return () => window.clearInterval(id);
  }, []);
  const rows = ['Maya R.', 'Jordan P.', 'Sofía L.', 'Andre K.'];
  return <section className="gw-host-band" aria-labelledby="host-title">
    <div className="gw-container gw-host-grid">
      <div>
        <span className="gw-label on-dark">{t('landing.hostBand.label')}</span>
        <h2 id="host-title" className="gw-display gw-h2">{t('landing.hostBand.title')}</h2>
        <p>{t('landing.hostBand.body')}</p>
        <Link to="/hosts" className="gw-btn gw-btn-peach gw-btn-lg">{t('marketing.hostLink')}<GwIcon name="ArrowRight" size={20}/></Link>
      </div>
      <div className="gw-host-visual">
        <BrandImage slot="host_band" className="gw-host-bg" sizes="(min-width: 1024px) 560px, 100vw" />
        <div className="gw-phone" aria-hidden="true">
          <div className="gw-phone-head"><strong>{t('landing.hostBand.phoneTitle')}</strong><span className="chip sample-badge">{t('landing.card.sample')}</span></div>
          <div className="gw-phone-stats">
            <div><b className="tabular">{n}</b><span>{t('landing.hostBand.going')}</span></div>
            <div><b className="tabular">{Math.max(0, n - 6)}</b><span>{t('landing.hostBand.checkedIn')}</span></div>
            <div><b className="tabular">2</b><span>{t('landing.hostBand.waitlist')}</span></div>
          </div>
          <ul className="gw-phone-list">{rows.map((r, i) => <li key={r} className={i === 0 ? 'is-new' : ''}><span className={`gw-mini-avatar tone-${i % 3}`}>{r[0]}</span><span>{r}</span>{i === 0 && <em>{t('landing.hostBand.justJoined')}</em>}</li>)}</ul>
        </div>
      </div>
    </div>
  </section>;
}

function LeadersBand() {
  const { t } = useTranslation();
  return <section className="gw-section gw-container gw-leaders" aria-labelledby="leaders-title">
    <div className="gw-leaders-copy">
      <span className="gw-label">{t('landing.leaders.label')}</span>
      <h2 id="leaders-title" className="gw-display gw-h2">{t('landing.leaders.title')}</h2>
      <p>{t('landing.leaders.body')}</p>
      <Link to="/login" className="gw-btn gw-btn-secondary gw-btn-lg">{t('landing.leaders.cta')}</Link>
    </div>
    <BrandImage slot="leaders_band" className="gw-leaders-frame" aspect={4 / 3} sizes="(min-width: 1024px) 560px, 100vw" />
  </section>;
}

function Testimonials() {
  const { t, i18n } = useTranslation();
  const { data = [] } = useQuery(testimonialsQuery());
  const { data: flags } = useQuery(featureFlagsQuery());
  if (data.length < 3 || flags?.['landing_testimonials']?.enabled === false) return null;
  const es = i18n.resolvedLanguage === 'es';
  return <section className="gw-section gw-container" aria-labelledby="testimonials-title">
    <span className="gw-label">{t('landing.testimonials.label')}</span>
    <h2 id="testimonials-title" className="gw-display gw-h2">{t('landing.testimonials.title')}</h2>
    <div className="gw-posts">{data.slice(0, 6).map(item => <article key={item.id} className="gw-post">
      <header><span className="gw-mini-avatar tone-1" style={{ width: 40, height: 40, fontSize: 15 }}>{item.name[0]}</span><div><strong>{item.name}</strong>{item.city && <span>{item.city}</span>}</div></header>
      {item.photo_url && <BrandImage src={item.photo_url} alt="" aspect={4 / 3} className="gw-post-photo" sizes="360px" />}
      <p>{es && item.quote_es ? item.quote_es : item.quote_en}</p>
    </article>)}</div>
  </section>;
}
