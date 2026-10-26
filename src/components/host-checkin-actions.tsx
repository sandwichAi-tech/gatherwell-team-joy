import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { QrCode } from '@/components/icons';

export function HostCheckinActions({ userId }: { userId: string }) {
  const { t, i18n } = useTranslation();
  const { data = [] } = useQuery({ queryKey: ['host-checkin-events', userId], queryFn: async () => {
    const { data, error } = await supabase.rpc('my_checkin_events');
    if (error) throw error;
    return (data ?? []) as { id: string; title: string; starts_at: string }[];
  } });
  if (!data.length) return null;
  return <section className="upcoming-panel mb-6" aria-label={t('attendancePilot.quickCheckin')}>
    <h2>{t('attendancePilot.quickCheckin')}</h2>
    <ul className="customer-list">{data.map(event => <li key={event.id} className="customer-item">
      <strong>{event.title}</strong>
      <p className="field-hint">{new Date(event.starts_at).toLocaleString(i18n.resolvedLanguage === 'es' ? 'es-419' : 'en-US')}</p>
      <Button asChild className="min-h-12 whitespace-normal"><Link to="/event/$id/checkin" params={{ id: event.id }}><QrCode />{t('attendancePilot.quickCheckin')}</Link></Button>
    </li>)}</ul>
  </section>;
}