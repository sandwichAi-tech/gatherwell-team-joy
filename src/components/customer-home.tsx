import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { EmptyState, ListSkeleton, RetryState } from '@/components/launch-states';
import { CalendarButtons, DirectionsButton } from '@/components/guest-rsvp';
import { ChevronRight } from '@/components/icons';
import { formatWhen } from '@/lib/guest';
import { isLive, offerTitle, purchasesQuery } from '@/lib/offers';

type Ev = { id: string; title: string; starts_at: string; ends_at: string | null; location_name: string | null; address: string | null; lat: number | null; lng: number | null; host_id: string; offer_id: string | null; status: string };
const EV = 'id, title, starts_at, ends_at, location_name, address, lat, lng, host_id, offer_id, status';

/** Customer Home: only the person's own RSVPs, Circles and attended gatherings — every block is real data. */
const customerHomeQuery = (userId: string, offerIds: string[]) => ({
  queryKey: ['customer-home', userId, offerIds.join(',')],
  queryFn: async () => {
    const { data: rows, error } = await supabase.from('rsvps').select(`status, checkin_code, checked_in_at, event:events(${EV})`).eq('user_id', userId).in('status', ['going', 'waitlist', 'maybe']).limit(200);
    if (error) throw error;
    const now = Date.now();
    const list = (rows ?? []).filter(r => r.event) as unknown as { status: string; checkin_code: string | null; checked_in_at: string | null; event: Ev }[];
    const next = list.filter(r => new Date(r.event.ends_at ?? r.event.starts_at).getTime() >= now && r.event.status === 'published').sort((a, b) => a.event.starts_at.localeCompare(b.event.starts_at));
    const past = list.filter(r => r.checked_in_at && new Date(r.event.starts_at).getTime() < now).sort((a, b) => b.event.starts_at.localeCompare(a.event.starts_at)).slice(0, 5);
    const hosts = [...new Set(past.map(r => r.event.host_id))];
    const nowIso = new Date().toISOString();
    const [{ data: upcomingByHost }, { data: members }] = await Promise.all([
      hosts.length ? supabase.from('events').select('id, host_id, starts_at').in('host_id', hosts).eq('status', 'published').gte('starts_at', nowIso).order('starts_at').limit(50) : Promise.resolve({ data: [] as { id: string; host_id: string; starts_at: string }[] }),
      offerIds.length ? supabase.from('events').select(EV).in('offer_id', offerIds).eq('status', 'published').gte('starts_at', nowIso).order('starts_at').limit(6) : Promise.resolve({ data: [] as Ev[] }),
    ]);
    const nextByHost = new Map<string, string>();
    for (const e of upcomingByHost ?? []) if (!nextByHost.has(e.host_id)) nextByHost.set(e.host_id, e.id);
    return { next, past: past.map(r => ({ ...r, againId: nextByHost.get(r.event.host_id) ?? null })), members: (members ?? []) as Ev[] };
  },
});

export function CustomerHome({ userId }: { userId: string }) {
  const { t, i18n } = useTranslation(); const lang = i18n.resolvedLanguage;
  const purchases = useQuery(purchasesQuery(userId));
  const circles = (purchases.data ?? []).filter(p => p.offer?.kind === 'membership' && isLive(p));
  const q = useQuery({ ...customerHomeQuery(userId, circles.map(c => c.offer_id)), enabled: purchases.isSuccess || purchases.isError });
  if (q.isPending) return <ListSkeleton />;
  if (q.isError) return <RetryState retry={() => void q.refetch()} />;
  const { next, past, members } = q.data;
  return <>
    <section className="panel" aria-labelledby="ch-next"><div className="section-heading"><h2 id="ch-next">{t('customerHome.next')}</h2></div>
      {!next.length ? <EmptyState compact icon="CalendarDays" title={t('customerHome.noRsvps')} text={t('customerHome.noRsvpsText')} action={<Button asChild><Link to="/discover">{t('customerHome.find')}</Link></Button>} />
        : <ul className="customer-list">{next.map(r => <li key={r.event.id} className="customer-item">
          <Link to="/e/$id" params={{ id: r.event.id }} className="customer-item-head"><strong>{r.event.title}</strong><small>{formatWhen(r.event.starts_at, lang)}{r.event.location_name ? ` · ${r.event.location_name}` : ''}</small><ChevronRight /></Link>
          {r.checkin_code && r.status === 'going' && <p className="customer-code">{t('customerHome.code')} <code>{r.checkin_code}</code></p>}
          {r.status === 'waitlist' && <p className="auth-subtitle">{t('customerHome.waitlist')}</p>}
          <CalendarButtons event={r.event} />
          <DirectionsButton event={r.event} />
        </li>)}</ul>}
    </section>
    {circles.length > 0 && <section className="panel" aria-labelledby="ch-circles"><div className="section-heading"><h2 id="ch-circles">{t('customerHome.circles')}</h2><Button asChild variant="link"><Link to="/circles">{t('home.viewAll')}</Link></Button></div>
      <ul className="customer-list">{circles.slice(0, 3).map(c => <li key={c.id}><Link to="/offer/$id" params={{ id: c.offer_id }} className="customer-item-head"><strong>{offerTitle(c.offer!, lang)}</strong><small>{t('customerHome.latest')}</small><ChevronRight /></Link></li>)}
        {members.map(e => <li key={e.id}><Link to="/e/$id" params={{ id: e.id }} className="customer-item-head"><strong>{e.title}</strong><small>{t('customerHome.membersOnly')} · {formatWhen(e.starts_at, lang)}</small><ChevronRight /></Link></li>)}</ul>
    </section>}
    {past.length > 0 && <section className="panel" aria-labelledby="ch-past"><div className="section-heading"><h2 id="ch-past">{t('customerHome.past')}</h2></div>
      <ul className="customer-list">{past.map(r => <li key={r.event.id} className="customer-item-head is-static"><span><strong>{r.event.title}</strong><small>{formatWhen(r.event.starts_at, lang)}</small></span>{r.againId && <Button asChild variant="secondary" size="sm"><Link to="/e/$id" params={{ id: r.againId }}>{t('customerHome.again')}</Link></Button>}</li>)}</ul>
    </section>}
  </>;
}
