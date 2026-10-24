import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Bell, CheckCircle } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { ListSkeleton, RetryState, EmptyState } from '@/components/launch-states';
import { supabase } from '@/integrations/supabase/client';
import { gatherwellHead } from '@/lib/gatherwell-head';

export const Route = createFileRoute('/_authenticated/_app/notifications')({ head: () => gatherwellHead('me'), component: NotificationsPage });

type Notification = { id: string; kind: string; title: string; body: string | null; link: string | null; read_at: string | null; created_at: string };

export const notificationsQuery = () => ({
  queryKey: ['notifications'],
  queryFn: async () => {
    const { data, error } = await supabase.from('notifications').select('id,kind,title,body,link,read_at,created_at').order('created_at', { ascending: false }).limit(50);
    if (error) throw error;
    return (data ?? []) as Notification[];
  },
});

function NotificationsPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage === 'es' ? 'es-419' : 'en-US';
  const qc = useQueryClient();
  const { data = [], isLoading, error, refetch } = useQuery(notificationsQuery());
  const markAll = async () => {
    await supabase.rpc('mark_notifications_read', {});
    await qc.invalidateQueries({ queryKey: ['notifications'] });
    await qc.invalidateQueries({ queryKey: ['notifications-unread'] });
  };
  const open = async (n: Notification) => {
    if (!n.read_at) {
      await supabase.rpc('mark_notifications_read', { _id: n.id });
      await qc.invalidateQueries({ queryKey: ['notifications'] });
      await qc.invalidateQueries({ queryKey: ['notifications-unread'] });
    }
  };

  return <section className="panel" aria-labelledby="notif-title">
    <div className="section-heading">
      <div><h1 id="notif-title" className="manage-title"><Bell className="inline-icon" />{t('notifications.title')}</h1><p>{t('notifications.subtitle')}</p></div>
      {data.some(n => !n.read_at) && <Button variant="secondary" onClick={() => void markAll()}><CheckCircle />{t('notifications.markAllRead')}</Button>}
    </div>
    {isLoading ? <ListSkeleton /> : error ? <RetryState retry={() => void refetch()} /> : data.length === 0 ?
      <EmptyState icon="Bell" text={t('notifications.empty')} /> :
      <ul className="settings-list">
        {data.map(n => <li key={n.id}>
          <div className={`settings-row notification-row ${n.read_at ? '' : 'is-unread'}`}>
            {!n.read_at ? <span className="unread-dot" aria-label={t('notifications.unread')} /> : <span className="unread-dot is-read" aria-hidden="true" />}
            <span className="settings-label">
              <strong>{n.title}</strong>
              {n.body && <small className="muted">{n.body}</small>}
              <small className="muted">{t(`notifications.kind.${n.kind}`)} · <time dateTime={n.created_at}>{new Date(n.created_at).toLocaleString(lang, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</time></small>
            </span>
            {n.link && <Button asChild variant="ghost" size="sm" onClick={() => void open(n)}><Link to={n.link as '/'}>{t('notifications.open')}</Link></Button>}
          </div>
        </li>)}
      </ul>}
  </section>;
}
