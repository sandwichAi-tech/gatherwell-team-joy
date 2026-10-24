import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarPlus, Download, ArrowRight } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { ResponsiveSheet } from '@/components/responsive-sheet';
import { downloadIcsFile, googleCalendarUrl, outlookCalendarUrl, type IcsEvent } from '@/lib/ics';

/**
 * "Add to calendar" menu: .ics download (Apple Calendar and others),
 * Google Calendar and Outlook template links. No account connection implied.
 */
export function AddToCalendar({ event, filename }: { event: IcsEvent; filename?: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const external = { target: '_blank', rel: 'noopener noreferrer' } as const;
  return <>
    <Button variant="secondary" onClick={() => setOpen(true)}><CalendarPlus />{t('calendar.add')}</Button>
    <ResponsiveSheet open={open} onOpenChange={setOpen} title={t('calendar.add')} description={event.title}>
      <div className="calendar-options">
        <Button variant="secondary" className="calendar-option" onClick={() => { downloadIcsFile(event, filename); setOpen(false); }}>
          <Download /><span><strong>{t('calendar.download')}</strong><small>{t('calendar.downloadHint')}</small></span>
        </Button>
        <Button asChild variant="secondary" className="calendar-option">
          <a href={googleCalendarUrl(event)} {...external}><span><strong>{t('calendar.google')}</strong><small>{t('calendar.linkHint')}</small></span><ArrowRight /></a>
        </Button>
        <Button asChild variant="secondary" className="calendar-option">
          <a href={outlookCalendarUrl(event)} {...external}><span><strong>{t('calendar.outlook')}</strong><small>{t('calendar.linkHint')}</small></span><ArrowRight /></a>
        </Button>
      </div>
    </ResponsiveSheet>
  </>;
}
