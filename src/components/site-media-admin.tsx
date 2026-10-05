import { useEffect, useRef, useState, type DragEvent, type MouseEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ResponsiveSheet } from '@/components/responsive-sheet';
import { BrandImage } from '@/components/brand-image';
import { GwFeatureTile, GwIcon } from '@/components/gw-icon';
import { SITE_MEDIA_BUCKET, cropToAspect, isAdminQuery, siteMediaKey, siteMediaQuery, type SiteMedia } from '@/lib/site-media';

export function SiteMediaAdmin() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const admin = useQuery(isAdminQuery(user?.id));
  const media = useQuery({ ...siteMediaQuery(), enabled: admin.data === true });
  const [editing, setEditing] = useState<SiteMedia | null>(null);

  if (admin.isLoading) return <div className="page-shell"><p className="muted-copy">{t('common.loading')}</p></div>;
  if (!admin.data) return <div className="page-shell"><section className="panel empty-panel"><GwFeatureTile name="Lock" /><h2 className="section-title">{t('siteMedia.denied')}</h2><p className="muted-copy">{t('siteMedia.deniedBody')}</p></section></div>;

  return (
    <div className="page-shell site-media-page">
      <header className="page-header"><div><p className="eyebrow">{t('siteMedia.eyebrow')}</p><h1 className="page-title">{t('siteMedia.title')}</h1><p className="page-subtitle">{t('siteMedia.subtitle')}</p></div></header>
      <div className="site-media-grid">
        {(media.data ?? []).map(row => (
          <button type="button" key={row.id} className="site-media-card" onClick={() => setEditing(row)}>
            <BrandImage src={row.url} resizable={row.resizable} focal={{ x: row.focal_x, y: row.focal_y }} aspect={row.aspect} alt={row.alt_en} sizes="(min-width: 768px) 320px, 50vw" />
            <span className="site-media-meta"><strong>{row.slot}</strong><small>{row.image_path ? t('siteMedia.custom') : t('siteMedia.temporary')}{row.credit ? ` · ${row.credit}` : ''}</small></span>
          </button>
        ))}
      </div>
      {editing && <SlotEditor row={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function SlotEditor({ row, onClose }: { row: SiteMedia; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [focal, setFocal] = useState({ x: row.focal_x, y: row.focal_y });
  const [altEn, setAltEn] = useState(row.alt_en);
  const [altEs, setAltEs] = useState(row.alt_es);
  const [credit, setCredit] = useState(row.credit ?? '');
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const pick = (f: File | undefined) => {
    if (!f || !f.type.startsWith('image/')) return;
    setFile(f); setPreview(URL.createObjectURL(f)); setFocal({ x: 0.5, y: 0.5 }); setCredit('');
  };
  const onDrop = (e: DragEvent) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files[0]); };
  const setPoint = (e: MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setFocal({ x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) });
  };

  const save = async () => {
    setBusy(true);
    try {
      let image_path = row.image_path;
      let fx = focal.x, fy = focal.y;
      if (file) {
        const blob = await cropToAspect(file, row.aspect, focal.x, focal.y);
        image_path = `${row.slot}/${Date.now()}.webp`;
        const { error } = await supabase.storage.from(SITE_MEDIA_BUCKET).upload(image_path, blob, { contentType: 'image/webp', upsert: false });
        if (error) throw error;
        fx = 0.5; fy = 0.5; // already cropped around the chosen point
      }
      const { error } = await supabase.from('site_media').update({ image_path, focal_x: fx, focal_y: fy, alt_en: altEn.trim(), alt_es: altEs.trim(), credit: credit.trim() || null }).eq('id', row.id);
      if (error) throw error;
      if (file && row.image_path) void supabase.storage.from(SITE_MEDIA_BUCKET).remove([row.image_path]);
      await qc.invalidateQueries({ queryKey: siteMediaKey });
      toast.success(t('siteMedia.saved'));
      onClose();
    } catch { toast.error(t('siteMedia.error')); } finally { setBusy(false); }
  };

  const reset = async () => {
    setBusy(true);
    const { error } = await supabase.from('site_media').update({ image_path: null, focal_x: 0.5, focal_y: 0.5, alt_en: row.default_alt_en, alt_es: row.default_alt_es, credit: row.default_credit }).eq('id', row.id);
    if (!error && row.image_path) void supabase.storage.from(SITE_MEDIA_BUCKET).remove([row.image_path]);
    await qc.invalidateQueries({ queryKey: siteMediaKey });
    setBusy(false);
    if (error) { toast.error(t('siteMedia.error')); return; }
    toast.success(t('siteMedia.resetDone')); onClose();
  };

  const shownUrl = preview ?? row.url;
  return (
    <ResponsiveSheet open onOpenChange={o => { if (!o) onClose(); }} title={row.slot} description={t('siteMedia.editHint')}>
      <div className="site-media-editor">
        <div className={`site-media-drop ${drag ? 'is-drag' : ''}`} onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={onDrop}>
          <div className="site-media-focal" onClick={setPoint} role="presentation">
            <BrandImage src={shownUrl} resizable={!preview && row.resizable} focal={focal} aspect={row.aspect} alt={altEn} sizes="480px" />
            <span className="focal-dot" style={{ left: `${focal.x * 100}%`, top: `${focal.y * 100}%` }} aria-hidden="true" />
          </div>
          <p className="muted-copy"><GwIcon name="Crop" size={16} /> {t('siteMedia.focalHint', { ratio: row.aspect.toFixed(2) })}</p>
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif" hidden onChange={e => pick(e.target.files?.[0])} />
          <Button type="button" variant="secondary" onClick={() => inputRef.current?.click()}><GwIcon name="UploadSimple" />{row.image_path || file ? t('siteMedia.replace') : t('siteMedia.upload')}</Button>
          <small className="muted-copy">{t('siteMedia.dropHint')}</small>
        </div>
        <label className="form-field"><span className="field-label">{t('siteMedia.altEn')}</span><Input value={altEn} onChange={e => setAltEn(e.target.value)} maxLength={200} /></label>
        <label className="form-field"><span className="field-label">{t('siteMedia.altEs')}</span><Input value={altEs} onChange={e => setAltEs(e.target.value)} maxLength={200} /></label>
        <label className="form-field"><span className="field-label">{t('siteMedia.credit')}</span><Input value={credit} onChange={e => setCredit(e.target.value)} maxLength={120} /></label>
        <div className="sheet-actions">
          <Button type="button" variant="ghost" disabled={busy || (!row.image_path && !file)} onClick={() => void reset()}><GwIcon name="ArrowCounterClockwise" />{t('siteMedia.reset')}</Button>
          <Button type="button" disabled={busy || !altEn.trim() || !altEs.trim()} onClick={() => void save()}>{busy ? t('common.saving') : t('common.save')}</Button>
        </div>
      </div>
    </ResponsiveSheet>
  );
}
