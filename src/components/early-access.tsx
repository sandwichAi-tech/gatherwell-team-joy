import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Clock, Crown } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { myOffersQuery } from '@/lib/offers';

export type EarlyAccess = { public_at: string; offer_id: string; offer_title_en: string | null; offer_title_es: string | null; has_access: boolean } | null;

export const earlyAccessQuery = (eventId: string) => ({
  queryKey: ['early-access', eventId],
  queryFn: async (): Promise<EarlyAccess> => {
    const { data, error } = await supabase.rpc('event_early_access', { _event: eventId });
    if (error) throw error;
    return (data as EarlyAccess) ?? null;
  },
});

export const waitlistPositionQuery = (code: string, enabled: boolean) => ({
  queryKey: ['waitlist-position', code],
  enabled,
  queryFn: async (): Promise<number | null> => {
    const { data, error } = await supabase.rpc('waitlist_position', { _code: code });
    if (error) throw error;
    return (data as number | null) ?? null;
  },
});

const whenText = (iso: string, lang: string) => new Date(iso).toLocaleString(lang, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/** Guest page: real opening time for the public; never a countdown. */
export function EarlyAccessNotice({ access }: { access: NonNullable<EarlyAccess> }) {
  const { t, i18n } = useTranslation(); const lang = i18n.resolvedLanguage ?? 'en';
  const circle = (lang === 'es' ? access.offer_title_es : access.offer_title_en) || access.offer_title_en || access.offer_title_es || '';
  return <section className="guest-card early-access-notice" role="status">
    <span className="early-access-icon"><Crown /></span>
    <div>
      <strong>{access.has_access ? t('early.youreIn', { circle }) : t('early.membersFirst', { circle })}</strong>
      <p>{access.has_access ? t('early.youreInText', { when: whenText(access.public_at, lang) }) : t('early.opensAt', { when: whenText(access.public_at, lang) })}</p>
    </div>
  </section>;
}

/** Host: give a membership early RSVP access. */
export function EarlyAccessPanel({ eventId, hostId }: { eventId: string; hostId: string }) {
  const { t, i18n } = useTranslation(); const lang = i18n.resolvedLanguage ?? 'en'; const qc = useQueryClient();
  const { data: access } = useQuery(earlyAccessQuery(eventId));
  const { data: offers = [] } = useQuery(myOffersQuery(hostId));
  const memberships = offers.filter(o => o.kind === 'membership' && o.status === 'published');
  if (!memberships.length && !access) return null;
  const set = async (offer: string | null) => {
    const { error } = await supabase.rpc('set_early_access', { _event: eventId, _offer: offer as string, _hours: 48 });
    if (error) { toast.error(t('early.error')); return; }
    toast.success(t(offer ? 'early.on' : 'early.off')); await qc.invalidateQueries({ queryKey: ['early-access', eventId] });
  };
  return <section className="detail-section early-access-panel">
    <h2 className="section-title">{t('early.title')}</h2>
    {access ? <>
      <p className="gw-muted-line"><Clock className="inline-icon" />{t('early.activeUntil', { when: whenText(access.public_at, lang) })}</p>
      <Button variant="outline" onClick={() => void set(null)}>{t('early.openNow')}</Button>
    </> : <>
      <p className="gw-muted-line">{t('early.hint')}</p>
      <div className="early-access-options">{memberships.map(o => <Button key={o.id} variant="outline" onClick={() => void set(o.id)}><Crown />{t('early.giveTo', { circle: (lang === 'es' ? o.title_es : o.title_en) || o.title_en })}</Button>)}</div>
    </>}
  </section>;
}
