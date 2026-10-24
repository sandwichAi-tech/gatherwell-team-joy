import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGatherwell } from '@/components/gatherwell-shell';
import { savedQuery, type CatalogItem } from '@/lib/discovery';
import { ListSkeleton, RetryState, EmptyState } from '@/components/launch-states';
import { SaveButton } from '@/components/save-button';
import { GwIcon } from '@/components/gw-icon';

type SavedRow = { kind: 'event' | 'offer'; target_id: string; created_at: string };

const savedRowsQuery = (userId: string | undefined) => queryOptions({
  queryKey: ['saved-offering-rows', userId],
  enabled: !!userId,
  queryFn: async () => {
    const { data, error } = await supabase.from('saved_offerings').select('kind, target_id, created_at').eq('user_id', userId!).order('created_at', { ascending: false });
    if (error) throw error;
    return data as SavedRow[];
  },
});

/** Resolve saved rows to display data; saved items that are no longer public simply drop out. */
const savedDetailsQuery = (rows: SavedRow[] | undefined) => queryOptions({
  queryKey: ['saved-offering-details', rows?.map(r => `${r.kind}:${r.target_id}`)],
  enabled: !!rows?.length,
  queryFn: async () => {
    const eventIds = rows!.filter(r => r.kind === 'event').map(r => r.target_id);
    const offerIds = rows!.filter(r => r.kind === 'offer').map(r => r.target_id);
    const [ev, of] = await Promise.all([
      eventIds.length ? supabase.from('events').select('id, title, summary_en, starts_at, timezone, location_name, format, price_cents, status, visibility').in('id', eventIds) : Promise.resolve({ data: [], error: null }),
      offerIds.length ? supabase.from('offers').select('id, title_en, summary_en, kind, price_cents, status, visibility').in('id', offerIds) : Promise.resolve({ data: [], error: null }),
    ]);
    if (ev.error) throw ev.error;
    if (of.error) throw of.error;
    const items: CatalogItem[] = [];
    for (const e of ev.data ?? []) {
      if (e.status !== 'published' || e.visibility !== 'public') continue; // saved item went private/draft
      items.push({ kind: 'event', id: e.id, title: e.title, summary: e.summary_en ?? '', category: null, tags: null, starts_at: e.starts_at, timezone: e.timezone, format: (e.format as CatalogItem['format']) ?? 'person', price_cents: e.price_cents, language: null, location_name: e.location_name, distance_km: null, created_at: '', host_name: null, host_slug: null, url: `/e/${e.id}` });
    }
    for (const o of of.data ?? []) {
      if (o.status !== 'published' || o.visibility !== 'public') continue;
      items.push({ kind: (o.kind as CatalogItem['kind']) ?? 'course', id: o.id, title: o.title_en, summary: o.summary_en ?? '', category: null, tags: null, starts_at: null, timezone: null, format: 'online', price_cents: o.price_cents, language: null, location_name: null, distance_km: null, created_at: '', host_name: null, host_slug: null, url: `/o/${o.id}` });
    }
    return items;
  },
});

export function SavedPage() {
  const { userId } = useGatherwell();
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage === 'es' ? 'es' : 'en';
  const rows = useQuery(savedRowsQuery(userId));
  const details = useQuery(savedDetailsQuery(rows.data));
  void useQuery(savedQuery(userId)); // warm the saved-set cache for SaveButton
  if (rows.isPending) return <ListSkeleton />;
  if (rows.isError) return <RetryState retry={() => void rows.refetch()} />;
  const items = details.data ?? [];
  return <main className="page">
    <div className="page-heading"><div><span className="eyebrow">{t('saved.eyebrow')}</span><h1>{t('saved.title')}</h1><p>{t('saved.sentence')}</p></div></div>
    {rows.data!.length === 0 ? <EmptyState icon="Bookmark" title={t('saved.emptyTitle')} text={t('saved.empty')} action={<Link to="/discover" className="gw-btn gw-btn-primary">{t('saved.browse')}</Link>} />
      : details.isPending ? <ListSkeleton />
      : <ul className="gw-grid catalog-grid">{items.map(item => <li key={`${item.kind}:${item.id}`} className="gw-card catalog-card">
          <Link to={item.kind === 'event' ? '/e/$id' : '/o/$id'} params={{ id: item.id }} className="catalog-card-main">
            <span className="chip">{t(`discover.kind.${item.kind}`)}</span>
            <strong>{item.title}</strong>
            {item.starts_at && <small className="catalog-meta">{new Intl.DateTimeFormat(lang === 'es' ? 'es' : 'en', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: item.timezone || undefined }).format(new Date(item.starts_at))}</small>}
          </Link>
          <SaveButton kind={item.kind === 'event' ? 'event' : 'offer'} targetId={item.id} />
        </li>)}
        {items.length === 0 && <li className="gw-empty"><p>{t('saved.allGone')}</p></li>}
      </ul>}
    <p className="gw-fine"><GwIcon name="Bell" size={14} /> {t('saved.privateNote')}</p>
  </main>;
}
