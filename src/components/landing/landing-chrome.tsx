import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ClientOnly, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { LanguageToggle } from '@/components/auth-frame';
import { GwIcon } from '@/components/gw-icon';
import { track } from '@/lib/landing';

export function LandingLogo() {
  const { t } = useTranslation();
  return <Link to="/" className="brand gw-landing-logo" aria-label={t('brand')}><span className="brand-mark" aria-hidden="true">g</span><span>{t('brand')}</span></Link>;
}

/** Sticky nav: transparent over the hero, frosted white with a hairline after 24px. */
export function LandingNav() {
  const { t } = useTranslation();
  const [solid, setSolid] = useState(false);
  const [open, setOpenRaw] = useState(false);
  const [closing, setClosing] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const setOpen = (v: boolean) => {
    if (v) { setOpenRaw(true); return; }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setClosing(true);
    window.setTimeout(() => { setOpenRaw(false); setClosing(false); triggerRef.current?.focus(); }, reduce ? 0 : 160);
  };
  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 24);
    onScroll(); window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); return; }
      if (e.key !== 'Tab' || !sheetRef.current) return;
      const f = sheetRef.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled])');
      if (!f.length) return;
      const first = f[0]!, last = f[f.length - 1]!;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.body.style.overflow = 'hidden'; window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', onKey); };
  }, [open]);
  return <header className={`gw-nav ${solid ? 'is-solid' : ''}`}>
    <div className="gw-nav-inner">
      <LandingLogo />
      <nav className="gw-nav-links" aria-label={t('landing.nav.main')}>
        <Link to="/discover" className="gw-nav-link">{t('landing.nav.find')}</Link>
        <Link to="/login" search={{ intent: 'host' }} className="gw-nav-link">{t('landing.nav.host')}</Link>
        <LanguageToggle />
        <Link to="/login" className="gw-nav-link">{t('landing.nav.signIn')}</Link>
        <Link to="/login" className="gw-btn gw-btn-primary gw-btn-sm">{t('landing.nav.getStarted')}</Link>
      </nav>
      <div className="gw-nav-mobile">
        <LanguageToggle />
        <button ref={triggerRef} type="button" className="gw-icon-btn" aria-label={t('landing.nav.menu')} aria-expanded={open} onClick={() => setOpen(true)}><GwIcon name="List" size={24} /></button>
      </div>
    </div>
    {open && <div ref={sheetRef} className={`gw-menu-sheet ${closing ? 'is-closing' : ''}`} role="dialog" aria-modal="true" aria-label={t('landing.nav.main')}>
      <div className="gw-menu-top"><LandingLogo /><button type="button" className="gw-icon-btn" aria-label={t('landing.nav.close')} onClick={() => setOpen(false)} autoFocus><GwIcon name="X" size={24} /></button></div>
      <nav className="gw-menu-links">
        <Link to="/discover" onClick={() => setOpen(false)}>{t('landing.nav.find')}</Link>
        <Link to="/login" search={{ intent: 'host' }} onClick={() => setOpen(false)}>{t('landing.nav.host')}</Link>
        <Link to="/login" onClick={() => setOpen(false)}>{t('landing.nav.signIn')}</Link>
      </nav>
      <Link to="/login" className="gw-btn gw-btn-primary gw-btn-block" onClick={() => setOpen(false)}>{t('landing.nav.getStarted')}</Link>
    </div>}
  </header>;
}

export function LandingFooter() {
  const { t } = useTranslation();
  return <footer className="gw-footer" id="site-footer">
    <div className="gw-container gw-footer-grid">
      <div className="gw-footer-brand"><LandingLogo /><p>{t('landing.footer.tagline')}</p><LanguageToggle /></div>
      <div><h3>{t('landing.footer.discover')}</h3><Link to="/discover">{t('landing.footer.allGatherings')}</Link><Link to="/discover" search={{ when: 'weekend' }}>{t('landing.footer.thisWeekend')}</Link></div>
      <div><h3>{t('landing.footer.host')}</h3><Link to="/login" search={{ intent: 'host' }}>{t('landing.footer.hostOne')}</Link><Link to="/login">{t('landing.footer.leaderTools')}</Link></div>
      <div><h3>{t('landing.footer.company')}</h3><a href="/#how-it-works">{t('landing.footer.howItWorks')}</a><Link to="/login">{t('landing.footer.signIn')}</Link></div>
      <div><h3>{t('landing.footer.legal')}</h3><Link to="/terms">{t('landing.footer.terms')}</Link><Link to="/privacy">{t('landing.footer.privacy')}</Link>{(['host', 'guest', 'sms', 'cookies'] as const).map(d => <Link key={d} to="/legal/$doc" params={{ doc: d }}>{t(`legalDocs.docs.${d}.title`)}</Link>)}<Link to="/credits">{t('landing.footer.credits')}</Link></div>
    </div>
    <div className="gw-container gw-footer-base"><span>{t('landing.footer.copyright')}</span><span><Link to="/terms">{t('landing.footer.terms')}</Link> · <Link to="/privacy">{t('landing.footer.privacy')}</Link></span></div>
  </footer>;
}

/** Mobile-only bar after the hero scrolls away; hides near the footer. */
export function StickyFindBar({ heroId }: { heroId: string }) {
  const { t } = useTranslation();
  const [pastHero, setPastHero] = useState(false);
  const [nearFooter, setNearFooter] = useState(false);
  useEffect(() => {
    const hero = document.getElementById(heroId), footer = document.getElementById('site-footer');
    const io = new IntersectionObserver(entries => entries.forEach(e => {
      if (e.target === hero) setPastHero(!e.isIntersecting);
      if (e.target === footer) setNearFooter(e.isIntersecting);
    }), { rootMargin: '0px 0px 120px 0px' });
    if (hero) io.observe(hero); if (footer) io.observe(footer);
    return () => io.disconnect();
  }, [heroId]);
  const show = pastHero && !nearFooter;
  return <div className={`gw-sticky-bar ${show ? 'is-visible' : ''}`} aria-hidden={!show}>
    <Link to="/discover" search={{ near: 1 }} className="gw-btn gw-btn-primary gw-btn-block" tabIndex={show ? 0 : -1} onClick={() => track('sticky_cta_click')}>{t('landing.sticky.find')}</Link>
  </div>;
}

/** Public marketing pages render client-only so browser-detected language never mismatches hydration. */
export function LandingFrame({ children }: { children: ReactNode }) {
  return <ClientOnly fallback={<div className="gw-landing" />}><div className="gw-landing"><LandingNav />{children}<LandingFooter /></div></ClientOnly>;
}
