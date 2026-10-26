import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, ExternalLink } from '@/components/icons';
import { Button } from '@/components/ui/button';

/**
 * Inline document viewer for PDFs with explicit Open and Download actions.
 * `src` must already be a signed/expiring or external URL; no storage paths reach here.
 */
export function DocumentViewer({ src, downloadSrc, title, loading, error, onRetry }: {
  src: string | null | undefined; downloadSrc?: string | null | undefined; title: string;
  loading?: boolean; error?: boolean; onRetry?: () => void;
}) {
  const { t } = useTranslation();
  const [frameLoaded, setFrameLoaded] = useState(false);
  if (loading) return <div className="player player-empty" aria-busy="true" role="status">{t('learnHub.docLoading')}</div>;
  if (error || !src) return <div className="player player-empty" role="alert">
    <p>{t('learnHub.docError')}</p>
    {onRetry && <Button variant="secondary" size="sm" onClick={onRetry}>{t('error.retry')}</Button>}
  </div>;
  return <div className="pdf-frame">
    <div className="pdf-frame-view">
      {!frameLoaded && <p className="muted-small pdf-frame-status" aria-hidden="true">{t('learnHub.docLoading')}</p>}
      <iframe src={src} title={title} onLoad={() => setFrameLoaded(true)} />
    </div>
    <p className="field-hint">{t('learnHub.docHint')}</p>
    <div className="sheet-actions">
      <Button asChild variant="secondary"><a href={src} target="_blank" rel="noopener noreferrer"><ExternalLink />{t('learnHub.openPdf')}<span className="sr-only"> {t('learnHub.newTab')}</span></a></Button>
      {downloadSrc !== null && <Button asChild variant="secondary"><a href={downloadSrc ?? src} download target="_blank" rel="noopener noreferrer"><Download />{t('learnHub.downloadPdf')}</a></Button>}
    </div>
  </div>;
}
