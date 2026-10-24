import { useState, type CSSProperties, type ReactNode } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { BrandImage } from '@/components/brand-image';
import { CATEGORY_ICONS, GwIcon } from '@/components/gw-icon';
import { Button } from '@/components/ui/button';
import { ResponsiveSheet } from '@/components/responsive-sheet';
import { SAMPLE_ORIGIN, distanceKm, feedSlot, formatDistance, formatWhen, isThisWeekend, spotsLeft, track, type Category, type FeedGathering } from '@/lib/landing';

export type Coords = { lat: number; lng: number };

export function CategoryChip({ category }: { category: Category }) {
  const { t } = useTranslation();
  return <span className="gw-cat-chip"><GwIcon name={CATEGORY_ICONS[category]} variant="marketing" size={16} />{t(`landing.catOne.${category}`)}</span>;
}

export function AvatarStack({ letters, size = 24 }: { letters: string[]; size?: number }) {
  if (!letters.length) return null;
  return <span className="gw-avatar-stack" aria-hidden="true">{letters.slice(0, 3).map((l, i) => <span key={i} className={`gw-mini-avatar tone-${i % 3}`} style={{ width: size, height: size, fontSize: size * 0.42 }}>{l.toUpperCase()}</span>)}</span>;
}

export function GoingLine({ g, going }: { g: FeedGathering; going: number }) {
  const { t } = useTranslation();
  if (going <= 0) return <span className="gw-going-text">{t('landing.card.beFirst')}</span>;
  const names = g.goingNames.slice(0, 2);
  const text = names.length === 2 && going > 2
    ? t('landing.card.goingNames', { names: names.join(', '), count: going - 2 })
    : t('landing.card.goingCount', { count: going });
  return <span className="gw-going-text" aria-live="polite">{text}</span>;
}

/** Morphs to "Going" with a drawn check and a single lavender ring. Real gatherings continue to the guest page. */
export function RsvpButton({ g, compact }: { g: FeedGathering; compact?: boolean | undefined }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [going, setGoing] = useState(false);
  const onClick = () => {
    track('feed_rsvp_click', { id: g.id, sample: g.isSample });
    if (g.isSample) { if (!going) toast(t('landing.card.sampleRsvp')); setGoing(v => !v); return; }
    setGoing(true);
    window.setTimeout(() => void navigate({ to: '/e/$id', params: { id: g.id } }), 520);
  };
  return <button type="button" className={`gw-rsvp ${going ? 'is-going' : ''} ${compact ? 'is-compact' : ''}`} onClick={onClick} aria-pressed={going} aria-label={going ? t('landing.card.going') : t('landing.card.rsvpFor', { title: g.title })}>
    {going && <svg className="gw-rsvp-check" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" /></svg>}
    <span>{going ? t('landing.card.going') : t('landing.card.rsvp')}</span>
  </button>;
}

type CardProps = {
  g: FeedGathering;
  slot?: string | undefined;
  near?: Coords | null | undefined;
  goingOverride?: number | undefined;
  goingSlot?: ReactNode | undefined;
  showRsvp?: boolean | undefined;
  style?: CSSProperties | undefined;
  className?: string | undefined;
  priority?: boolean | undefined;
};

export function GatheringCard({ g, slot, near, goingOverride, goingSlot, showRsvp, style, className, priority }: CardProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [preview, setPreview] = useState(false);
  const lang = i18n.resolvedLanguage === 'es' ? 'es' : 'en';
  const left = spotsLeft(g);
  const weekend = !left && isThisWeekend(g.startsAt);
  // Preview samples measure from Tustin, CA until the visitor shares a location.
  const origin = near ?? (g.isSample ? SAMPLE_ORIGIN : null);
  const where = origin && g.lat != null && g.lng != null
    ? `${g.locationName} · ${t('landing.card.away', { distance: formatDistance(distanceKm(origin, { lat: g.lat, lng: g.lng }), lang) })}`
    : g.isOnline ? t('landing.card.online') : g.locationName;
  const going = goingOverride ?? g.going;
  const meta = [formatWhen(g.startsAt, lang), where].filter(Boolean).join(' · ');
  const open = () => {
    track('feed_rsvp_click', { id: g.id, sample: g.isSample });
    if (g.isSample) setPreview(true); else void navigate({ to: '/e/$id', params: { id: g.id } });
  };
  const catName = t(`landing.catOne.${g.category}`);
  return <article className={`gw-gcard ${className ?? ''}`} style={style}>
    <div className="gw-gcard-media">
      <BrandImage slot={slot ?? feedSlot(g.category)} aspect={4 / 3} sizes="(min-width: 1024px) 360px, 80vw" priority={priority} />
      <div className="gw-gcard-chips">
        {showRsvp
          ? <Link to="/discover" search={{ cat: g.category }} className="gw-cat-chip" aria-label={t('landing.card.filterCat', { category: catName })}><GwIcon name={CATEGORY_ICONS[g.category]} variant="marketing" size={16} />{catName}</Link>
          : <CategoryChip category={g.category} />}
        {left ? <span className="gw-status-chip warm">{t('landing.card.spotsLeft', { count: left })}</span>
          : weekend ? <span className="gw-status-chip cool">{t('landing.card.thisWeekend')}</span> : null}
      </div>
    </div>
    <div className="gw-gcard-body">
      <h3 className="gw-gcard-title">{showRsvp ? <button type="button" className="gw-gcard-link" onClick={open} aria-label={t('landing.card.open', { title: g.title })}>{g.title}</button> : g.title}</h3>
      <p className="gw-gcard-meta">{meta}</p>
      <p className="gw-gcard-host"><span className="gw-mini-avatar tone-2" style={{ width: 20, height: 20, fontSize: 9 }} aria-hidden="true">{g.hostName.trim()[0]?.toUpperCase() ?? 'G'}</span>{t('landing.card.hostedBy', { name: g.hostName })}{g.isSample && <span className="gw-sample-tag">{t('landing.card.sample')}</span>}{g.featured && <span className="gw-sample-tag gw-founding-tag">{t('founding.badge')}</span>}</p>
      <div className="gw-gcard-foot">
        <span className="gw-going"><AvatarStack letters={g.initials} />{goingSlot ?? <GoingLine g={g} going={going} />}</span>
        {showRsvp && <RsvpButton g={g} compact />}
      </div>
    </div>
    {showRsvp && g.isSample && <ResponsiveSheet open={preview} onOpenChange={setPreview} title={g.title} description={t('landing.card.sampleTitle')}
      footer={<Button className="w-full" onClick={() => { setPreview(false); void navigate({ to: '/discover', search: {} }); }}>{t('landing.card.browseReal')}</Button>}>
      <div className="edit-form">
        <p className="gw-gcard-meta">{meta}</p>
        <p>{t('landing.card.hostedBy', { name: g.hostName })}</p>
        <p className="guest-hint">{t('landing.card.sampleBody')}</p>
      </div>
    </ResponsiveSheet>}
  </article>;
}
