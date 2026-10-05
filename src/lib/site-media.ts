import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const SITE_MEDIA_BUCKET = 'site-media';
export const SRCSET_WIDTHS = [640, 1080, 1600, 2400] as const;

export type SiteMedia = {
  id: string; slot: string; image_path: string | null; alt_en: string; alt_es: string; credit: string | null;
  focal_x: number; focal_y: number; aspect: number; default_url: string | null; default_credit: string | null;
  default_alt_en: string; default_alt_es: string; sort_order: number; updated_at: string;
  /** Resolved display URL (signed for uploads, CDN for defaults). */
  url: string | null;
  /** True when the URL accepts width parameters for responsive sizes. */
  resizable: boolean;
};

export const siteMediaKey = ['site-media'] as const;

export const siteMediaQuery = () => queryOptions({
  queryKey: siteMediaKey,
  staleTime: 5 * 60_000,
  queryFn: async (): Promise<SiteMedia[]> => {
    const { data, error } = await supabase.from('site_media').select('*').order('sort_order');
    if (error) throw error;
    const rows = data ?? [];
    const paths = rows.map(r => r.image_path).filter((p): p is string => !!p);
    const signed = new Map<string, string>();
    if (paths.length) {
      const { data: s } = await supabase.storage.from(SITE_MEDIA_BUCKET).createSignedUrls(paths, 60 * 60 * 24 * 7);
      for (const item of s ?? []) if (item.path && item.signedUrl) signed.set(item.path, item.signedUrl);
    }
    return rows.map(r => {
      const url = r.image_path ? signed.get(r.image_path) ?? null : r.default_url;
      return { ...r, url, resizable: !r.image_path && !!url && url.includes('images.unsplash.com') };
    });
  },
});

/** Responsive source attributes; uploaded photos are already sized to 2400px WebP on upload. */
export function responsiveSrc(url: string, resizable: boolean) {
  if (!resizable) return { src: url };
  const at = (w: number) => { const u = new URL(url); u.searchParams.set('w', String(w)); u.searchParams.set('q', '80'); u.searchParams.set('auto', 'format'); u.searchParams.set('fit', 'crop'); return u.href; };
  return { src: at(1600), srcSet: SRCSET_WIDTHS.map(w => `${at(w)} ${w}w`).join(', ') };
}

export const isAdminQuery = (userId: string | undefined) => queryOptions({
  queryKey: ['is-admin', userId],
  enabled: !!userId,
  staleTime: 10 * 60_000,
  queryFn: async () => {
    if (!userId) return false;
    const { data, error } = await supabase.rpc('has_role', { _user_id: userId, _role: 'admin' });
    if (error) return false;
    return !!data;
  },
});

/** Crops a file to the slot aspect around a focal point and returns a ≤2400px WebP blob. */
export async function cropToAspect(file: File, aspect: number, focalX: number, focalY: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const { width: w, height: h } = bitmap;
  let cw = w, ch = Math.round(w / aspect);
  if (ch > h) { ch = h; cw = Math.round(h * aspect); }
  const sx = Math.min(Math.max(Math.round(focalX * w - cw / 2), 0), w - cw);
  const sy = Math.min(Math.max(Math.round(focalY * h - ch / 2), 0), h - ch);
  const outW = Math.min(2400, cw);
  const outH = Math.round(outW / aspect);
  const canvas = document.createElement('canvas');
  canvas.width = outW; canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) { bitmap.close(); throw new Error('canvas_unavailable'); }
  ctx.drawImage(bitmap, sx, sy, cw, ch, 0, 0, outW, outH);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('encode'))), 'image/webp', 0.8));
}
