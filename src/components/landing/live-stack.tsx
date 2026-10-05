import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { GwIcon } from '@/components/gw-icon';
import { HeroCardView, POSES, StaticHeroStack, type HeroItem } from '@/components/landing/hero-stack';

const SPRING = { type: 'spring', stiffness: 260, damping: 26 } as const;
const CYCLE_MS = 4000;
const RESUME_MS = 3000;

/** Animated "live stack": front card lifts and slides off left, then settles at the back. */
export default function LiveStack({ items }: { items: HeroItem[] }) {
  const { t } = useTranslation();
  const reduced = useReducedMotion();
  const [order, setOrder] = useState(() => items.map((_, i) => i));
  const [leaving, setLeaving] = useState<number | null>(null);
  const [bumps, setBumps] = useState<Record<number, number>>({});
  const [hoverPaused, setHoverPaused] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const cycles = useRef(0);
  const resumeTimer = useRef<number | undefined>(undefined);

  const rx = useMotionValue(0), ry = useMotionValue(0);
  const tiltX = useSpring(rx, { stiffness: 120, damping: 18 }), tiltY = useSpring(ry, { stiffness: 120, damping: 18 });
  const [finePointer, setFinePointer] = useState(false);
  useEffect(() => { setFinePointer(window.matchMedia('(pointer: fine) and (min-width: 1024px)').matches); }, []);

  useEffect(() => { setOrder(items.map((_, i) => i)); }, [items.length]);

  const paused = hoverPaused || userPaused || !!reduced;
  useEffect(() => {
    if (paused || items.length < 2) return;
    const id = window.setInterval(() => {
      setOrder(current => {
        const front = current[0] ?? 0;
        const next = current[1] ?? 0;
        setLeaving(front);
        cycles.current += 1;
        const item = items[next];
        if (cycles.current % 2 === 0 && item?.kind === 'gathering') setBumps(b => ({ ...b, [next]: (b[next] ?? 0) + 1 }));
        window.setTimeout(() => { setOrder(o => [...o.slice(1), o[0] ?? 0]); setLeaving(null); }, 420);
        return current;
      });
    }, CYCLE_MS);
    return () => window.clearInterval(id);
  }, [paused, items]);

  useEffect(() => () => window.clearTimeout(resumeTimer.current), []);
  const pause = () => { window.clearTimeout(resumeTimer.current); setHoverPaused(true); };
  const resumeLater = () => { window.clearTimeout(resumeTimer.current); resumeTimer.current = window.setTimeout(() => setHoverPaused(false), RESUME_MS); };

  if (reduced) return <StaticHeroStack items={items} />;

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!finePointer) return;
    const r = e.currentTarget.getBoundingClientRect();
    ry.set(((e.clientX - r.left) / r.width - 0.5) * 8);
    rx.set(-((e.clientY - r.top) / r.height - 0.5) * 8);
  };

  return <div className="gw-stack-wrap">
    <motion.div className="gw-stack" role="region" aria-roledescription="carousel" aria-label={t('landing.hero.stackLabel')}
      style={{ rotateX: tiltX, rotateY: tiltY, transformPerspective: 1200 }}
      onMouseEnter={pause} onMouseLeave={() => { rx.set(0); ry.set(0); resumeLater(); }} onMouseMove={onMove}
      onTouchStart={pause} onTouchEnd={resumeLater}>
      {items.map((item, idx) => {
        const pos = order.indexOf(idx);
        const p = POSES[pos] ?? POSES[3];
        const isLeaving = leaving === idx;
        const base = item.kind === 'gathering' ? item.g.going : 0;
        const count = base + (bumps[idx] ?? 0);
        return <motion.div key={item.key} className="gw-stack-slot" aria-hidden={pos !== 0}
          initial={false}
          animate={isLeaving ? { x: '-115%', y: -24, rotate: -10, scale: 1, opacity: 0.9 } : { x: 0, y: p.y, rotate: p.rotate, scale: p.scale, opacity: 1 }}
          transition={SPRING}
          style={{ zIndex: isLeaving ? 20 : 10 - pos }}>
          <HeroCardView item={item} priority={idx === 0} goingOverride={count}
            goingSlot={item.kind === 'gathering' ? <RollingGoing item={item} count={count} /> : undefined} />
        </motion.div>;
      })}
    </motion.div>
    <button type="button" className="gw-stack-toggle" onClick={() => setUserPaused(v => !v)} aria-pressed={userPaused} aria-label={userPaused ? t('landing.hero.play') : t('landing.hero.pause')}>
      <GwIcon name={userPaused ? 'Play' : 'Pause'} size={14} />
    </button>
  </div>;
}

function RollingGoing({ item, count }: { item: Extract<HeroItem, { kind: 'gathering' }>; count: number }) {
  const { t } = useTranslation();
  const g = item.g;
  if (count <= 0) return <span className="gw-going-text">{t('landing.card.beFirst')}</span>;
  const names = g.goingNames.slice(0, 2);
  const useNames = names.length === 2 && count > 2;
  const num = useNames ? count - 2 : count;
  if (!useNames && num === 1) return <span className="gw-going-text">{t('landing.card.goingCount', { count: 1 })}</span>;
  const [before, after] = (useNames ? t('landing.card.goingNames', { names: names.join(', '), count: 999999 }) : t('landing.card.goingCount', { count: 999999 })).split('999999');
  return <span className="gw-going-text">
    {before}
    <span className="gw-roll"><AnimatePresence initial={false} mode="popLayout">
      <motion.span key={num} initial={{ y: '100%', opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: '-100%', opacity: 0 }} transition={{ duration: 0.28, ease: 'easeOut' }}>{num}</motion.span>
    </AnimatePresence></span>
    {after}
  </span>;
}
