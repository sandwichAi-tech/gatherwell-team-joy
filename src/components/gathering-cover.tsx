import { useQuery } from '@tanstack/react-query';
import { mediaRendition } from '@/lib/account';
import type { Rendition } from '@/lib/media-renditions';
import { eventCoverRendition } from '@/lib/media.functions';
import { coverStyleAt, clampOverlay, clampFocal } from '@/lib/cover';
import { BrandImage } from '@/components/brand-image';

/** Uploaded photo when present, otherwise a curated brand gradient with the first letter. */
export function GatheringCover({ path, style = 0, title, className = '', overlay = 0, focal, alt, rendition, sizes, onNaturalWidth, eventId }: {
  path?: string | null; style?: number | null; title: string; className?: string;
  overlay?: number | null | undefined; focal?: string | null | undefined; alt?: string | null | undefined;
  /** Server-signed renditions (public pages, where the visitor cannot sign private media). */
  rendition?: Rendition | null | undefined; sizes?: string | undefined; onNaturalWidth?: ((width: number) => void) | undefined;
  /** Signed-in surfaces showing other hosts' events: lets the server sign after checking the viewer can read the event. */
  eventId?: string | undefined;
}) {
  const { data: signed } = useQuery({ queryKey: ['media-rendition', path, eventId ?? null], queryFn: async () => (eventId ? await eventCoverRendition({ data: { id: eventId } }).catch(() => null) : null) ?? (await mediaRendition(path)), enabled: !!path && !rendition, staleTime: 50 * 60 * 1000 });
  const url = rendition ?? signed ?? null;
  const scrim = clampOverlay(overlay);
  const scrimEl = scrim > 0 ? <span className="gathering-cover-scrim" style={{ background: `rgba(48, 35, 56, ${scrim / 100})` }} aria-hidden="true" /> : null;
  const parts = clampFocal(focal).split(' ').map(v => Number(v.replace('%', '')) / 100);
  const fx = parts[0] ?? 0.5; const fy = parts[1] ?? 0.5;
  if (url) return <span className={`gathering-cover has-photo ${className}`}>
    <BrandImage src={url} alt={alt?.trim() || title} className="gathering-cover-img" focal={{ x: fx, y: fy }} sizes={sizes ?? (className.includes('guest-cover') ? '(min-width: 720px) 720px, 100vw' : '(min-width: 1024px) 480px, 100vw')} priority={className.includes('guest-cover')} onNaturalWidth={onNaturalWidth} />
    {scrimEl}
  </span>;
  return <div className={`gathering-cover ${className}`} style={{ backgroundImage: coverStyleAt(style) }} role="img" aria-label={alt?.trim() || title}>
    {scrimEl}
    <span className="gathering-cover-letter" aria-hidden="true">{(title.trim()[0] ?? 'G').toUpperCase()}</span>
  </div>;
}
