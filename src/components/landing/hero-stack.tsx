import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { GatheringCard, PhotoCard } from '@/components/landing/gathering-card';
import type { Category, FeedGathering } from '@/lib/landing';

export type HeroItem = { key: string; slot: string } & ({ kind: 'gathering'; g: FeedGathering } | { kind: 'photo'; category: Category });

/** Resting poses for positions 0 (front) to 3 (back). */
export const POSES = [
  { rotate: -3, y: 0, scale: 1 },
  { rotate: 1.5, y: 14, scale: 0.965 },
  { rotate: -1, y: 26, scale: 0.93 },
  { rotate: 3, y: 38, scale: 0.895 },
] as const;

export function HeroCardView({ item, goingOverride, goingSlot, priority, style }: { item: HeroItem; goingOverride?: number | undefined; goingSlot?: React.ReactNode; priority?: boolean | undefined; style?: CSSProperties | undefined }) {
  return item.kind === 'gathering'
    ? <GatheringCard g={item.g} slot={item.slot} goingOverride={goingOverride} goingSlot={goingSlot} priority={priority} className="gw-hero-card" style={style} />
    : <PhotoCard slot={item.slot} category={item.category} priority={priority} className="gw-hero-card" style={style} />;
}

/** First paint and reduced-motion version: the same fanned stack, no animation code. */
export function StaticHeroStack({ items }: { items: HeroItem[] }) {
  const { t } = useTranslation();
  return <div className="gw-stack" role="region" aria-label={t('landing.hero.stackLabel')}>
    {items.map((item, i) => {
      const p = POSES[i] ?? POSES[3];
      return <div key={item.key} className="gw-stack-slot" style={{ zIndex: 10 - i, transform: `translateY(${p.y}px) rotate(${p.rotate}deg) scale(${p.scale})` }} aria-hidden={i > 0}>
        <HeroCardView item={item} priority={i === 0} />
      </div>;
    })}
  </div>;
}
