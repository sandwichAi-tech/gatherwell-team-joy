import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { WaiverDocumentViewer, type ViewerDoc } from '@/components/event-waivers';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { agreementViewUrl, platformSelection, type PlatformAgreement } from '@/lib/event-agreements';
import { waiverInviteToken } from '@/lib/waiver-consent-context';
export function usePlatformAgreement(eventId: string | undefined) {
  const token = waiverInviteToken();
  return useQuery({ queryKey: ['platform-event-agreement', eventId, token], enabled: !!eventId, queryFn: async () => {
    const { data, error } = await supabase.rpc('event_platform_agreement', { _event: eventId ?? '', _token: token ?? '' });
    if (error) throw error; return data as PlatformAgreement | null;
  } });
}
export function PlatformAgreementNotice({ agreement, loading }: { agreement: PlatformAgreement | null | undefined; loading: boolean }) {
  const { t, i18n } = useTranslation(); const selected = platformSelection(agreement, i18n.resolvedLanguage ?? 'en'); const [viewer, setViewer] = useState<ViewerDoc | null>(null);
  return <section className="waiver-block" aria-busy={loading}><strong>{t('eventAgreements.title')}</strong>{loading ? <p>{t('publicEvent.loading')}</p> : !selected ? <p role="alert">{t('eventAgreements.legalRequired')}</p> : <><p>{t('waiver.version', { n: selected.version })}</p><Button type="button" variant="secondary" disabled={!selected.url} onClick={() => { const url = agreementViewUrl(selected.url, window.location.origin); if (url) setViewer({ url, title: t('eventAgreements.title') }); }}>{t('eventAgreements.open')}</Button></>}<WaiverDocumentViewer doc={viewer} onClose={() => setViewer(null)} /></section>;
}