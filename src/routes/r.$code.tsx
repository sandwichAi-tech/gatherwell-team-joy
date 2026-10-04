import { useEffect, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { GatheringCover } from '@/components/gathering-cover';
import { Confirmation, Stepper } from '@/components/guest-rsvp';
import { ResponsiveSheet } from '@/components/responsive-sheet';
import { supabase } from '@/integrations/supabase/client';
import { rsvpByCodeQuery } from '@/lib/guest';
import { GuestShell } from '@/components/guest-shell';
import i18n from '@/lib/i18n';

export const Route = createFileRoute('/r/$code')({
  head: () => {
    const title = `${i18n.t('guest.manageTitle')} · ${i18n.t('brand')}`;
    return { meta: [{ title }, { name: 'description', content: i18n.t('guest.manageMeta') }, { property: 'og:title', content: title }, { property: 'og:description', content: i18n.t('guest.manageMeta') }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: 'robots', content: 'noindex' }] };
  },
  component: () => <GuestShell><ManageRsvp /></GuestShell>,
});

function ManageRsvp() {
  const { t } = useTranslation(); const { code } = Route.useParams(); const queryClient = useQueryClient();
  const { data, isLoading } = useQuery(rsvpByCodeQuery(code));
  const [plus, setPlus] = useState(0); const [busy, setBusy] = useState(false); const [confirmCancel, setConfirmCancel] = useState(false);
  useEffect(() => { if (data) setPlus(data.plus_ones); }, [data]);
  if (isLoading) return <p className="guest-empty">{t('publicEvent.loading')}</p>;
  if (!data) return <p className="guest-empty">{t('guest.codeNotFound')}</p>;
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['rsvp', code] });
  const update = async (status: 'going' | 'maybe') => {
    setBusy(true); const { data: st, error } = await supabase.rpc('update_rsvp_by_code', { _code: code, _status: status, _plus_ones: plus }); setBusy(false);
    if (error) { toast.error(t('guest.errors.generic')); return; }
    toast.success(t(st === 'waitlist' ? 'guest.toastWaitlist' : 'guest.toastSaved')); await refresh();
  };
  const cancel = async () => {
    setBusy(true); const { error } = await supabase.rpc('cancel_rsvp_by_code', { _code: code }); setBusy(false); setConfirmCancel(false);
    if (error) { toast.error(t('guest.errors.generic')); return; }
    toast.success(t('guest.toastCancelled')); await refresh();
  };
  const open = data.status !== 'cancelled' && data.event.status === 'published';
  return <>
    <GatheringCover path={data.event.cover_url} style={data.event.cover_style} title={data.event.title} className="guest-cover" />
    <article className="guest-body">
      {data.event.status === 'cancelled' && <p className="guest-cancelled" role="status"><strong>{t('guest.cancelledTitle')}</strong></p>}
      <Confirmation event={data.event} code={code} status={data.status} />
      {open && <section className="guest-card guest-manage">
        <h2 className="guest-subhead">{t('guest.manageTitle')}</h2>
        <div className="guest-plus"><span className="field-label">{t('guest.plusOnes')}</span><Stepper value={plus} onChange={setPlus} label={t('guest.plusOnes')} /></div>
        <div className="guest-button-row">
          <Button disabled={busy} onClick={() => update('going')}>{data.status === 'going' ? t('guest.saveChanges') : t('guest.imIn')}</Button>
          {data.status !== 'maybe' && <Button variant="secondary" disabled={busy} onClick={() => update('maybe')}>{t('guest.changeToMaybe')}</Button>}
        </div>
        <Button variant="ghost" className="danger-text" disabled={busy} onClick={() => setConfirmCancel(true)}>{t('guest.cancelRsvp')}</Button>
      </section>}
    </article>
    <ResponsiveSheet open={confirmCancel} onOpenChange={setConfirmCancel} title={t('guest.cancelRsvpTitle')} description={t('guest.cancelRsvpText')}>
      <div className="confirm-actions"><Button variant="secondary" onClick={() => setConfirmCancel(false)}>{t('gathering.keep')}</Button><Button className="danger-button" disabled={busy} onClick={cancel}>{t('guest.cancelRsvp')}</Button></div>
    </ResponsiveSheet>
  </>;
}
