import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ResponsiveSheet } from '@/components/responsive-sheet';

export type CropKind = 'cover' | 'avatar';
export type CropResult = { file: File; square: File | null; previewUrl: string };

const PRESETS = [
  { key: 'wide', ratio: 16 / 9 },
  { key: 'square', ratio: 1 },
  { key: 'story', ratio: 9 / 16 },
] as const;
const MAX = 2400;

type View = { w: number; h: number };

function frameSize(ratio: number, maxW: number): View {
  const maxH = Math.min(420, Math.round(window.innerHeight * 0.5));
  let w = maxW, h = Math.round(w / ratio);
  if (h > maxH) { h = maxH; w = Math.round(h * ratio); }
  return { w, h };
}

function encode(img: HTMLImageElement, sx: number, sy: number, sw: number, sh: number, name: string): Promise<File> {
  const scale = Math.min(1, MAX / Math.max(sw, sh));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(sw * scale)); canvas.height = Math.max(1, Math.round(sh * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('canvas_unavailable'));
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(new File([b], `${name}.webp`, { type: 'image/webp' })) : reject(new Error('encode'))), 'image/webp', 0.82));
}

/** Crop step: aspect presets (covers), zoom, drag to position and a live preview. Outputs WebP up to 2400px. */
export function ImageCropSheet({ file, kind, withSquare, onCancel, onDone }: { file: File | null; kind: CropKind; withSquare?: boolean | undefined; onCancel: () => void; onDone: (r: CropResult) => void }) {
  const { t } = useTranslation();
  const [src, setSrc] = useState<string | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [ratio, setRatio] = useState(kind === 'avatar' ? 1 : 16 / 9);
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [maxW, setMaxW] = useState(340);
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const preview = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!file) { setSrc(null); setImg(null); return; }
    const url = URL.createObjectURL(file); setSrc(url); setZoom(1); setOff({ x: 0, y: 0 }); setRatio(kind === 'avatar' ? 1 : 16 / 9);
    const el = new Image(); el.onload = () => setImg(el); el.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file, kind]);
  useEffect(() => {
    const el = box.current; if (!el) return;
    const measure = () => { const w = el.clientWidth; if (w > 0) setMaxW(Math.min(480, w)); };
    measure(); const ro = new ResizeObserver(measure); ro.observe(el);
    return () => ro.disconnect();
  }, [img]);

  const view = frameSize(ratio, maxW);
  const base = img ? Math.max(view.w / img.naturalWidth, view.h / img.naturalHeight) : 1;
  const scale = base * zoom;
  const iw = img ? img.naturalWidth * scale : 0, ih = img ? img.naturalHeight * scale : 0;
  const clamp = (o: { x: number; y: number }) => ({ x: Math.max(-(iw - view.w) / 2, Math.min((iw - view.w) / 2, o.x)), y: Math.max(-(ih - view.h) / 2, Math.min((ih - view.h) / 2, o.y)) });
  const pos = clamp(off);
  const left = (view.w - iw) / 2 + pos.x, top = (view.h - ih) / 2 + pos.y;
  const rect = { sx: -left / scale, sy: -top / scale, sw: view.w / scale, sh: view.h / scale };

  useEffect(() => {
    const c = preview.current; if (!c || !img) return;
    const pw = kind === 'avatar' ? 72 : 120, ph = Math.round(pw / ratio); c.width = pw * 2; c.height = ph * 2; c.style.width = `${pw}px`; c.style.height = `${ph}px`;
    const ctx = c.getContext('2d'); if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(img, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, c.width, c.height);
  });

  const down = (e: RPointerEvent<HTMLDivElement>) => { e.currentTarget.setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, ox: pos.x, oy: pos.y }; };
  const move = (e: RPointerEvent<HTMLDivElement>) => { const d = drag.current; if (!d) return; setOff(clamp({ x: d.ox + e.clientX - d.x, y: d.oy + e.clientY - d.y })); };
  const up = () => { drag.current = null; };
  const nudge = (dx: number, dy: number) => setOff(clamp({ x: pos.x + dx, y: pos.y + dy }));

  const apply = async () => {
    if (!img) return; setBusy(true);
    try {
      const out = await encode(img, rect.sx, rect.sy, rect.sw, rect.sh, kind);
      let square: File | null = null;
      if (withSquare && Math.abs(ratio - 1) > 0.01) {
        const side = Math.min(rect.sw, rect.sh);
        square = await encode(img, rect.sx + (rect.sw - side) / 2, rect.sy + (rect.sh - side) / 2, side, side, `${kind}-square`);
      }
      onDone({ file: out, square, previewUrl: URL.createObjectURL(out) });
    } finally { setBusy(false); }
  };

  return <span onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
    <ResponsiveSheet open={!!file} onOpenChange={o => !o && onCancel()} title={t(kind === 'avatar' ? 'crop.titleAvatar' : 'crop.title')} description={t('crop.hint')}
      footer={<div className="crop-footer"><Button variant="secondary" onClick={onCancel}>{t('crop.cancel')}</Button><Button disabled={!img || busy} onClick={() => void apply()}>{busy ? t('onboarding.saving') : t('crop.apply')}</Button></div>}>
      <div className="crop-body" ref={box}>
        {kind === 'cover' && <div className="segmented crop-presets" role="group" aria-label={t('crop.shape')}>
          {PRESETS.map(p => <button key={p.key} type="button" className={ratio === p.ratio ? 'selected' : ''} aria-pressed={ratio === p.ratio} onClick={() => { setRatio(p.ratio); setOff({ x: 0, y: 0 }); }}>{t(`crop.${p.key}`)}</button>)}
        </div>}
        <div className={`crop-frame ${kind === 'avatar' ? 'is-circle' : ''}`} style={{ width: view.w, height: view.h }} role="slider" tabIndex={0}
          aria-label={t('crop.position')} aria-valuetext={t('crop.position')} aria-valuenow={0}
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
          onKeyDown={e => { const s = 16; if (e.key === 'ArrowLeft') nudge(s, 0); else if (e.key === 'ArrowRight') nudge(-s, 0); else if (e.key === 'ArrowUp') nudge(0, s); else if (e.key === 'ArrowDown') nudge(0, -s); else return; e.preventDefault(); }}>
          {src && img && <img src={src} alt="" draggable={false} style={{ width: iw, height: ih, transform: `translate(${left}px, ${top}px)` }} />}
        </div>
        <label className="crop-zoom"><span className="field-label">{t('crop.zoom')}</span>
          <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={e => setZoom(Number(e.target.value))} aria-label={t('crop.zoom')} /></label>
        <div className="crop-preview"><span className="field-label">{t('crop.preview')}</span><canvas ref={preview} className={kind === 'avatar' ? 'is-circle' : ''} aria-hidden="true" /></div>
      </div>
    </ResponsiveSheet>
  </span>;
}

/** Hidden file input + crop step. Drop inside an existing upload label in place of the raw input. */
export function CropFileInput({ kind, withSquare, capture, onCropped, onRejected, maxBytes = 15 * 1024 * 1024, className = 'sr-only' }: { kind: CropKind; withSquare?: boolean | undefined; capture?: 'user' | 'environment'; onCropped: (r: CropResult) => void; onRejected?: () => void; maxBytes?: number; className?: string }) {
  const [file, setFile] = useState<File | null>(null);
  return <>
    <input type="file" accept="image/*" className={className} {...(capture ? { capture } : {})} onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; if (!f.type.startsWith('image/') || f.size > maxBytes) { onRejected?.(); return; } setFile(f); }} />
    <ImageCropSheet file={file} kind={kind} withSquare={withSquare} onCancel={() => setFile(null)} onDone={r => { setFile(null); onCropped(r); }} />
  </>;
}

