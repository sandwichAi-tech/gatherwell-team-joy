import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { CalendarDays, MapPin, Video } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { GatheringCover } from '@/components/gathering-cover';
import { ResponsiveSheet } from '@/components/responsive-sheet';
import { ListSkeleton } from '@/components/launch-states';
import { supabase } from '@/integrations/supabase/client';
import { formatWhen } from '@/lib/guest';

export type MyTicket = {
  id: string; event_id: string; status: 'going' | 'maybe' | 'waitlist' | 'cancelled' | 'requested' | 'declined';
  plus_ones: number; checkin_code: string; created_at: string;
  waitlist_position: number | null; tier_name: string | null;
  waiver: { version: number; accepted_at: string } | null;
  terms_version: number | null; terms_accepted_at: string | null;
  cancelled_by_host: boolean; cancel_reason: string | null;
  event: {
    id: string; title: string; starts_at: string; ends_at: string | null; timezone: string;
    location_name: string | null; address: string | null; meeting_note: string | null;
    online_url: string | null; cover_url: string | null; cover_style: number | null; status: string; capacity: number | null;
  };
};

export const myTicketsQuery = () => ({
  queryKey: ['my-tickets'],
  queryFn: async (): Promise<MyTicket[]> => {
    const { data, error } = await (supabase as unknown as { rpc: (fn: string) => Promise<{ data: unknown; error: unknown }> }).rpc('my_tickets');
    if (error) throw error;
    return (data as MyTicket[]) ?? [];
  },
});

/** Signed-in attendee's registrations: status, waitlist position, waiver/terms records, cancellation. */
export function MyTickets() {
  const { t, i18n } = useTranslation(); const lang = i18n.resolvedLanguage === 'es' ? 'es' : 'en';
  const queryClient = useQueryClient();
  const { data = [], isLoading } = useQuery(myTicketsQuery());
  const [cancelling, setCancelling] = useState<MyTicket | null>(null);
  const [busy, setBusy] = useState(false);

  const cancel = async () => {
    if (!cancelling) return;
    setBusy(true);
    const { error } = await supabase.rpc('cancel_rsvp_by_code', { _code: cancelling.checkin_code });
    setBusy(false); setCancelling(null);
    if (error) { toast.error(t('guest.errors.generic')); return; }
    toast.success(t('guest.toastCancelled'));
    await queryClient.invalidateQueries({ queryKey: ['my-tickets'] });
  };

  if (isLoading) return <ListSkeleton />;
  if (!data.length) return <section className="panel empty-gatherings">
    <h2>{t('tickets.empty')}</h2><p>{t('tickets.emptyText')}</p>
    <Button asChild><Link to="/discover">{t('tickets.discover')}</Link></Button>
  </section>;

  return <>
    <div className="gathering-grid">
      {data.map(r => {
        const e = r.event;
        const place = [e.location_name, e.address].filter(Boolean).join(' · ');
        const active = ['going', 'maybe', 'waitlist'].includes(r.status);
        return <article key={r.id} className="gathering-card ticket-card">
          <GatheringCover path={e.cover_url} style={e.cover_style} title={e.title} className="card-strip" eventId={e.id} />
          <div className="gathering-card-body">
            <div className="event-info">
              <h3>{e.title}</h3>
              <p><CalendarDays /> {formatWhen(e.starts_at, lang)}</p>
              {place && <p><MapPin /> {place}</p>}
              <div className="event-registration">
                <span className={`chip ${r.status === 'going' ? 'published-chip' : ''}`}>{t(`guestList.tabs.${r.status}`)}</span>
                {r.tier_name && <span className="chip quiet-chip">{t('tickets.tierLine', { name: r.tier_name })}</span>}
                {r.plus_ones > 0 && <span className="chip">+{r.plus_ones}</span>}
              </div>
              {r.status === 'waitlist' && r.waitlist_position != null && <p className="waitlist-position" role="status"><strong>{t('guest.waitlistPosition', { n: r.waitlist_position })}</strong></p>}
              {r.cancelled_by_host && <p className="muted" role="status">{t('tickets.hostCancelled')}{r.cancel_reason ? `: ${r.cancel_reason}` : ''}</p>}
              {r.waiver && <p className="muted">{t('tickets.waiverLine', { version: r.waiver.version })}</p>}
              {r.terms_version != null && <p className="muted">{t('tickets.termsLine', { version: r.terms_version })}</p>}
              <div className="guest-button-row">
                {e.online_url && active && <Button asChild variant="secondary"><a href={e.online_url} target="_blank" rel="noopener noreferrer"><Video />{t('guest.joinOnline')}</a></Button>}
                <Button asChild><Link to="/ticket/$code" params={{ code: r.checkin_code }}>{t('tickets.viewTicket')}</Link></Button>
                <Button asChild variant="secondary"><Link to="/r/$code" params={{ code: r.checkin_code }}>{t('guest.manage')}</Link></Button>
                {active && <Button variant="ghost" className="danger-text" onClick={() => setCancelling(r)}>{t('tickets.cancel')}</Button>}
              </div>
            </div>
          </div>
        </article>;
      })}
    </div>
    <ResponsiveSheet open={!!cancelling} onOpenChange={o => !o && setCancelling(null)} title={t('tickets.cancelTitle')} description={t('tickets.cancelText')}>
      <div className="confirm-actions"><Button variant="secondary" onClick={() => setCancelling(null)}>{t('tickets.keep')}</Button><Button className="danger-button" disabled={busy} onClick={cancel}>{t('tickets.cancel')}</Button></div>
    </ResponsiveSheet>
  </>;
}
