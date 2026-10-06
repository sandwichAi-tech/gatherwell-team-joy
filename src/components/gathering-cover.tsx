import { useQuery } from '@tanstack/react-query';
import { mediaUrl } from '@/lib/account';
import { COVER_STYLES } from '@/lib/gatherings';
import { BrandImage } from '@/components/brand-image';

/** Uploaded photo when present, otherwise a refined gradient with the first letter. */
export function GatheringCover({ path, style = 0, title, className = '' }: { path?: string | null; style?: number | null; title: string; className?: string }) {
  const { data: url } = useQuery({ queryKey: ['media-url', path], queryFn: () => mediaUrl(path), enabled: !!path, staleTime: 50 * 60 * 1000 });
  if (url) return <BrandImage src={url} alt={title} className={`gathering-cover ${className}`} priority={className.includes('guest-cover')} />;
  return <div className={`gathering-cover ${className}`} style={{ backgroundImage: COVER_STYLES[(style ?? 0) % COVER_STYLES.length] }} aria-hidden="true"><span>{(title.trim()[0] ?? 'G').toUpperCase()}</span></div>;
}
