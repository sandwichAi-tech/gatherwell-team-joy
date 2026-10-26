import { useState, type CSSProperties } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { responsiveSrc, siteMediaQuery } from '@/lib/site-media';
import { toRendition, type MediaSrc } from '@/lib/media-renditions';

type Props = {
  /** A site_media slot key, or pass src directly. */
  slot?: string | undefined;
  /** A plain URL or a signed rendition set (src + srcSet). */
  src?: MediaSrc;
  alt?: string | undefined;
  resizable?: boolean | undefined;
  focal?: { x: number | undefined; y: number };
  aspect?: number | undefined;
  sizes?: string | undefined;
  className?: string | undefined;
  priority?: boolean | undefined;
};

/** Every photo renders here: one soft brand grade over real photos, grain texture only on the tonal fallback, and responsive renditions. */
export function BrandImage({ slot, src, alt, resizable, focal, aspect, sizes = '100vw', className, priority }: Props) {
  const { i18n } = useTranslation();
  const { data } = useQuery({ ...siteMediaQuery(), enabled: !!slot });
  const row = slot ? data?.find(r => r.slot === slot) : undefined;
  const given = toRendition(src);
  const url = given?.src ?? row?.url ?? null;
  const canResize = resizable ?? row?.resizable ?? false;
  const fx = focal?.x ?? row?.focal_x ?? 0.5;
  const fy = focal?.y ?? row?.focal_y ?? 0.5;
  const ratio = aspect ?? row?.aspect;
  const label = alt ?? (row ? (i18n.resolvedLanguage?.startsWith('es') ? row.alt_es : row.alt_en) : '');
  const [failed, setFailed] = useState<string | null>(null);
  const broken = !url || failed === url;
  const style: CSSProperties = ratio ? { aspectRatio: String(ratio) } : {};
  return (
    <figure className={`brand-image ${broken ? 'is-fallback' : ''} ${className ?? ''}`.trim()} style={style} role={broken && label ? 'img' : undefined} aria-label={broken && label ? label : undefined}>
      {!broken && <img {...(given?.srcSet ? { src: given.src, srcSet: given.srcSet } : responsiveSrc(url, canResize))} sizes={sizes} alt={label} loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : 'auto'} decoding="async" style={{ objectPosition: `${fx * 100}% ${fy * 100}%` }} onError={() => setFailed(url)} />}
      <span className="brand-image-grade" aria-hidden="true" />
      {broken && <span className="brand-image-grain" aria-hidden="true" />}
    </figure>
  );
}
