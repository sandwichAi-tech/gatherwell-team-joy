import { markLinkShared } from '@/components/coach-launch';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { Download, Share2, MessageCircle, MessageSquareText, Send, Sparkles } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { CopyButton, copyText } from '@/components/copy-button';
import { mediaUrl } from '@/lib/account';
import { COVER_STYLES } from '@/lib/gatherings';
import { shareCaption } from '@/lib/smart.functions';
import { trackEvent } from '@/lib/analytics';

export type ShareFormat = 'square' | 'story' | 'wide';
const SIZES: Record<ShareFormat, [number, number]> = { square: [1080, 1080], story: [1080, 1920], wide: [1200, 675] };
type Opts = { title: string; date: string; place: string; link: string; cover: HTMLImageElement | null; coverStyle: number | null; brand: string };

const loadImg = (src: string) => new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = rej; i.src = src; });

function wrap(g: CanvasRenderingContext2D, text: string, max: number, lines: number) {
  const out: string[] = []; let line = '';
  for (const w of text.split(/\s+/)) { const t = line ? `${line} ${w}` : w; if (g.measureText(t).width > max && line) { out.push(line); line = w; } else line = t; }
  out.push(line);
  if (out.length > lines) { out.length = lines; out[lines - 1] = out[lines - 1]!.replace(/\s*\S*$/, '') + '…'; }
  return out;
}

/** Premium share image: cover photo (or brand gradient) on top, plum panel with title, date, place and short link. */
export async function renderShareImage(format: ShareFormat, o: Opts): Promise<Blob | null> {
  const [W, H] = SIZES[format];
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  const wide = format === 'wide';
  g.fillStyle = '#2F2340'; g.fillRect(0, 0, W, H);
  // Cover area: top portion for square/story, left half for wide.
  const cw = wide ? Math.round(W * 0.48) : W, ch = wide ? H : Math.round(H * (format === 'story' ? 0.6 : 0.52));
  let drew = false;
  if (o.cover) { const s = Math.max(cw / o.cover.width, ch / o.cover.height); try { g.drawImage(o.cover, (cw - o.cover.width * s) / 2, (ch - o.cover.height * s) / 2, o.cover.width * s, o.cover.height * s); drew = true; } catch { drew = false; } }
  if (!drew) {
    const stops = ((COVER_STYLES[(o.coverStyle ?? 0) % COVER_STYLES.length] ?? COVER_STYLES[0]).match(/#[0-9A-F]{6}/gi) ?? ['#2F2340', '#7A5FA8']);
    const grad = g.createLinearGradient(0, 0, cw, ch); stops.forEach((col, i) => grad.addColorStop(i / Math.max(1, stops.length - 1), col));
    g.fillStyle = grad; g.fillRect(0, 0, cw, ch);
  }
  const fade = wide ? g.createLinearGradient(cw - 220, 0, cw, 0) : g.createLinearGradient(0, ch - 360, 0, ch);
  fade.addColorStop(0, 'rgba(47,35,64,0)'); fade.addColorStop(1, 'rgba(47,35,64,1)');
  g.fillStyle = fade; if (wide) g.fillRect(cw - 220, 0, 220, H); else g.fillRect(0, ch - 360, W, 360);

  const font = (w: number, s: number) => `${w} ${s}px Inter, system-ui, sans-serif`;
  const x = wide ? cw + 56 : 88, maxW = wide ? W - cw - 112 : W - 176;
  const big = wide ? 56 : format === 'story' ? 96 : 80;
  let y = wide ? 150 : ch + (format === 'story' ? 60 : 30);
  g.fillStyle = '#F3C6A5'; g.font = font(700, wide ? 24 : 32); g.fillText(o.brand.toUpperCase(), x, y); y += wide ? 76 : 110;
  g.fillStyle = '#FFFFFF'; g.font = font(800, big);
  for (const l of wrap(g, o.title, maxW, wide ? 3 : 2)) { g.fillText(l, x, y); y += big * 1.12; }
  y += wide ? 8 : 16;
  g.fillStyle = '#E6DFEE'; g.font = font(600, wide ? 28 : 42); g.fillText(wrap(g, o.date, maxW, 1)[0]!, x, y); y += wide ? 44 : 62;
  if (o.place) { g.fillStyle = '#C9BFD6'; g.font = font(500, wide ? 26 : 38); g.fillText(wrap(g, o.place, maxW, 1)[0]!, x, y); }
  // Link pill along the bottom.
  const link = o.link.replace(/^https?:\/\//, '').replace(/\?.*$/, '');
  g.font = font(600, wide ? 24 : 34);
  const pw = Math.min(maxW, g.measureText(link).width + (wide ? 48 : 64)), ph = wide ? 52 : 76, py = H - (wide ? 56 : 88) - ph;
  g.fillStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.roundRect(x, py, pw, ph, ph / 2); g.fill();
  g.fillStyle = '#FFFFFF'; g.fillText(wrap(g, link, pw - 48, 1)[0]!, x + (wide ? 24 : 32), py + ph / 2 + (wide ? 9 : 12));
  return new Promise(r => c.toBlob(r, 'image/png'));
}

export type ShareKitProps = { title: string; startsAt: string; timezone?: string | null; place: string; link: string; coverPath?: string | null; coverStyle?: number | null };

/** Social share kit: three image sizes, bilingual caption and one-tap share actions. */
export function ShareKit({ title, startsAt, timezone, place, link, coverPath, coverStyle = null }: ShareKitProps) {
  const { t, i18n } = useTranslation(); const lang = i18n.resolvedLanguage === 'es' ? 'es' : 'en';
  const [format, setFormat] = useState<ShareFormat>('square');
  const [images, setImages] = useState<Partial<Record<ShareFormat, { blob: Blob; url: string }>>>({});
  const [caption, setCaption] = useState<{ en: string; es: string; preview: boolean } | null>(null);
  const [writing, setWriting] = useState(false);
  const getCaption = useServerFn(shareCaption);
  const fmt = (l: string) => new Date(startsAt).toLocaleString(l, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', ...(timezone ? { timeZone: timezone } : {}) });
  const date = fmt(lang === 'es' ? 'es-MX' : 'en-US');

  useEffect(() => {
    let alive = true; const made: string[] = [];
    void (async () => {
      const wideUrl = await mediaUrl(coverPath).catch(() => null);
      const sqUrl = coverPath ? await mediaUrl(coverPath.replace(/\.webp$/, '-square.webp')).catch(() => null) : null;
      const wideImg = wideUrl ? await loadImg(wideUrl).catch(() => null) : null;
      const sqImg = sqUrl ? await loadImg(sqUrl).catch(() => null) : null;
      const base = { title, date, place, link, coverStyle, brand: t('brand') };
      for (const f of ['square', 'story', 'wide'] as ShareFormat[]) {
        const blob = await renderShareImage(f, { ...base, cover: f === 'wide' ? wideImg : sqImg ?? wideImg });
        if (!alive || !blob) continue;
        const url = URL.createObjectURL(blob); made.push(url);
        setImages(s => ({ ...s, [f]: { blob, url } }));
      }
    })();
    return () => { alive = false; made.forEach(u => URL.revokeObjectURL(u)); setImages({}); };
  }, [title, date, place, link, coverPath, coverStyle, t]);

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
