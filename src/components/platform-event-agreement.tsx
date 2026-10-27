import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { platformSelection, type PlatformAgreement } from '@/lib/event-agreements';
export function usePlatformAgreement(eventId: string | undefined) {
  return useQuery({ queryKey: ['platform-event-agreement', eventId], enabled: !!eventId, queryFn: async () => {
    const { data, error } = await supabase.rpc('event_platform_agreement', { _event: eventId ?? '', _token: new URLSearchParams(window.location.search).get('k') ?? '' });
    if (error) throw error; return data as PlatformAgreement | null;
  } });
}
export function PlatformAgreementNotice({ agreement, loading }: { agreement: PlatformAgreement | null | undefined; loading: boolean }) {
  const { t, i18n } = useTranslation(); const selected = platformSelection(agreement, i18n.resolvedLanguage ?? 'en');
  return <section className="waiver-block" aria-busy={loading}><strong>{t('eventAgreements.title')}</strong>{loading ? <p>{t('publicEvent.loading')}</p> : !selected ? <p role="alert">{t('eventAgreements.legalRequired')}</p> : <><p>{t('waiver.version', { n: selected.version })}</p><Button asChild variant="secondary"><a href={selected.url ?? ''} target="_blank" rel="noopener noreferrer">{t('eventAgreements.open')}</a></Button></>}</section>;
}