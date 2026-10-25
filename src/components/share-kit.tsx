import { markLinkShared } from '@/components/coach-launch';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { Download, Share2, MessageCircle, MessageSquareText, Send, Sparkles } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { CopyButton, copyText } from '@/components/copy-button';
import { mediaUrl } from '@/lib/account';
import { shareCaption } from '@/lib/smart.functions';
import { trackEvent } from '@/lib/analytics';
import { getPublicEventMeta } from '@/lib/public-event.functions';

import { renderShareImage, loadShareImage as loadImg } from '@/lib/share-image';
import type { ShareFormat } from '@/lib/share-image-layout';
export { renderShareImage } from '@/lib/share-image';
export type { ShareFormat } from '@/lib/share-image-layout';

export type ShareKitProps = { title: string; startsAt: string; timezone?: string | null; place: string; link: string; coverPath?: string | null; coverStyle?: number | null; focal?: string; host?: string };

/** Social share kit: three image sizes, bilingual caption and one-tap share actions. */
export function ShareKit({ title, startsAt, timezone, place, link, coverPath, coverStyle = null, focal, host }: ShareKitProps) {
  const { t, i18n } = useTranslation(); const lang = i18n.resolvedLanguage === 'es' ? 'es' : 'en';
  const [format, setFormat] = useState<ShareFormat>('square');
  const [images, setImages] = useState<Partial<Record<ShareFormat, { blob: Blob; url: string }>>>({});
  const [caption, setCaption] = useState<{ en: string; es: string; preview: boolean } | null>(null);
  const [writing, setWriting] = useState(false);
  const getCaption = useServerFn(shareCaption);
  const getPublicCover = useServerFn(getPublicEventMeta);
  const fmt = (l: string) => new Date(startsAt).toLocaleString(l, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', ...(timezone ? { timeZone: timezone } : {}) });
  const date = fmt(lang === 'es' ? 'es-MX' : 'en-US');

  useEffect(() => {
    let alive = true; const made: string[] = [];
    void (async () => {
      const wideUrl = await mediaUrl(coverPath).catch(() => null);
      let wideImg = wideUrl ? await loadImg(wideUrl).catch(() => null) : null;
      if (!wideImg && coverPath) {
        const id = new URL(link).pathname.match(/^\/e\/([a-f0-9-]{36})$/)?.[1];
        if (id) { const publicCover = await getPublicCover({ data: { id } }).catch(() => null); if (publicCover?.image) wideImg = await loadImg(publicCover.image).catch(() => null); }
      }
      const base = { title, date, place, link, coverStyle, brand: t('brand'), focal, host };
      for (const f of ['square', 'story', 'wide'] as ShareFormat[]) {
        const blob = await renderShareImage(f, { ...base, cover: wideImg });
        if (!alive || !blob) continue;
        const url = URL.createObjectURL(blob); made.push(url);
        setImages(s => ({ ...s, [f]: { blob, url } }));
      }
    })();
    return () => { alive = false; made.forEach(u => URL.revokeObjectURL(u)); setImages({}); };
  }, [title, date, place, link, coverPath, coverStyle, focal, host, t, getPublicCover]);

  const fallbackCaption = `${t('shareKit.fallbackCaption', { title, date, link })}`;
  const captionText = caption ? `${caption.en}\n\n${caption.es}` : fallbackCaption;
  const enc = encodeURIComponent(captionText);
  const current = images[format];
  const file = () => current ? new File([current.blob], `gathering-${format}.png`, { type: 'image/png' }) : null;

  const writeCaption = async () => {
    setWriting(true);
    try {
      const r = await getCaption({ data: { title, whenEn: fmt('en-US'), whenEs: fmt('es-MX'), place, link } });
      setCaption(r); if (await copyText(`${r.en}\n\n${r.es}`)) toast.success(t('shareKit.captionCopied'));
    } catch { if (await copyText(fallbackCaption)) toast.success(t('shareKit.captionCopied')); }
    setWriting(false); trackEvent('share', { action: 'caption' });
  };
  const download = () => {
    if (!current) return;
    const a = document.createElement('a'); a.href = current.url; a.download = `gathering-${format}.png`; a.click();
    trackEvent('share', { action: 'download', format }); void markLinkShared();
  };
  const nativeShare = async () => {
    const f = file();
    try {
      if (f && navigator.canShare?.({ files: [f] })) await navigator.share({ files: [f], text: captionText, title });
      else if (navigator.share) await navigator.share({ text: captionText, url: link, title });
      else { await copyText(link); toast.success(t('onboarding.copied')); }
      trackEvent('share', { action: 'native' }); void markLinkShared();
    } catch { /* closed by the person */ }
  };

  return <div className="share-kit">
    <div className="segmented share-kit-formats" role="group" aria-label={t('shareKit.size')}>
      {(['square', 'story', 'wide'] as const).map(f => <Button key={f} variant="ghost" aria-pressed={format === f} className={format === f ? 'selected' : ''} onClick={() => setFormat(f)}>{t(`shareKit.formats.${f}`)}</Button>)}
    </div>
    <div className={`share-kit-preview is-${format}`}>
      {current ? <img src={current.url} alt={t('shareKit.previewAlt', { title })} /> : <div className="skeleton share-kit-skeleton" aria-label={t('shareKit.making')} />}
    </div>
    <div className="share-kit-actions">
      <Button onClick={() => void nativeShare()} disabled={!current}><Share2 />{t('shareKit.share')}</Button>
      <Button variant="secondary" onClick={download} disabled={!current}><Download />{t('shareKit.download')}</Button>
    </div>
    <div className="share-kit-caption">
      <p className="field-label">{t('shareKit.caption')}{caption?.preview && <span className="chip">{t('shareKit.previewCaption')}</span>}</p>
      {caption && <p className="share-kit-caption-text">{captionText}</p>}
      <Button variant="secondary" onClick={() => void writeCaption()} disabled={writing}><Sparkles />{writing ? t('shareKit.writing') : t('shareKit.copyCaption')}</Button>
    </div>
    <div className="share-grid">
      <Button asChild variant="secondary"><a href={`https://wa.me/?text=${enc}`} target="_blank" rel="noopener noreferrer" onClick={() => trackEvent('share', { action: 'whatsapp' })}><MessageCircle />{t('teamSpace.whatsapp')}</a></Button>
      <Button asChild variant="secondary"><a href={`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(caption ? captionText.replaceAll(link, '').trim() : title)}`} target="_blank" rel="noopener noreferrer" onClick={() => trackEvent('share', { action: 'telegram' })}><Send />{t('shareKit.telegram')}</a></Button>
      <Button asChild variant="secondary"><a href={`sms:?&body=${enc}`} onClick={() => trackEvent('share', { action: 'sms' })}><MessageSquareText />{t('gathering.text')}</a></Button>
      <CopyButton text={link} />
    </div>
  </div>;
}
