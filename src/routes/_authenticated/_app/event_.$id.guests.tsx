import { useMemo, useState, type FormEvent } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ArrowLeft, ArrowUp, Download, Mail, MessageSquareText, Phone, Search, UserPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ResponsiveSheet } from '@/components/responsive-sheet';
import { Stepper } from '@/components/guest-rsvp';
import { useRsvpChanges } from '@/components/event-live';
import { supabase } from '@/integrations/supabase/client';
import { initialsOf } from '@/lib/account';
import { gatherwellHead } from '@/lib/gatherwell-head';

export const Route = createFileRoute('/_authenticated/_app/event_/$id/guests')({ head: () => gatherwellHead('events'), component: GuestListPage });

type Tab = 'going' | 'maybe' | 'waitlist' | 'cancelled';
const TABS: Tab[] = ['going', 'maybe', 'waitlist', 'cancelled'];

function GuestListPage() {
  const { id } = Route.useParams(); const { t, i18n } = useTranslation(); const lang = i18n.resolvedLanguage === 'es' ? 'es-419' : 'en-US';
  const queryClient = useQueryClient();
  const { data: event } = useQuery({ queryKey: ['event', id, 'title'], queryFn: async () => (await supabase.from('events').select('id,title,status').eq('id', id).maybeSingle()).data });
  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ['event', id, 'guest-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('rsvps').select('id,user_id,guest_name,guest_phone,guest_email,plus_ones,status,sms_opt_in,email_opt_in,created_at,checked_in_at').eq('event_id', id).order('created_at');
      if (error) throw error; return data ?? [];
    },
  });
  useRsvpChanges(id, () => void queryClient.invalidateQueries({ queryKey: ['event', id, 'guest-list'] }));
  const [tab, setTab] = useState<Tab>('going'); const [q, setQ] = useState(''); const [adding, setAdding] = useState(false);
  const counts = useMemo(() => Object.fromEntries(TABS.map(k => [k, rows.filter(r => r.status === k).length])) as Record<Tab, number>, [rows]);
  const list = rows.filter(r => r.status === tab && (!q || [r.guest_name, r.guest_phone, r.guest_email].some(v => v?.toLowerCase().includes(q.toLowerCase()))));
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['event', id] });
  const setStatus = async (rid: string, status: Tab) => {
    const { error } = await supabase.from('rsvps').update({ status }).eq('id', rid);
    if (error) { toast.error(t('profile.saveError')); return; }
    toast.success(t(status === 'going' ? 'guestList.promoted' : 'guestList.moved')); await refresh();
  };
  const exportCsv = () => {
    const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const head = ['name', 'status', 'plus_ones', 'phone', 'email', 'sms_reminders', 'email_reminders', 'rsvp_time', 'checked_in'];
    const body = rows.map(r => [r.guest_name, r.status, r.plus_ones, r.guest_phone, r.guest_email, r.sms_opt_in ? 'yes' : 'no', r.email_opt_in ? 'yes' : 'no', r.created_at, r.checked_in_at ?? ''].map(cell).join(','));
    const url = URL.createObjectURL(new Blob([[head.join(','), ...body].join('\n')], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `guests-${(event?.title ?? 'gathering').replace(/[^\w-]+/g, '-').toLowerCase()}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return <>
    <Link to="/event/$id" params={{ id }} className="auth-link back-link"><ArrowLeft />{t('guestList.back')}</Link>
    <section className="panel">
      <div className="section-heading"><div><h1 className="manage-title">{t('guestList.title')}</h1>{event && <p>{event.title}</p>}</div></div>
      <div className="guest-tabs" role="tablist">{TABS.map(k => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'is-active' : ''} onClick={() => setTab(k)}>{t(`guestList.tabs.${k}`)}<span className="tabular-nums">{counts[k]}</span></button>)}</div>
      <div className="guest-toolbar">
        <div className="guest-search"><Search /><Input aria-label={t('guestList.search')} placeholder={t('guestList.search')} value={q} onChange={e => setQ(e.target.value)} className="field-input" /></div>
        <Button variant="secondary" onClick={() => setAdding(true)} disabled={event?.status !== 'published'}><UserPlus />{t('guestList.add')}</Button>
        <Button variant="secondary" onClick={exportCsv} disabled={!rows.length}><Download />{t('guestList.export')}</Button>
      </div>
      {error ? <p className="guest-empty">{t('guestList.noAccess')}</p> : isLoading ? <p className="guest-empty">{t('publicEvent.loading')}</p> : list.length === 0 ? <p className="guest-empty">{t('guestList.empty')}</p> :
        <ul className="guest-list">{list.map(r => <li key={r.id} className="guest-row">
          <span className="initial-avatar">{initialsOf(r.guest_name)}</span>
          <div className="guest-row-info">
            <strong>{r.guest_name ?? t('teamSpace.someone')}{r.plus_ones > 0 && <span className="chip">+{r.plus_ones}</span>}{r.checked_in_at && <span className="chip published-chip">{t('guestList.checkedIn')}</span>}</strong>
            <span className="guest-contact">{r.guest_phone && <a href={`tel:${r.guest_phone}`}><Phone />{r.guest_phone}</a>}{r.guest_email && <a href={`mailto:${r.guest_email}`}><Mail />{r.guest_email}</a>}</span>
            <span className="muted guest-meta">{r.sms_opt_in && <><MessageSquareText />{t('guestList.textReminders')}</>}{r.email_opt_in && <><Mail />{t('guestList.emailReminders')}</>}<span>{new Date(r.created_at).toLocaleString(lang, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span></span>
          </div>
          <div className="guest-row-actions">
            {r.status === 'waitlist' && <Button size="sm" onClick={() => setStatus(r.id, 'going')}><ArrowUp />{t('guestList.promote')}</Button>}
            {r.status !== 'cancelled' && <Button size="sm" variant="ghost" className="danger-text" aria-label={t('guestList.moveCancelled')} onClick={() => setStatus(r.id, 'cancelled')}><X />{t('guestList.moveCancelled')}</Button>}
          </div>
        </li>)}</ul>}
    </section>
    <AddGuestSheet open={adding} eventId={id} onClose={() => setAdding(false)} onSaved={refresh} />
  </>;
}

function AddGuestSheet({ open, eventId, onClose, onSaved }: { open: boolean; eventId: string; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [f, setF] = useState({ name: '', phone: '', email: '', plus: 0 }); const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); const name = f.name.trim(); if (!name || name.length > 120) return;
    setBusy(true);
    const { error } = await supabase.from('rsvps').insert({ event_id: eventId, guest_name: name, guest_phone: f.phone.trim().slice(0, 30) || null, guest_email: f.email.trim().slice(0, 200) || null, plus_ones: f.plus, status: 'going' });
    setBusy(false);
    if (error) { toast.error(t('profile.saveError')); return; }
    toast.success(t('guestList.added')); setF({ name: '', phone: '', email: '', plus: 0 }); onSaved(); onClose();
  };
  return <ResponsiveSheet open={open} onOpenChange={o => !o && onClose()} title={t('guestList.add')}>
    <form className="guest-form" onSubmit={submit}>
      <div><label className="field-label" htmlFor="a-name">{t('guestList.name')}</label><Input id="a-name" required maxLength={120} className="field-input" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></div>
      <div><label className="field-label" htmlFor="a-phone">{t('guest.phone')}</label><Input id="a-phone" type="tel" maxLength={30} className="field-input" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} /></div>
      <div><label className="field-label" htmlFor="a-email">{t('guest.email')}</label><Input id="a-email" type="email" maxLength={200} className="field-input" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /></div>
      <div className="guest-plus"><span className="field-label">{t('guest.plusOnes')}</span><Stepper value={f.plus} onChange={plus => setF({ ...f, plus })} label={t('guest.plusOnes')} /></div>
      <Button type="submit" className="guest-primary" disabled={busy}>{t('guestList.addConfirm')}</Button>
    </form>
  </ResponsiveSheet>;
}
