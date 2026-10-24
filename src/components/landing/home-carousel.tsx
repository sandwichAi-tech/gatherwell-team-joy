import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { BrandImage } from '@/components/brand-image';
import { GwIcon } from '@/components/gw-icon';
import { CAROUSEL_SLIDES } from '@/lib/homepage';

/** Must match the gap in .gw-carousel (styles.css). */
const GAP_PX = 16;

/**
 * Homepage marketing carousel: approved category imagery with a short caption.
 * Native scroll-snap gives touch swipe/drag for free; buttons and arrow keys move one
 * card at a time. Never auto-advances, so reduced-motion users lose nothing.
 */
export function HomeCarousel() {
  const { t } = useTranslation();
  const trackRef = useRef<HTMLUListElement>(null);
  const [active, setActive] = useState(0);
  const count = CAROUSEL_SLIDES.length;

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const onScroll = () => {
      const card = el.querySelector<HTMLElement>('.gw-carousel-card');
      if (!card) return;
      const step = card.offsetWidth + GAP_PX;
      setActive(Math.max(0, Math.min(count - 1, Math.round(el.scrollLeft / step))));
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [count]);

  const go = (dir: -1 | 1) => {
    const el = trackRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>('.gw-carousel-card');
    const step = card ? card.offsetWidth + GAP_PX : el.clientWidth;
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({ left: dir * step, behavior: smooth ? 'smooth' : 'auto' });
  };

  const onKey = (e: KeyboardEvent<HTMLUListElement>) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
  };

  return <section className="gw-home-carousel-sec" aria-roledescription="carousel" aria-label={t('home.carousel.label')}>
    <div className="gw-container">
      <ul ref={trackRef} className="gw-carousel" tabIndex={0} aria-label={t('home.carousel.label')} onKeyDown={onKey}>
        {CAROUSEL_SLIDES.map((s, i) => <li key={s.key} className="gw-carousel-card" aria-roledescription="slide" aria-label={`${t(`home.carousel.slides.${s.key}.title`)} — ${t('home.carousel.slideOf', { n: i + 1, count })}`}>
          <BrandImage slot={s.slot} alt="" className="gw-carousel-photo" aspect={4 / 3} sizes="(min-width: 1024px) 400px, 86vw" priority />
          <div className="gw-carousel-caption">
            <span className="gw-carousel-cat">{t(`home.carousel.slides.${s.key}.title`)}</span>
            <span className="gw-carousel-line">{t(`home.carousel.slides.${s.key}.line`)}</span>
          </div>
        </li>)}
      </ul>
      <div className="gw-carousel-nav">
        <button type="button" className="gw-carousel-btn" onClick={() => go(-1)} disabled={active === 0} aria-label={t('home.carousel.prev')}><GwIcon name="ArrowLeft" size={20} /></button>
        <span className="gw-carousel-count" aria-live="polite">{t('home.carousel.slideOf', { n: active + 1, count })}</span>
        <button type="button" className="gw-carousel-btn" onClick={() => go(1)} disabled={active === count - 1} aria-label={t('home.carousel.next')}><GwIcon name="ArrowRight" size={20} /></button>
      </div>
    </div>
  </section>;
}
