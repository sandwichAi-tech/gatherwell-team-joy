import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Camera, Trash2 } from '@/components/icons';
import { CropFileInput, type CropResult } from '@/components/image-crop';
import { BrandImage } from '@/components/brand-image';
import { mediaUrl, uploadMedia } from '@/lib/account';
import { ADDON_IMAGE_BYTES, ADDON_IMAGE_RATIO } from '@/lib/addon-images';
import { cleanupAddonImages } from '@/lib/addon-images.functions';

export function AddonImageInput({ userId, name, path, onChange, onBusy }: { userId: string; name: string; path?: string | null | undefined; onChange: (p: string | null) => void; onBusy: (busy: boolean) => void }) {
  const { t } = useTranslation(); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const input = useRef<HTMLSpanElement>(null); const cleanup = useServerFn(cleanupAddonImages);
  const candidates = useRef(new Set<string>()); const alive = useRef(true);
  const change = useRef(onChange); change.current = onChange;
  const { data: src } = useQuery({ queryKey: ['media-url', path], queryFn: () => mediaUrl(path), enabled: !!path });
  useEffect(() => { alive.current = true; return () => { alive.current = false; void cleanup({ data: { paths: [...candidates.current] } }).catch(() => undefined); }; }, [cleanup]);
  const cropped = async ({ file, previewUrl }: CropResult) => {
    setError(''); setBusy(true); onBusy(true);
    const p = `${userId}/addon-${crypto.randomUUID()}.webp`;
    try {
      await uploadMedia(userId, file, 'cover', p);
      candidates.current.add(p);
      const signed = await mediaUrl(p);
      if (!signed) throw new Error('media_unavailable');
      if (path) candidates.current.add(path);
      if (alive.current) change.current(p);
      else await cleanup({ data: { paths: [p] } });
    } catch { await cleanup({ data: { paths: [p] } }).catch(() => undefined); if (alive.current) setError('addonImages.failed'); }
    finally { URL.revokeObjectURL(previewUrl); if (alive.current) setBusy(false); onBusy(false); }
  };
  return <div className="addon-image-input" aria-busy={busy}>
    <span className="field-label">{t('addonImages.label')} · {t('eventReliability.optional')}</span>
    {path && <BrandImage src={src} alt={t('addonImages.alt', { name: name || t('builder.addonName') })} aspect={ADDON_IMAGE_RATIO} className="addon-image" sizes="240px" />}
    <div className="addon-image-actions">
      <Button type="button" variant="secondary" disabled={busy} onClick={() => input.current?.querySelector<HTMLInputElement>('input')?.click()}><Camera />{t(path ? 'addonImages.replace' : 'addonImages.upload')}</Button>
      {path && <Button type="button" variant="ghost" disabled={busy} onClick={() => { candidates.current.add(path); onChange(null); setError(''); }}><Trash2 />{t('addonImages.remove')}</Button>}
    </div>
    <span ref={input}><CropFileInput kind="addon" disabled={busy} maxBytes={ADDON_IMAGE_BYTES} onCropped={r => void cropped(r)} onRejected={reason => setError(reason === 'type' ? 'addonImages.type' : 'addonImages.size')} /></span>
    {busy && <p role="status" className="field-hint">{t('addonImages.uploading')}</p>}
    {error && <p role="alert" className="field-error">{t(error)}</p>}
  </div>;
}