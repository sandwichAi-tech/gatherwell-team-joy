import { ResponsiveSheet } from '@/components/responsive-sheet';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { BrandImage } from '@/components/brand-image';
import { CATEGORY_ICONS, GwIcon } from '@/components/gw-icon';
import { AvatarStack, GatheringCard, RsvpButton, type Coords } from '@/components/landing/gathering-card';
import { StaticHeroStack, type HeroItem } from '@/components/landing/hero-stack';
import { LandingFrame, StickyFindBar } from '@/components/landing/landing-chrome';
import { LocationFilter, sortForFeed } from '@/components/landing/location-filter';
import { CATEGORIES, distanceKm, HERO_SLOTS, inNextDays, pickH1Variant, featureFlagsQuery, publicGatheringsQuery, socialProofQuery, testimonialsQuery, track, type Category, type FeedGathering, type H1Variant } from '@/lib/landing';
import { QueryFeedback } from '@/components/launch-states';
import { Button } from '@/components/ui/button';

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
      <CategoryRow selected={category} onSelect={setCategory} />
      <ThisWeek gatherings={gatherings} category={category} />
      <HowItWorks />
      <HostBand />
      <LeadersBand />
      <Testimonials />
    </main>
    <StickyFindBar heroId="hero" />
  </LandingFrame>;
}

function Headline({ variant }: { variant: H1Variant }) {
  const { t } = useTranslation();
  if (variant !== 'A') return <h1 className="gw-display gw-hero-h1">{t(`landing.hero.h1${variant}`)}</h1>;
  return <h1 className="gw-display gw-hero-h1">{t('landing.hero.h1A_before')}<em className="gw-accent">{t('landing.hero.h1A_accent')}</em>{t('landing.hero.h1A_after')}</h1>;
}

function Hero({ gatherings }: { gatherings: FeedGathering[] }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [picked] = useState(pickH1Variant);
  const { data: flags } = useQuery(featureFlagsQuery());
  const forced = flags?.['landing_headline'];
  const variant: H1Variant = forced?.enabled && ['A', 'B', 'C', 'D'].includes(forced.value ?? '') ? forced.value as H1Variant : picked;
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
        <Headline variant={variant} />
        <p className="gw-lede">{t('landing.hero.sub')}</p>
        <div className="gw-hero-ctas">
          <button type="button" className="gw-btn gw-btn-primary gw-btn-lg" onClick={() => { track('hero_find_click', { variant }); void navigate({ to: '/discover', search: { near: 1 } }); }}>{t('landing.hero.find')}<GwIcon name="ArrowRight" size={18} /></button>
          <Link to="/hosts" className="gw-btn gw-btn-secondary gw-btn-lg" onClick={() => track('hero_host_click', { variant })}>{t('landing.hero.host')}</Link>
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
        return <button key={c} type="button" className={`gw-cat ${on ? 'is-on' : ''}`} aria-pressed={on} onClick={() => { track('category_click', { category: c }); if (c === 'more') setAllOpen(true); else onSelect(on ? null : c); }}>
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

function HowItWorks() {
  const { t, i18n } = useTranslation();
  const demo: FeedGathering = { id: 'demo', isSample: true, hero: false, title: t('landing.hero.photoTitle_run'), startsAt: new Date(), category: 'run', locationName: null, isOnline: false, lat: null, lng: null, capacity: null, going: 14, goingNames: [], initials: ['M', 'J', 'S'], hostName: 'Nick C.' };
  const [rsvpKey, setRsvpKey] = useState(0);
  return <section className="gw-section gw-container gw-band gw-band-white" id="how-it-works" aria-labelledby="how-title">
    <span className="gw-label">{t('landing.how.label')}</span>
    <h2 id="how-title" className="gw-display gw-h2">{t('landing.how.title')}</h2>
    <ol className="gw-how">
      <li><div className="gw-vignette"><div className="gw-mini-card"><span className="gw-mini-icon"><GwIcon name="PersonSimpleRun" variant="marketing" size={22} /></span><div><strong>{t('landing.catOne.run')}</strong><span>{new Intl.DateTimeFormat(i18n.resolvedLanguage === 'es' ? 'es-MX' : 'en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(2026, 9, 10, 7))}</span></div><AvatarStack letters={['M', 'J', 'S']} size={22} /></div></div><span className="gw-how-num">01</span><h3>{t('landing.how.s1t')}</h3><p>{t('landing.how.s1b')}</p></li>
      <li><div className="gw-vignette" onMouseEnter={() => setRsvpKey(k => k + 1)}><RsvpButton key={rsvpKey} g={demo} /></div><span className="gw-how-num">02</span><h3>{t('landing.how.s2t')}</h3><p>{t('landing.how.s2b')}</p></li>
      <li><div className="gw-vignette"><div className="gw-checkin"><span className="gw-checkin-icon"><GwIcon name="Check" variant="marketing" size={20} /></span><div><strong>{t('landing.how.checkedIn')}</strong><span>{t('landing.how.checkedInSub')}</span></div></div></div><span className="gw-how-num">03</span><h3>{t('landing.how.s3t')}</h3><p>{t('landing.how.s3b')}</p></li>
    </ol>
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
