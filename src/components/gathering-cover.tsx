import { useQuery } from '@tanstack/react-query';
import { mediaUrl } from '@/lib/account';
import { coverStyleAt, clampOverlay, clampFocal } from '@/lib/cover';
import { BrandImage } from '@/components/brand-image';

/** Uploaded photo when present, otherwise a curated brand gradient with the first letter. */
export function GatheringCover({ path, style = 0, title, className = '', overlay = 0, focal, alt }: {
  path?: string | null; style?: number | null; title: string; className?: string;
  overlay?: number | null | undefined; focal?: string | null | undefined; alt?: string | null | undefined;
}) {
  const { data: url } = useQuery({ queryKey: ['media-url', path], queryFn: () => mediaUrl(path), enabled: !!path, staleTime: 50 * 60 * 1000 });
  const scrim = clampOverlay(overlay);
  const scrimEl = scrim > 0 ? <span className="gathering-cover-scrim" style={{ background: `rgba(48, 35, 56, ${scrim / 100})` }} aria-hidden="true" /> : null;
  const parts = clampFocal(focal).split(' ').map(v => Number(v.replace('%', '')) / 100);
  const fx = parts[0] ?? 0.5; const fy = parts[1] ?? 0.5;
  if (url) return <span className={`gathering-cover has-photo ${className}`}>
    <BrandImage src={url} alt={alt?.trim() || title} className="gathering-cover-img" focal={{ x: fx, y: fy }} priority={className.includes('guest-cover')} />
    {scrimEl}
  </span>;
  return <div className={`gathering-cover ${className}`} style={{ backgroundImage: coverStyleAt(style) }} role="img" aria-label={alt?.trim() || title}>
    {scrimEl}
    <span className="gathering-cover-letter" aria-hidden="true">{(title.trim()[0] ?? 'G').toUpperCase()}</span>
  </div>;
}
