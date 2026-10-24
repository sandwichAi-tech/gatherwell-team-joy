import { useEffect, useState } from 'react';
import { createFileRoute, Link, useSearch } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Megaphone, Check, CheckCircle2 } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { ListSkeleton, RetryState, EmptyState } from '@/components/launch-states';
import { supabase } from '@/integrations/supabase/client';
import { gatherwellHead } from '@/lib/gatherwell-head';

export const Route = createFileRoute('/_authenticated/_app/updates')({
  head: () => gatherwellHead('me'),
  validateSearch: (s: Record<string, unknown>) => ({ u: typeof s.u === 'string' ? s.u : undefined }),
  component: UpdatesPage,
});

type UpdateItem = {
  id: string; title: string; body: string; published_at: string;
  offering_kind: 'event' | 'offer'; offering_id: string; offering_title: string | null; read: boolean;
};

const PAGE = 20;

function UpdatesPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage === 'es' ? 'es-419' : 'en-US';
  const { u: focus } = useSearch({ from: '/_authenticated/_app/updates' });
  const qc = useQueryClient();
  const [pages, setPages] = useState(1);
  const { data = [], isLoading, error, refetch } = useQuery({
    queryKey: ['updates-inbox', pages],
    queryFn: async () => (await supabase.rpc('my_updates', { _limit: PAGE * pages, _offset: 0 })).data as unknown as UpdateItem[],
  });
  const mark = async (id: string | null) => {
    await supabase.rpc('mark_update_read', { _id: id });
    await qc.invalidateQueries({ queryKey: ['updates-inbox'] });
  };
  useEffect(() => { if (focus && data.some(d => d.id === focus && !d.read)) void mark(focus); // eslint-disable-line react-hooks/exhaustive-deps
  }, [focus, data.length]);

  return <section className="panel" aria-labelledby="updates-title">
    <div className="section-heading">
      <div><h1 id="updates-title" className="manage-title"><Megaphone className="inline-icon" />{t('updates.title')}</h1><p>{t('updates.subtitle')}</p></div>
      {data.some(d => !d.read) && <Button variant="secondary" onClick={() => void mark(null)}><CheckCircle2 />{t('updates.markAllRead')}</Button>}
    </div>
    {isLoading ? <ListSkeleton /> : error ? <RetryState retry={() => void refetch()} /> : data.length === 0 ?
      <EmptyState icon="Megaphone" text={t('updates.empty')} /> :
      <ul className="settings-list updates-list">
        {data.map(d => <li key={d.id}>
          <article className={`update-card ${d.read ? '' : 'is-unread'}`} id={`u-${d.id}`}>
            <div className="update-card-head">
              {!d.read && <span className="unread-dot" aria-label={t('updates.unread')} />}
              <div>
                <h2>{d.title}</h2>
                <p className="muted">
                  <Link to={d.offering_kind === 'event' ? '/event/$id' : '/offer/$id'} params={{ id: d.offering_id }} className="auth-link">{d.offering_title}</Link>
                  {' · '}<time dateTime={d.published_at}>{new Date(d.published_at).toLocaleString(lang, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</time>
                </p>
              </div>
              {!d.read && <Button variant="ghost" size="icon" aria-label={t('updates.markRead')} onClick={() => void mark(d.id)}><Check /></Button>}
            </div>
            <p className="update-body">{d.body}</p>
          </article>
        </li>)}
      </ul>}
    {data.length >= PAGE * pages && <Button variant="secondary" onClick={() => setPages(p => p + 1)}>{t('updates.loadMore')}</Button>}
  </section>;
}
