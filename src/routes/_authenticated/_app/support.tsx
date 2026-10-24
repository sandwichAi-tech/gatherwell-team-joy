import { useState, type FormEvent } from 'react';
import { createFileRoute, useSearch } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { LifeBuoy, Plus, Send, X, AlertCircle } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ResponsiveSheet } from '@/components/responsive-sheet';
import { ListSkeleton, RetryState, EmptyState } from '@/components/launch-states';
import { supabase } from '@/integrations/supabase/client';

const db = supabase as unknown as { rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: any; error: { message?: string } | null }> };
import { gatherwellHead } from '@/lib/gatherwell-head';

export const Route = createFileRoute('/_authenticated/_app/support')({
  head: () => gatherwellHead('me'),
  validateSearch: (s: Record<string, unknown>) => ({
    t: typeof s['t'] === 'string' ? s['t'] : undefined,
    new: s['new'] === 'organization' ? ('organization' as const) : undefined,
  }),
  component: SupportPage,
});

type Ticket = { id: string; category: string; subject: string; status: string; created_at: string; updated_at: string };
type Msg = { id: string; body: string; is_staff: boolean; created_at: string };
const CATS = ['account', 'billing', 'safety', 'other'] as const;

const errKey = (e: unknown) => {
  const m = String((e as { message?: string })?.message ?? '');
  for (const k of ['rate_limited', 'invalid_body', 'invalid_category', 'closed', 'not_allowed']) if (m.includes(k)) return `support.errors.${k}`;
  return 'profile.saveError';
};

function SupportPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage === 'es' ? 'es-419' : 'en-US';
  const { t: focus, new: preset } = useSearch({ from: '/_authenticated/_app/support' });
  const qc = useQueryClient();
  const [creating, setCreating] = useState(preset === 'organization');
  const [open, setOpen] = useState<string | null>(focus ?? null);
  const { data = [], isLoading, error, refetch } = useQuery({
    queryKey: ['support-tickets'],
    queryFn: async () => {
      const { data, error } = await supabase.from('support_tickets').select('id,category,subject,status,created_at,updated_at').order('updated_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Ticket[];
    },
  });
  const current = data.find(x => x.id === open) ?? null;

  return <section className="panel" aria-labelledby="support-title">
    <div className="section-heading">
      <div><h1 id="support-title" className="manage-title"><LifeBuoy className="inline-icon" />{t('support.title')}</h1><p>{t('support.subtitle')}</p></div>
      <Button onClick={() => setCreating(true)}><Plus />{t('support.new')}</Button>
    </div>
    <div className="notice-banner is-inline" role="note">
      <AlertCircle /><div><strong>{t('support.emergencyTitle')}</strong><p>{t('support.emergencyText')}</p></div>
    </div>
    <p className="muted">{t('support.routingNote')}</p>
    {isLoading ? <ListSkeleton /> : error ? <RetryState retry={() => void refetch()} /> : data.length === 0 ?
      <EmptyState icon="LifeBuoy" text={t('support.empty')} /> :
      <ul className="settings-list">{data.map(tk => <li key={tk.id}>
        <button type="button" className="settings-row" onClick={() => setOpen(tk.id)}>
          <span className="settings-label"><strong>{tk.subject}</strong>
            <small className="muted">{t(`support.cat.${tk.category}`)} · {new Date(tk.updated_at).toLocaleString(lang, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</small></span>
          <span className={`chip ${tk.status === 'answered' ? 'published-chip' : ''}`}>{t(`support.status.${tk.status}`)}</span>
        </button>
      </li>)}</ul>}
    <NewTicketSheet open={creating} preset={preset} onClose={() => setCreating(false)} onCreated={id => { setCreating(false); setOpen(id); void qc.invalidateQueries({ queryKey: ['support-tickets'] }); }} />
    {current && <TicketSheet ticket={current} onClose={() => setOpen(null)} onChanged={() => void qc.invalidateQueries({ queryKey: ['support-tickets'] })} />}
  </section>;
}

function NewTicketSheet({ open, preset, onClose, onCreated }: { open: boolean; preset?: 'organization' | undefined; onClose: () => void; onCreated: (id: string) => void }) {
  const { t } = useTranslation();
  const [cat, setCat] = useState<(typeof CATS)[number]>(preset === 'organization' ? 'billing' : 'account');
  const [subject, setSubject] = useState(preset === 'organization' ? t('support.orgSubject') : ''); const [body, setBody] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true);
    const { data, error } = await db.rpc('create_support_ticket', { _category: cat, _subject: subject.trim(), _body: body.trim() });
    setBusy(false);
    if (error) { toast.error(t(errKey(error))); return; }
    toast.success(t('support.created')); setSubject(''); setBody(''); onCreated(data as string);
  };
  return <ResponsiveSheet open={open} onOpenChange={o => !o && onClose()} title={t('support.new')} description={t('support.newText')}>
    <form className="edit-form" onSubmit={submit}>
      <div><span className="field-label" id="support-cat-label">{t('support.category')}</span>
        <div className="guest-tabs" role="radiogroup" aria-labelledby="support-cat-label">
          {CATS.map(c => <button key={c} type="button" role="radio" aria-checked={cat === c} className={cat === c ? 'is-active' : ''} onClick={() => setCat(c)}>{t(`support.cat.${c}`)}</button>)}
        </div></div>
      <div><label className="field-label" htmlFor="sup-subject">{t('support.subject')}</label><Input id="sup-subject" required maxLength={140} className="field-input" value={subject} onChange={e => setSubject(e.target.value)} /></div>
      <div><label className="field-label" htmlFor="sup-body">{t('support.body')}</label><Textarea id="sup-body" required rows={5} maxLength={4000} value={body} onChange={e => setBody(e.target.value)} /></div>
      <Button type="submit" disabled={busy || subject.trim().length < 3 || !body.trim()}>{t('support.submit')}</Button>
    </form>
  </ResponsiveSheet>;
}

function TicketSheet({ ticket, onClose, onChanged }: { ticket: Ticket; onClose: () => void; onChanged: () => void }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage === 'es' ? 'es-419' : 'en-US';
  const qc = useQueryClient();
  const [body, setBody] = useState(''); const [busy, setBusy] = useState(false);
  const key = ['support-ticket', ticket.id];
  const { data: msgs = [], isLoading } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase.from('support_messages').select('id,body,is_staff,created_at').eq('ticket_id', ticket.id).order('created_at');
      if (error) throw error;
      return (data ?? []) as Msg[];
    },
  });
  const send = async (e: FormEvent) => {
    e.preventDefault(); const text = body.trim(); if (!text) return;
    setBusy(true);
    const { error } = await db.rpc('reply_support_ticket', { _ticket: ticket.id, _body: text });
    setBusy(false);
    if (error) { toast.error(t(errKey(error))); return; }
    setBody(''); await qc.invalidateQueries({ queryKey: key }); onChanged();
  };
  const close = async () => { await db.rpc('close_support_ticket', { _ticket: ticket.id }); onChanged(); onClose(); };
  return <ResponsiveSheet open onOpenChange={o => !o && onClose()} title={ticket.subject} description={t(`support.cat.${ticket.category}`)}>
    {isLoading ? <ListSkeleton rows={2} /> : <ul className="thread-messages">
      {msgs.map(m => <li key={m.id} className={`thread-msg ${m.is_staff ? 'is-host' : 'is-me'}`}>
        <p>{m.body}</p>
        <small className="muted">{m.is_staff ? t('support.fromStaff') : t('support.fromMe')} · <time dateTime={m.created_at}>{new Date(m.created_at).toLocaleString(lang, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</time></small>
      </li>)}
    </ul>}
    {ticket.status !== 'closed' ? <form className="convo-composer" onSubmit={send}>
      <label className="sr-only" htmlFor="sup-reply">{t('support.reply')}</label>
      <Textarea id="sup-reply" rows={3} maxLength={4000} value={body} placeholder={t('support.replyPlaceholder')} onChange={e => setBody(e.target.value)} />
      <div className="convo-composer-actions">
        <Button type="button" variant="ghost" onClick={() => void close()}><X />{t('support.close')}</Button>
        <Button type="submit" disabled={busy || !body.trim()}><Send />{t('support.send')}</Button>
      </div>
    </form> : <p className="muted" role="status">{t('support.closedText')}</p>}
  </ResponsiveSheet>;
}
