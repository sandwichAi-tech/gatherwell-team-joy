import { useState } from 'react';
import { ResponsiveSheet } from '@/components/responsive-sheet';
import { Button } from '@/components/ui/button';
import { CATEGORY_ICONS } from '@/components/gw-icon';
import { CATEGORIES, type Category } from '@/lib/landing';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { GwIcon } from '@/components/gw-icon';
import { HomeCarousel } from '@/components/landing/home-carousel';
import { LandingFrame, StickyFindBar } from '@/components/landing/landing-chrome';
import { track } from '@/lib/landing';
import { QueryFeedback } from '@/components/launch-states';
import { HOME_DISCOVER_PATHS, HOME_TOOL_CARDS } from '@/lib/homepage';

export function LandingPage() {
  return <LandingFrame>
    <main id="main-content" className="gw-home">
      <Hero />
      <HomeCarousel />
      <QueryFeedback />
      <div id="for-hosts" className="gw-home-anchor">
        <Toolkit />
      </div>
      <AttendeeBand />
      <FinalCta />
    </main>
    <StickyFindBar heroId="hero" mode="host" />
  </LandingFrame>;
}

/** Primary host-first action: signed-out visitors go through sign-in/onboarding and land on event creation. */
function CreateEvent({ className = 'gw-btn gw-btn-primary gw-btn-lg', where }: { className?: string; where: string }) {
  const { t } = useTranslation();
  return <Link to="/login" search={{ intent: 'host' }} className={className} onClick={() => track('hero_host_click', { variant: where })}>{t('home.cta.createEvent')}<GwIcon name="ArrowRight" size={18} /></Link>;
}

function Hero() {
  const { t } = useTranslation();
  return <section className="gw-hero gw-home-hero" id="hero" aria-labelledby="home-h1">
    <div className="gw-container">
      <span className="gw-label">{t('home.hero.eyebrow')}</span>
      <h1 id="home-h1" className="gw-display gw-hero-h1">{t('home.hero.title')}</h1>
      <p className="gw-lede">{t('home.hero.lede')}</p>
      <div className="gw-hero-ctas">
        <CreateEvent where="hero" />
        <Link to="/discover" className="gw-btn gw-btn-secondary gw-btn-lg" onClick={() => track('hero_find_click', { variant: 'hero' })}>{t('home.cta.discover')}</Link>
      </div>
      <p className="gw-home-tagline">{t('home.hero.tagline')}</p>
    </div>
  </section>;
}

function Toolkit() {
  const { t } = useTranslation();
  return <section className="gw-home-sec gw-band gw-band-canvas" id="tools" aria-labelledby="tools-title"><div className="gw-container">
    <span className="gw-label">{t('home.tools.label')}</span>
    <h2 id="tools-title" className="gw-display gw-h2">{t('home.tools.title')}</h2>
    <ul className="gw-home-cards">{HOME_TOOL_CARDS.map(c => <li key={c.key}>
      <a href={c.href} className="gw-home-tool" onClick={() => track('home_tool_click', { tool: c.key })}>
        <span className="gw-home-tool-icon" aria-hidden="true"><GwIcon name={c.icon} variant="marketing" size={20} /></span>
        <span className="gw-home-tool-body">
          <h3>{t(`home.tools.cards.${c.key}.title`)}</h3>
          <p>{t(`home.tools.cards.${c.key}.body`)}</p>
          <span className="gw-home-tool-cta">{t(`home.tools.cards.${c.key}.cta`)}<GwIcon name="ArrowRight" size={16} /></span>
        </span>
      </a>
    </li>)}</ul>
    <Link to="/hosts" className="gw-see-all">{t('home.tools.seeAll')}<GwIcon name="ArrowRight" size={16} /></Link>
  </div></section>;
}

function AttendeeBand() {
  const { t } = useTranslation();
  return <section className="gw-home-sec gw-band gw-band-white" aria-labelledby="att-title"><div className="gw-container">
    <h2 id="att-title" className="gw-display gw-h2">{t('home.attend.title')}</h2>
    <p className="gw-home-attend-lede">{t('home.attend.body')}</p>
    <ul className="gw-home-paths">{HOME_DISCOVER_PATHS.map(p => <li key={p.key}>
      <a href={p.href} className="gw-home-path" onClick={() => track('home_discover_path_click', { path: p.key })}>
        <span className="gw-home-tool-icon" aria-hidden="true"><GwIcon name={p.icon} variant="marketing" size={20} /></span>
        <span>{t(`home.attend.paths.${p.key}`)}</span>
        <GwIcon name="ArrowRight" size={16} />
      </a>
    </li>)}</ul>
  </div></section>;
}

function FinalCta() {
  const { t } = useTranslation();
  return <section className="gw-home-sec gw-band gw-band-canvas" aria-labelledby="final-title"><div className="gw-container gw-home-final">
    <h2 id="final-title" className="gw-display gw-h2">{t('home.final.title')}</h2>
    <div className="gw-final-ctas"><CreateEvent where="final" /><Link to="/discover" className="gw-btn gw-btn-secondary gw-btn-lg">{t('home.cta.exploreAll')}</Link></div>
    <p className="gw-home-priceline">{t('home.pricing.teaser')} <Link to="/pricing" className="gw-textlink">{t('home.pricing.see')}</Link></p>
    <p className="gw-fine">{t('home.trust.line')}</p>
  </div></section>;
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
