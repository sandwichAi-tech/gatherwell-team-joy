import { useState } from 'react';
import { ResponsiveSheet } from '@/components/responsive-sheet';
import { Button } from '@/components/ui/button';
import { CATEGORY_ICONS } from '@/components/gw-icon';
import { CATEGORIES, type Category } from '@/lib/landing';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { BrandImage } from '@/components/brand-image';
import { GwIcon, type GwIconName } from '@/components/gw-icon';
import { GatheringCard } from '@/components/landing/gathering-card';
import { LandingFrame, StickyFindBar } from '@/components/landing/landing-chrome';
import { publicGatheringsQuery, track } from '@/lib/landing';
import { QueryFeedback } from '@/components/launch-states';
import { NOTIFY_ME_LIVE, ATTENDEE, AUDIENCES, HOME_PLANS, PLATFORM_FEE_PERCENT, STEPS, TOOLKIT, annualPrice, homepageOfferings } from '@/lib/homepage';

export function LandingPage() {
  return <LandingFrame>
    <main id="main-content" className="gw-home">
      <Hero />
      <QueryFeedback />
      <div id="for-hosts" className="gw-home-anchor">
        <Toolkit />
        <Steps />
      </div>
      <Audience />
      <Attendees />
      <Explore />
      <PricingSummary />
      <Trust />
      <FinalCta />
    </main>
    <StickyFindBar heroId="hero" mode="host" />
  </LandingFrame>;
}

function StartHosting({ className = 'gw-btn gw-btn-primary gw-btn-lg', where }: { className?: string; where: string }) {
  const { t } = useTranslation();
  return <Link to="/login" search={{ intent: 'host' }} className={className} onClick={() => track('hero_host_click', { variant: where })}>{t('home.cta.start')}<GwIcon name="ArrowRight" size={18} /></Link>;
}

function Hero() {
  const { t } = useTranslation();
  return <section className="gw-hero gw-home-hero" id="hero" aria-labelledby="home-h1">
    <div className="gw-container gw-hero-grid">
      <div className="gw-hero-copy">
        <span className="gw-label">{t('home.hero.tagline')}</span>
        <h1 id="home-h1" className="gw-display gw-hero-h1">{t('home.hero.title')}</h1>
        <p className="gw-lede">{t('home.hero.lede')}</p>
        <div className="gw-hero-ctas">
          <StartHosting where="hero" />
          <Link to="/discover" className="gw-btn gw-btn-secondary gw-btn-lg" onClick={() => track('hero_find_click', { variant: 'hero' })}>{t('home.cta.explore')}</Link>
        </div>
      </div>
      <div className="gw-home-hero-media"><BrandImage slot="host_band" alt="" className="gw-home-hero-photo" aspect={4 / 3} sizes="(min-width: 1024px) 520px, 100vw" priority /></div>
    </div>
  </section>;
}

function Toolkit() {
  const { t } = useTranslation();
  return <section className="gw-home-sec gw-band gw-band-canvas" id="tools" aria-labelledby="tools-title"><div className="gw-container">
    <span className="gw-label">{t('home.tools.label')}</span>
    <h2 id="tools-title" className="gw-display gw-h2">{t('home.tools.title')}</h2>
    <div className="gw-home-groups">{TOOLKIT.map(g => <details key={g.key} className="gw-home-group" open>
      <summary><span className="gw-home-tool-icon" aria-hidden="true"><GwIcon name={g.icon} variant="marketing" size={20} /></span><span><strong>{t(`home.tools.groups.${g.key}.title`)}</strong><span className="gw-home-group-sum">{t(`home.tools.groups.${g.key}.summary`)}</span>{g.soon && <span className="gw-home-tool-tag">{t('home.paymentsSoon')}</span>}</span></summary>
      <ul>{g.items.map(i => <li key={i.key}>{t(`home.tools.items.${i.key}`)}{i.soon && !g.soon && <span className="gw-home-tool-tag">{t('home.soon')}</span>}</li>)}</ul>
    </details>)}</div>
  </div></section>;
}

function Steps() {
  const { t } = useTranslation();
  const icons: GwIconName[] = ['CalendarPlus', 'Link2', 'QrCode', 'Sparkles'];
  return <section className="gw-home-sec gw-band gw-band-white" id="how-it-works" aria-labelledby="how-title"><div className="gw-container">
    <h2 id="how-title" className="gw-display gw-h2">{t('home.steps.title')}</h2>
    <ol className="gw-home-steps">{STEPS.map((k, i) => <li key={k}><span className="gw-home-tool-icon" aria-hidden="true"><GwIcon name={icons[i]!} variant="marketing" size={20} /></span><div><span className="gw-how-num" aria-hidden="true">0{i + 1}</span><h3>{t(`home.steps.${k}.title`)}</h3><p>{t(`home.steps.${k}.body`)}</p></div></li>)}</ol>
  </div></section>;
}

function Audience() {
  const { t } = useTranslation();
  return <section className="gw-home-sec gw-band gw-band-canvas" aria-labelledby="aud-title"><div className="gw-container">
    <h2 id="aud-title" className="gw-display gw-h2">{t('home.audience.title')}</h2>
    <ul className="gw-home-chips">{AUDIENCES.map(a => <li key={a}>{t(`home.audience.items.${a}`)}</li>)}</ul>
  </div></section>;
}

function Attendees() {
  const { t } = useTranslation();
  return <section className="gw-home-sec gw-band gw-band-white" aria-labelledby="att-title"><div className="gw-container">
    <span className="gw-label">{t('home.attend.label')}</span>
    <h2 id="att-title" className="gw-display gw-h2">{t('home.attend.title')}</h2>
    <ul className="gw-home-list">{ATTENDEE.map(a => <li key={a}><GwIcon name="Check" size={18} aria-hidden="true" />{t(`home.attend.items.${a}`)}</li>)}</ul>
    <Link to="/discover" className="gw-btn gw-btn-secondary gw-btn-lg">{t('home.cta.exploreAll')}</Link>
  </div></section>;
}

function Explore() {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage === 'es' ? 'es' : 'en';
  const { data = [] } = useQuery(publicGatheringsQuery(lang, false));
  const list = homepageOfferings(data);
  const [status, setStatus] = useState<'' | 'shared' | 'copied' | 'manual'>('');
  const invite = async () => {
    const url = `${window.location.origin}/`;
    try {
      if (navigator.share) { await navigator.share({ title: t('home.explore.inviteTitle'), text: t('home.explore.inviteText'), url }); setStatus('shared'); return; }
      await navigator.clipboard.writeText(url); setStatus('copied');
    } catch (e) { if ((e as Error)?.name !== 'AbortError') setStatus('manual'); }
  };
  return <section className="gw-home-sec gw-band gw-band-canvas" aria-labelledby="explore-title"><div className="gw-container">
    <div className="gw-section-head"><h2 id="explore-title" className="gw-display gw-h2">{t('home.explore.title')}</h2>
      {list.length > 0 && <Link to="/discover" className="gw-see-all">{t('home.explore.seeAll')}<GwIcon name="ArrowRight" size={16} /></Link>}</div>
    {list.length ? <div className="gw-feed">{list.map(g => <GatheringCard key={g.id} g={g} near={null} showRsvp className="gw-feed-card" />)}</div>
      : <div className="gw-empty gw-home-empty"><p><strong>{t('home.explore.empty')}</strong></p>
        <div className="gw-final-ctas">
          {NOTIFY_ME_LIVE ? null : <button type="button" className="gw-btn gw-btn-secondary" aria-disabled="true" aria-describedby="notify-soon" onClick={e => e.preventDefault()}>{t('home.explore.notify')}<span id="notify-soon" className="gw-home-tool-tag">{t('home.soon')}</span></button>}
          <button type="button" className="gw-btn gw-btn-secondary" onClick={() => void invite()}>{t('home.explore.invite')}</button>
          <Link to="/login" search={{ intent: 'host' }} className="gw-btn gw-btn-primary">{t('home.explore.create')}</Link>
        </div>
        <p className="gw-fine" role="status" aria-live="polite">{status === 'manual' ? `${t('home.explore.manual')} ${typeof window !== 'undefined' ? window.location.origin : ''}/` : status ? t(`home.explore.${status}`) : ''}</p>
      </div>}
  </div></section>;
}

function PricingSummary() {
  const { t } = useTranslation();
  return <section className="gw-home-sec gw-band gw-band-white" aria-labelledby="price-title"><div className="gw-container">
    <span className="gw-label">{t('home.pricing.label')}</span>
    <h2 id="price-title" className="gw-display gw-h2">{t('home.pricing.title')}</h2>
    <ul className="gw-home-plans" tabIndex={0} aria-label={t('home.pricing.title')}>{HOME_PLANS.map(p => <li key={p.id}>
      <strong>{t(`home.pricing.plans.${p.id}`)}</strong>
      <span className="gw-home-price tabular">${p.monthly}<small>{t('home.pricing.perMonth')}</small></span>
      {p.monthly > 0 && <span className="gw-fine">{t('home.pricing.annual', { price: annualPrice(p.monthly) })}</span>}
    </li>)}</ul>
    <p>{t('home.pricing.fee', { pct: PLATFORM_FEE_PERCENT })}</p>
    <p className="gw-fine">{t('home.pricing.twoMonths')} {t('home.pricing.pilot')}</p>
    <div className="gw-home-founding"><h3>{t('home.pricing.foundingTitle')}</h3><p>{t('home.pricing.founding')}</p></div>
    <Link to="/pricing" className="gw-see-all">{t('home.pricing.see')}<GwIcon name="ArrowRight" size={16} /></Link>
  </div></section>;
}

function Trust() {
  const { t } = useTranslation();
  const items = ['privacy', 'language', 'access', 'consent', 'support', 'honest'] as const;
  return <section className="gw-home-sec gw-band gw-band-canvas" aria-labelledby="trust-title"><div className="gw-container">
    <h2 id="trust-title" className="gw-display gw-h2">{t('home.trust.title')}</h2>
    <ul className="gw-home-trust">{items.map(k => <li key={k}><h3>{t(`home.trust.${k}.title`)}</h3><p>{t(`home.trust.${k}.body`)}</p></li>)}</ul>
  </div></section>;
}

function FinalCta() {
  const { t } = useTranslation();
  return <section className="gw-home-sec gw-band gw-band-white" aria-labelledby="final-title"><div className="gw-container gw-home-final">
    <h2 id="final-title" className="gw-display gw-h2">{t('home.final.title')}</h2>
    <div className="gw-final-ctas"><StartHosting where="final" /><Link to="/discover" className="gw-btn gw-btn-secondary gw-btn-lg">{t('home.cta.exploreAll')}</Link></div>
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
