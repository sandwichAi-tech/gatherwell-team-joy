import { useState, type FormEvent } from 'react';
import { createFileRoute, useSearch } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { MessageCircle, Send, X, Ban } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ResponsiveSheet } from '@/components/responsive-sheet';
import { ListSkeleton, RetryState, EmptyState } from '@/components/launch-states';
import { supabase } from '@/integrations/supabase/client';

const db = supabase as unknown as { rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: any; error: { message?: string } | null }> };
import { gatherwellHead } from '@/lib/gatherwell-head';

export const Route = createFileRoute('/_authenticated/_app/inbox')({
  head: () => gatherwellHead('me'),
  validateSearch: (s: Record<string, unknown>) => ({ thread: typeof s['thread'] === 'string' ? s['thread'] : undefined }),
  component: InboxPage,
});

type Thread = { id: string; status: string; last_message_at: string; mine: boolean; title: string | null; other_name: string | null; requester_id: string | null };
type Msg = { id: string; body: string; created_at: string; from: 'me' | 'attendee' | 'host' };

const errKey = (e: unknown) => {
  const m = String((e as { message?: string })?.message ?? '');
  for (const k of ['blocked', 'closed', 'rate_limited', 'not_allowed', 'invalid_body']) if (m.includes(k)) return `inbox.errors.${k}`;
  return 'profile.saveError';
};

function InboxPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage === 'es' ? 'es-419' : 'en-US';
  const { thread: focus } = useSearch({ from: '/_authenticated/_app/inbox' });
  const qc = useQueryClient();
  const [open, setOpen] = useState<string | null>(focus ?? null);
  const { data = [], isLoading, error, refetch } = useQuery({
    queryKey: ['contact-threads'],
    queryFn: async () => (await db.rpc('my_contact_threads')).data as unknown as Thread[],
  });
  const current = data.find(x => x.id === open) ?? null;

  return <section className="panel" aria-labelledby="inbox-title">
    <div className="section-heading"><div><h1 id="inbox-title" className="manage-title"><MessageCircle className="inline-icon" />{t('inbox.title')}</h1><p>{t('inbox.subtitle')}</p></div></div>
    {isLoading ? <ListSkeleton /> : error ? <RetryState retry={() => void refetch()} /> : data.length === 0 ?
      <EmptyState icon="MessageCircle" text={t('inbox.empty')} /> :
      <ul className="settings-list">{data.map(th => <li key={th.id}>
        <button type="button" className="settings-row" onClick={() => setOpen(th.id)}>
          <span className="settings-label"><strong>{th.title ?? t('inbox.conversation')}</strong>
            <small className="muted">{th.mine ? t('inbox.withHost') : t('inbox.withAttendee', { name: th.other_name ?? '' })} · {new Date(th.last_message_at).toLocaleString(lang, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</small></span>
          {th.status === 'closed' && <span className="chip">{t('inbox.closed')}</span>}
        </button>
      </li>)}</ul>}
    {current && <ThreadSheet thread={current} onClose={() => setOpen(null)} onChanged={() => void qc.invalidateQueries({ queryKey: ['contact-threads'] })} />}
  </section>;
}

function ThreadSheet({ thread, onClose, onChanged }: { thread: Thread; onClose: () => void; onChanged: () => void }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage === 'es' ? 'es-419' : 'en-US';
  const qc = useQueryClient();
  const [body, setBody] = useState(''); const [busy, setBusy] = useState(false);
  const key = ['contact-thread', thread.id];
  const { data: msgs = [], isLoading } = useQuery({
    queryKey: key,
    queryFn: async () => (await db.rpc('contact_thread_messages', { _thread: thread.id })).data as unknown as Msg[],
    refetchInterval: 15_000,
  });
  const send = async (e: FormEvent) => {
    e.preventDefault(); const text = body.trim(); if (!text) return;
    setBusy(true);
    const { error } = await db.rpc('reply_contact_thread', { _thread: thread.id, _body: text });
    setBusy(false);
    if (error) { toast.error(t(errKey(error))); return; }
    setBody(''); await qc.invalidateQueries({ queryKey: key }); onChanged();
  };
  const close = async () => {
    await db.rpc('close_contact_thread', { _thread: thread.id });
    onChanged(); onClose();
  };
  const block = async () => {
    if (!thread.requester_id) return;
    await db.rpc('block_user', { _user: thread.requester_id });
    await db.rpc('close_contact_thread', { _thread: thread.id });
    toast.success(t('inbox.blockedDone')); onChanged(); onClose();
  };
  return <ResponsiveSheet open onOpenChange={o => !o && onClose()} title={thread.title ?? t('inbox.conversation')}
    description={thread.mine ? t('inbox.withHost') : t('inbox.withAttendee', { name: thread.other_name ?? '' })}>
    {isLoading ? <ListSkeleton rows={2} /> : <ul className="thread-messages">
      {msgs.map(m => <li key={m.id} className={`thread-msg is-${m.from}`}>
        <p>{m.body}</p>
        <small className="muted">{t(`inbox.from.${m.from}`)} · <time dateTime={m.created_at}>{new Date(m.created_at).toLocaleString(lang, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</time></small>
      </li>)}
    </ul>}
    {thread.status === 'open' ? <form className="convo-composer" onSubmit={send}>
      <label className="sr-only" htmlFor="thread-reply">{t('inbox.reply')}</label>
      <Textarea id="thread-reply" rows={3} maxLength={2000} value={body} placeholder={t('inbox.replyPlaceholder')} onChange={e => setBody(e.target.value)} />
      <div className="convo-composer-actions">
        {!thread.mine && thread.requester_id && <Button type="button" variant="ghost" className="danger-text" onClick={() => void block()}><Ban />{t('inbox.block')}</Button>}
        <Button type="button" variant="ghost" onClick={() => void close()}><X />{t('inbox.close')}</Button>
        <Button type="submit" disabled={busy || !body.trim()}><Send />{t('inbox.send')}</Button>
      </div>
    </form> : <p className="muted" role="status">{t('inbox.closedText')}</p>}
  </ResponsiveSheet>;
}
