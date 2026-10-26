import { useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useTranslation } from 'react-i18next';
import { ResponsiveSheet } from '@/components/responsive-sheet';
import { CopyButton } from '@/components/copy-button';
import { formatWhen } from '@/lib/guest';

/** The signed-in attendee's own registration; the code comes only from their RLS-scoped RSVP row. */
export type CheckinQrTarget = { code: string; title: string; startsAt: string; checkedInAt: string | null };

/** Grouped manual fallback, e.g. AB12-CD34. The QR itself encodes the raw code the scanner expects. */
export const groupedCheckinCode = (code: string) => code.toUpperCase().replace(/(.{4})(?=.)/g, '$1-');

export function CheckinQrSheet({ target, onClose }: { target: CheckinQrTarget | null; onClose: () => void }) {
  const { t, i18n } = useTranslation(); const lang = i18n.resolvedLanguage === 'es' ? 'es' : 'en';
  const view = useRef<HTMLDivElement>(null);
  // Phone drawers do not move focus on their own; put keyboard and screen-reader focus inside the QR view.
  useEffect(() => { if (!target) return; const id = window.setTimeout(() => { if (!view.current?.closest('[role=dialog]')?.contains(document.activeElement)) view.current?.focus(); }, 50); return () => window.clearTimeout(id); }, [target]);
  return <ResponsiveSheet open={!!target} onOpenChange={o => { if (!o) onClose(); }} icon="QrCode" title={target?.title ?? t('checkinQr.title')} description={target ? formatWhen(target.startsAt, lang) : undefined}>
    {target && <div ref={view} tabIndex={-1} className="checkin-qr-view">
      <span className="chip published-chip" role="status">{target.checkedInAt ? t('checkinQr.checkedIn') : t('checkinQr.registered')}</span>
      <div className="ticket-qr"><QRCodeSVG value={target.code} size={280} level="M" marginSize={4} title={t('checkinQr.qrLabel', { title: target.title })} /></div>
      <p className="muted">{t('checkinQr.help')}</p>
      <p className="field-hint">{t('checkinQr.manual')}</p>
      <p className="checkin-qr-code" aria-label={t('checkinQr.manual')}>{groupedCheckinCode(target.code)}</p>
      <CopyButton text={target.code} label={t('checkinQr.copy')} />
    </div>}
  </ResponsiveSheet>;
}
