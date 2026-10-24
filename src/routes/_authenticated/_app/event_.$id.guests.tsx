import { Fragment, useMemo, useState, type FormEvent } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { FileText, ShieldCheck, UsersRound } from '@/components/icons';
import { WaiverAccept, useEventWaiver } from '@/components/waiver';
import { Check } from '@/components/icons';
import { ArrowLeft, ArrowUp, Download, Mail, MessageSquareText, Phone, Search, UserPlus, X } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ResponsiveSheet } from '@/components/responsive-sheet';
import { Stepper } from '@/components/guest-rsvp';
import { useRsvpChanges } from '@/components/event-live';
import { supabase } from '@/integrations/supabase/client';
import { initialsOf } from '@/lib/account';
import { gatherwellHead } from '@/lib/gatherwell-head';
import { BelongingPrompt, BelongingTags, BuddySheet, SmallGroupsSheet, useBelonging } from '@/components/belonging';
import { HandHeart, Layers } from '@/components/icons';

export const Route = createFileRoute('/_authenticated/_app/event_/$id/guests')({ head: () => gatherwellHead('events'), component: GuestListPage });

type Tab = 'requested' | 'going' | 'maybe' | 'waitlist' | 'cancelled' | 'declined';
const ALL_TABS: Tab[] = ['requested', 'going', 'maybe', 'waitlist', 'cancelled', 'declined'];

function GuestListPage() {
  const { id } = Route.useParams(); const { t, i18n } = useTranslation(); const lang = i18n.resolvedLanguage === 'es' ? 'es-419' : 'en-US';
  const queryClient = useQueryClient();
  const { data: event } = useQuery({ queryKey: ['event', id, 'title'], queryFn: async () => (await supabase.from('events').select('id,title,status').eq('id', id).maybeSingle()).data });
  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ['event', id, 'guest-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('rsvps').select('id,user_id,guest_name,guest_phone,guest_email,plus_ones,status,sms_opt_in,email_opt_in,created_at,checked_in_at,group_id,group_name,wants_buddy,buddy_rsvp_id,small_group').eq('event_id', id).order('created_at');
      if (error) throw error; return data ?? [];
    },
  });
  const { data: waivers = new Map<string, { version: number; full_name: string; accepted_at: string; ip: string | null; source: string }>() } = useQuery({ queryKey: ['event', id, 'waivers'], queryFn: async () => {
    const { data } = await (supabase as any).from('waiver_acceptances').select('rsvp_id,version,full_name,accepted_at,ip,source').eq('event_id', id);
    return new Map(((data ?? []) as { rsvp_id: string; version: number; full_name: string; accepted_at: string; ip: string | null; source: string }[]).map(w => [w.rsvp_id, w]));
  } });
  const { data: needsWaiver = false } = useQuery({ queryKey: ['event', id, 'needs-waiver'], queryFn: async () => !!((await (supabase as any).from('events').select('requires_waiver').eq('id', id).maybeSingle()).data?.requires_waiver) });
  const { data: qinfo } = useQuery({ queryKey: ['event', id, 'questions'], queryFn: async () => {
    const [{ data: ev }, { data: ans }] = await Promise.all([(supabase as any).from('events').select('rsvp_questions,require_approval').eq('id', id).maybeSingle(), (supabase as any).from('rsvp_answers').select('rsvp_id,answers').eq('event_id', id)]);
    return { questions: (ev?.rsvp_questions ?? []) as { id: string; kind: string; label: string }[], approval: !!ev?.require_approval, answers: new Map<string, Record<string, string>>(((ans ?? []) as { rsvp_id: string; answers: Record<string, string> }[]).map(a => [a.rsvp_id, a.answers])) };
  } });
  const questions = qinfo?.questions ?? []; const answers = qinfo?.answers ?? new Map<string, Record<string, string>>();
  const ansText = (q: { kind: string }, v: string | undefined) => !v ? '' : q.kind === 'yesno' ? t(`rsvpq.${v === 'yes' ? 'yes' : 'no'}`) : v;
  const decide = async (rid: string, ok: boolean) => {
    const { data: st, error } = await (supabase as any).rpc('decide_rsvp', { _rsvp: rid, _approve: ok });
    if (error) { toast.error(t('profile.saveError')); return; }
    toast.success(t(ok ? (st === 'waitlist' ? 'rsvpq.approvedWaitlist' : 'rsvpq.approved') : 'rsvpq.declined')); await refresh();
  };
  const { data: belong = new Map() } = useBelonging(id); const [buddyFor, setBuddyFor] = useState<string | null>(null); const [groupsOpen, setGroupsOpen] = useState(false);
  const active = rows.filter(r => ['going', 'maybe', 'waitlist'].includes(r.status));
  useRsvpChanges(id, () => void queryClient.invalidateQueries({ queryKey: ['event', id, 'guest-list'] }));
  const [tab, setTab] = useState<Tab>('going');
  const TABS = ALL_TABS.filter(k => !['requested', 'declined'].includes(k) || qinfo?.approval || rows.some(r => r.status === k)); const [q, setQ] = useState(''); const [adding, setAdding] = useState(false); const [signing, setSigning] = useState<{ id: string; name: string } | null>(null);
  const counts = useMemo(() => Object.fromEntries(ALL_TABS.map(k => [k, rows.filter(r => r.status === k).length])) as Record<Tab, number>, [rows]);
  const list = rows.filter(r => r.status === tab && (!q || [r.guest_name, r.guest_phone, r.guest_email, r.group_name].some(v => v?.toLowerCase().includes(q.toLowerCase()))));
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['event', id] });
  const setStatus = async (rid: string, status: Tab) => {
    const { error } = await supabase.from('rsvps').update({ status }).eq('id', rid);
    if (error) { toast.error(t('profile.saveError')); return; }
    toast.success(t(status === 'going' ? 'guestList.promoted' : 'guestList.moved')); await refresh();
  };
  const [cancelling, setCancelling] = useState<{ id: string; name: string } | null>(null);
  const [cancelReason, setCancelReason] = useState(''); const [cancelBusy, setCancelBusy] = useState(false);
  const hostCancel = async () => {
    if (!cancelling) return;
    setCancelBusy(true);
    const { error } = await (supabase as any).rpc('host_cancel_rsvp', { _rsvp: cancelling.id, _reason: cancelReason.trim() });
    setCancelBusy(false);
    if (error) { toast.error(t('profile.saveError')); return; }
    toast.success(t('guestList.cancelled')); setCancelling(null); setCancelReason(''); await refresh();
  };
  const exportCsv = () => {
    const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const head = ['name', 'team', 'status', 'plus_ones', 'phone', 'email', 'sms_reminders', 'email_reminders', 'rsvp_time', 'checked_in', 'waiver_signed', 'waiver_name', 'waiver_version', 'waiver_time', 'waiver_ip', 'waiver_source', ...questions.map(q => q.label)];
    const body = rows.map(r => { const w = waivers.get(r.id); return [r.guest_name, r.group_name ?? '', r.status, r.plus_ones, r.guest_phone, r.guest_email, r.sms_opt_in ? 'yes' : 'no', r.email_opt_in ? 'yes' : 'no', r.created_at, r.checked_in_at ?? '', w ? 'yes' : 'no', w?.full_name ?? '', w?.version ?? '', w?.accepted_at ?? '', w?.ip ?? '', w?.source ?? '', ...questions.map(q => ansText(q, answers.get(r.id)?.[q.id]))].map(cell).join(','); });
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
        <Button variant="secondary" onClick={() => setGroupsOpen(true)}><Layers />{t('belong.groups')}</Button>
        <Button variant="secondary" onClick={exportCsv} disabled={!rows.length}><Download />{t('guestList.export')}</Button>
      </div>
      {error ? <p className="guest-empty">{t('guestList.noAccess')}</p> : isLoading ? <p className="guest-empty">{t('publicEvent.loading')}</p> : list.length === 0 ? <p className="guest-empty">{t('guestList.empty')}</p> :
        <ul className="guest-list">{[...list].sort((a, b) => (a.group_name ?? '').localeCompare(b.group_name ?? '') || (a.group_id ?? '').localeCompare(b.group_id ?? '')).map((r, i, arr) => <Fragment key={r.id}>{r.group_id && arr[i - 1]?.group_id !== r.group_id && <li className="guest-group-head"><UsersRound /><strong>{r.group_name}</strong><span className="muted">{t('teamRsvp.people', { count: arr.filter(x => x.group_id === r.group_id).length })}</span></li>}<li className={`guest-row ${r.group_id ? 'in-group' : ''}`}>
          <span className="initial-avatar">{initialsOf(r.guest_name)}</span>
          <div className="guest-row-info">
            <strong>{r.guest_name ?? t('teamSpace.someone')}{r.plus_ones > 0 && <span className="chip">+{r.plus_ones}</span>}{r.checked_in_at && <span className="chip published-chip">{t('guestList.checkedIn')}</span>}<BelongingTags info={belong.get(r.id)} row={r} rows={rows} />{(needsWaiver || waivers.has(r.id)) && (waivers.has(r.id) ? <span className="waiver-status is-signed" title={t('waiver.signedOn', { name: waivers.get(r.id)!.full_name, version: waivers.get(r.id)!.version })}><ShieldCheck /><span className="sr-only">{t('waiver.signed')}</span></span> : <span className="waiver-status is-missing" title={t('waiver.missing')}><FileText /><span className="sr-only">{t('waiver.missing')}</span></span>)}</strong>
            <span className="guest-contact">{r.guest_phone && <a href={`tel:${r.guest_phone}`}><Phone />{r.guest_phone}</a>}{r.guest_email && <a href={`mailto:${r.guest_email}`}><Mail />{r.guest_email}</a>}</span>
            {['going', 'maybe'].includes(r.status) && <BelongingPrompt info={belong.get(r.id)} name={r.guest_name} />}
            {answers.has(r.id) && <dl className="rsvpq-answers">{questions.filter(q => answers.get(r.id)?.[q.id]).map(q => <div key={q.id}><dt>{q.label}</dt><dd>{ansText(q, answers.get(r.id)?.[q.id])}</dd></div>)}</dl>}
            <span className="muted guest-meta">{r.sms_opt_in && <><MessageSquareText />{t('guestList.textReminders')}</>}{r.email_opt_in && <><Mail />{t('guestList.emailReminders')}</>}<span>{new Date(r.created_at).toLocaleString(lang, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span></span>
          </div>
          <div className="guest-row-actions">
            {r.status === 'requested' && <><Button size="sm" onClick={() => decide(r.id, true)}><Check />{t('rsvpq.approve')}</Button><Button size="sm" variant="ghost" className="danger-text" onClick={() => decide(r.id, false)}><X />{t('rsvpq.decline')}</Button></>}
            {needsWaiver && !waivers.has(r.id) && r.status === 'going' && <Button size="sm" variant="secondary" onClick={() => setSigning({ id: r.id, name: r.guest_name ?? '' })}><FileText />{t('teamRsvp.signAtDoor')}</Button>}
            {['going', 'maybe'].includes(r.status) && (r.wants_buddy || belong.get(r.id)?.first_time || r.buddy_rsvp_id) && <Button size="sm" variant="secondary" onClick={() => setBuddyFor(r.id)}><HandHeart />{t(r.buddy_rsvp_id ? 'belong.changeBuddy' : 'belong.pairBuddy')}</Button>}
            {r.status === 'waitlist' && <Button size="sm" onClick={() => setStatus(r.id, 'going')}><ArrowUp />{t('guestList.promote')}</Button>}
            {!['cancelled', 'requested', 'declined'].includes(r.status) && <Button size="sm" variant="ghost" className="danger-text" aria-label={t('guestList.moveCancelled')} onClick={() => setStatus(r.id, 'cancelled')}><X />{t('guestList.moveCancelled')}</Button>}
          </div>
        </li></Fragment>)}</ul>}
    </section>
    {buddyFor && rows.find(r => r.id === buddyFor) && <BuddySheet eventId={id} row={rows.find(r => r.id === buddyFor)!} rows={active} info={belong} onClose={() => setBuddyFor(null)} />}
    {groupsOpen && <SmallGroupsSheet eventId={id} rows={active.filter(r => r.status !== 'waitlist')} onClose={() => setGroupsOpen(false)} />}
    {signing && <DoorWaiverSheet eventId={id} rsvp={signing} onClose={() => setSigning(null)} onSaved={refresh} />}
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

function DoorWaiverSheet({ eventId, rsvp, onClose, onSaved }: { eventId: string; rsvp: { id: string; name: string }; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation(); const { data: waiver } = useEventWaiver(eventId);
  const [name, setName] = useState(rsvp.name); const [ok, setOk] = useState(false); const [busy, setBusy] = useState(false);
  const save = async () => { setBusy(true); const { error } = await (supabase as any).rpc('sign_waiver_at_door', { _rsvp: rsvp.id, _name: name.trim() }); setBusy(false); if (error) { toast.error(t('profile.saveError')); return; } toast.success(t('waiver.signed')); onSaved(); onClose(); };
  return <ResponsiveSheet open onOpenChange={o => !o && onClose()} title={t('teamRsvp.signAtDoor')} description={rsvp.name}
    footer={<Button disabled={busy || !ok || name.trim().length < 2} onClick={save}>{t('teamRsvp.signNow')}</Button>}>
    {waiver && <WaiverAccept waiver={waiver} name={name} accepted={ok} onName={setName} onAccepted={setOk} idPrefix="door" />}
  </ResponsiveSheet>;
}
