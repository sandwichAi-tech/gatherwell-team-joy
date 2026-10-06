import { trackEvent } from '@/lib/analytics';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { CheckCircle2, QrCode, Search, UserPlus, X, AlertCircle, Undo2 } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ResponsiveSheet } from '@/components/responsive-sheet';
import { useLiveCounts, useRsvpChanges } from '@/components/event-live';
import { supabase } from '@/integrations/supabase/client';
import { initialsOf } from '@/lib/account';
import { rsvpErrorKey } from '@/lib/guest';
import { gatherwellHead } from '@/lib/gatherwell-head';
import { createCheckinQueue, isRetryableCheckinError, type PendingCheckin } from '@/lib/checkin-queue';
import { ListSkeleton, RetryState } from '@/components/launch-states';

export const Route = createFileRoute('/_authenticated/_app/event_/$id/checkin')({ head: () => gatherwellHead('events'), component: CheckInMode });

type Scan = { result: 'ok' | 'already' | 'not_found' | 'error' | 'pending'; name?: string };

function CheckInMode() {
  const { id } = Route.useParams(); const { t, i18n } = useTranslation(); const queryClient = useQueryClient();
  const lang = i18n.resolvedLanguage === 'es' ? 'es-419' : 'en-US';
  const { data: event } = useQuery({ queryKey: ['event', id, 'title'], queryFn: async () => (await supabase.from('events').select('id,title,status').eq('id', id).maybeSingle()).data });
  const listKey = ['event', id, 'checkin-list'];
  const { data: rows = [], error, isLoading, refetch } = useQuery({
    queryKey: listKey,
    queryFn: async () => {
      const { data, error } = await supabase.from('rsvps').select('id,guest_name,plus_ones,status,checked_in_at,is_walk_in').eq('event_id', id).in('status', ['going', 'maybe', 'waitlist']).order('guest_name');
      if (error) throw error; return data ?? [];
    },
  });
  const counts = useLiveCounts(id);
  useRsvpChanges(id, () => void queryClient.invalidateQueries({ queryKey: listKey }));
  const [q, setQ] = useState(''); const [scanning, setScanning] = useState(false); const [walkIn, setWalkIn] = useState(false); const [scan, setScan] = useState<Scan | null>(null);
  const queue = useRef(createCheckinQueue());
  const syncing = useRef(false);
  const [pending, setPending] = useState<PendingCheckin[]>([]);
  const [online, setOnline] = useState(true);
  const enqueue = (item: PendingCheckin) => { queue.current.add(item); setPending(queue.current.items()); };
  const sync = async () => {
    if (syncing.current || !navigator.onLine) return;
    syncing.current = true;
    try {
      for (const item of queue.current.items()) {
        if (item.eventId !== id) continue;
        const res = item.rsvpId
          ? await supabase.rpc('check_in_rsvp', { _rsvp: item.rsvpId, _undo: item.undo })
          : await supabase.rpc('check_in_code', { _event: id, _code: item.code ?? '' });
        if (res.error) {
          if (isRetryableCheckinError(res.error, res.status)) break;
          toast.error(t('profile.saveError')); queue.current.remove(item.key);
        } else {
          queue.current.remove(item.key); trackEvent('checkin');
          if (item.code) setScan((res.data ?? { result: 'error' }) as Scan);
        }
      }
      setPending(queue.current.items());
      await queryClient.invalidateQueries({ queryKey: listKey });
    } catch { setPending(queue.current.items()); } finally { syncing.current = false; }
  };
  useEffect(() => {
    const onOnline = () => { setOnline(true); void sync(); };
    const onOffline = () => setOnline(false);
    setOnline(navigator.onLine);
    window.addEventListener('online', onOnline); window.addEventListener('offline', onOffline);
    const timer = window.setInterval(() => { if (queue.current.items().length) void sync(); }, 5000);
    const warn = (e: BeforeUnloadEvent) => { if (queue.current.items().length) { e.preventDefault(); } };
    window.addEventListener('beforeunload', warn);
    return () => { clearInterval(timer); window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); window.removeEventListener('beforeunload', warn); };
  }, [id]);
  const match = (n: string | null) => !q || (n ?? '').toLowerCase().includes(q.toLowerCase());
  const waiting = rows.filter(r => !r.checked_in_at && r.status === 'going' && match(r.guest_name));
  const done = rows.filter(r => r.checked_in_at && match(r.guest_name)).sort((a, b) => (b.checked_in_at ?? '').localeCompare(a.checked_in_at ?? ''));
  const checkIn = async (rid: string, undo = false) => {
    if (!navigator.onLine) { enqueue({ key: rid, eventId: id, rsvpId: rid, undo }); return; }
    const { error, status } = await supabase.rpc('check_in_rsvp', { _rsvp: rid, _undo: undo });
    if (error) { if (isRetryableCheckinError(error, status)) enqueue({ key: rid, eventId: id, rsvpId: rid, undo }); else toast.error(t('profile.saveError')); return; }
    trackEvent('checkin');
    if (navigator.vibrate) navigator.vibrate(30);
    await queryClient.invalidateQueries({ queryKey: listKey });
  };
  const onCode = async (code: string) => {
    if (!navigator.onLine) { enqueue({ key: code, eventId: id, code, undo: false }); setScan({ result: 'pending' }); return; }
    const { data, error, status } = await supabase.rpc('check_in_code', { _event: id, _code: code }); if (!error) trackEvent('checkin');
    if (error && isRetryableCheckinError(error, status)) { enqueue({ key: code, eventId: id, code, undo: false }); setScan({ result: 'pending' }); return; }
    const res = (data ?? null) as Scan | null;
    setScan(error || !res ? { result: 'error' } : res);
    if (res?.result === 'ok' && navigator.vibrate) navigator.vibrate([40, 40, 40]);
    await queryClient.invalidateQueries({ queryKey: listKey });
  };

  return <div className="checkin-screen">
    <header className="checkin-top">
      <div className="checkin-title"><strong>{event?.title ?? ''}</strong><Button asChild variant="ghost" size="icon" aria-label={t('checkin.exit')}><Link to="/event/$id" params={{ id }}><X /></Link></Button></div>
      <div className="checkin-counters">{([['going', counts?.going], ['checked_in', counts?.checked_in], ['walk_ins', counts?.walk_ins], ['waitlist', counts?.waitlist]] as const).map(([k, v]) =>
        <div key={k}><strong className="tabular-nums">{v ?? 0}</strong><span>{t(`checkin.counts.${k}`)}</span></div>)}</div>
      <div className="checkin-search"><Search /><Input aria-label={t('checkin.search')} placeholder={t('checkin.search')} value={q} onChange={e => setQ(e.target.value)} /></div>
      <div className="checkin-tools"><Button onClick={() => { setScan(null); setScanning(true); }}><QrCode />{t('checkin.scan')}</Button><Button variant="secondary" onClick={() => setWalkIn(true)}><UserPlus />{t('checkin.walkIn')}</Button></div>
    </header>
    {(!online || pending.length > 0) && <div className="connection-note" role="status"><p>{t(pending.length ? 'launch.pending' : 'launch.offline', { count: pending.length })}</p>{pending.length > 0 && <Button variant="secondary" disabled={!online} onClick={() => void sync()}>{t('error.retry')}</Button>}</div>}
    {isLoading ? <ListSkeleton /> : error ? <RetryState retry={() => void refetch()} /> : <main className="checkin-body">
      <h2 className="checkin-section">{t('checkin.toCheckIn')} <span className="tabular-nums">{waiting.length}</span></h2>
      {waiting.length === 0 && <p className="muted">{t('checkin.allIn')}</p>}
      <ul className="checkin-list">{waiting.map(r => <li key={r.id}><span className="initial-avatar">{initialsOf(r.guest_name)}</span>
        <span className="checkin-name">{r.guest_name}{r.plus_ones > 0 && <small>+{r.plus_ones}</small>}</span>
        <Button className="checkin-button" disabled={pending.some(p => p.rsvpId === r.id)} onClick={() => checkIn(r.id)}>{t(pending.some(p => p.rsvpId === r.id) ? 'launch.waiting' : 'checkin.checkIn')}</Button></li>)}</ul>
      <h2 className="checkin-section">{t('checkin.checkedIn')} <span className="tabular-nums">{done.length}</span></h2>
      <ul className="checkin-list is-done">{done.map(r => <li key={r.id}><CheckCircle2 className="checkin-ok" />
        <span className="checkin-name">{r.guest_name}{r.is_walk_in && <small>{t('checkin.walkInTag')}</small>}<small>{r.checked_in_at && new Date(r.checked_in_at).toLocaleTimeString(lang, { hour: 'numeric', minute: '2-digit' })}</small></span>
        <Button variant="ghost" size="icon" aria-label={t('checkin.undo')} onClick={() => checkIn(r.id, true)}><Undo2 /></Button></li>)}</ul>
    </main>}
    {scanning && <Scanner onClose={() => setScanning(false)} onCode={onCode} scan={scan} onNext={() => setScan(null)} />}
    <WalkInSheet open={walkIn} eventId={id} onClose={() => setWalkIn(false)} onSaved={() => queryClient.invalidateQueries({ queryKey: listKey })} />
  </div>;
}

function Scanner({ onClose, onCode, scan, onNext }: { onClose: () => void; onCode: (c: string) => Promise<void>; scan: Scan | null; onNext: () => void }) {
  const { t } = useTranslation();
  const video = useRef<HTMLVideoElement>(null); const busy = useRef(false); const paused = useRef(false);
  const [denied, setDenied] = useState(false);
  paused.current = !!scan;
  useEffect(() => {
    let stream: MediaStream | null = null; let raf = 0; let stopped = false;
    const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) { setDenied(true); return; }
    void (async () => {
      const { default: jsQR } = await import('jsqr');
      try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }); } catch { setDenied(true); return; }
      if (stopped || !video.current) return;
      video.current.srcObject = stream; await video.current.play().catch(() => undefined);
      const tick = async () => {
        if (stopped) return;
        const v = video.current;
        if (v && v.readyState >= 2 && !busy.current && !paused.current) {
          canvas.width = v.videoWidth; canvas.height = v.videoHeight; ctx.drawImage(v, 0, 0);
          const found = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height, { inversionAttempts: 'dontInvert' });
          if (found?.data) { busy.current = true; await onCode(found.data.trim()); busy.current = false; }
        }
        raf = requestAnimationFrame(() => void tick());
      };
      void tick();
    })();
    return () => { stopped = true; cancelAnimationFrame(raf); stream?.getTracks().forEach(tr => tr.stop()); };
  }, [onCode]);
  return <div className="scanner" role="dialog" aria-modal="true" aria-label={t('checkin.scan')}>
    <video ref={video} playsInline muted className="scanner-video" />
    <div className="scanner-frame" aria-hidden="true" />
    <Button variant="secondary" size="icon" className="scanner-close" aria-label={t('checkin.closeScanner')} onClick={onClose}><X /></Button>
    {denied && <div className="scanner-result is-error"><AlertCircle /><strong>{t('checkin.cameraDenied')}</strong><Button onClick={onClose}>{t('checkin.useList')}</Button></div>}
    {!denied && !scan && <p className="scanner-hint">{t('checkin.pointCamera')}</p>}
    {scan && <div className={`scanner-result ${scan.result === 'ok' ? 'is-ok' : scan.result === 'already' ? 'is-warn' : 'is-error'}`} aria-live="assertive">
      {scan.result === 'ok' ? <CheckCircle2 /> : <AlertCircle />}
      <strong>{t(scan.result === 'pending' ? 'launch.scanPending' : `checkin.scanResult.${scan.result}`, { name: scan.name ?? '' })}</strong>
      <Button onClick={onNext}>{t('checkin.scanNext')}</Button>
    </div>}
  </div>;
}

function WalkInSheet({ open, eventId, onClose, onSaved }: { open: boolean; eventId: string; onClose: () => void; onSaved: () => void }) {
  const { t, i18n } = useTranslation();
  const blank = { first: '', last: '', phone: '', email: '', sms: false, mail: false };
  const [f, setF] = useState(blank); const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr(null);
    if (!f.first.trim()) { setErr(t('guest.errors.name_required')); return; }
    if (!f.phone.trim() && !f.email.trim()) { setErr(t('guest.errors.contact_required')); return; }
    setBusy(true);
    const { error } = await supabase.rpc('add_walk_in', { _event: eventId, _first: f.first.trim(), _last: f.last.trim(), _phone: f.phone.trim(), _email: f.email.trim(), _sms: f.sms, _mail: f.mail, _language: i18n.resolvedLanguage === 'es' ? 'es' : 'en' });
    setBusy(false);
    if (error) { setErr(t(rsvpErrorKey(error))); return; }
    toast.success(t('checkin.walkInAdded', { name: f.first.trim() })); setF(blank); onSaved(); onClose();
  };
  return <ResponsiveSheet open={open} onOpenChange={o => !o && onClose()} title={t('checkin.walkIn')}>
    <form className="guest-form" onSubmit={submit} noValidate>
      <div className="guest-name-row">
        <div><label className="field-label" htmlFor="w-first">{t('guest.firstName')}</label><Input id="w-first" autoFocus maxLength={60} className="field-input" value={f.first} onChange={e => setF({ ...f, first: e.target.value })} /></div>
        <div><label className="field-label" htmlFor="w-last">{t('guest.lastName')}</label><Input id="w-last" maxLength={60} className="field-input" value={f.last} onChange={e => setF({ ...f, last: e.target.value })} /></div>
      </div>
      <div><label className="field-label" htmlFor="w-phone">{t('guest.phone')}</label><Input id="w-phone" type="tel" inputMode="tel" maxLength={30} className="field-input" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} /></div>
      <div><label className="field-label" htmlFor="w-email">{t('guest.email')}</label><Input id="w-email" type="email" maxLength={200} className="field-input" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /></div>
      <label className="guest-consent"><Checkbox checked={f.sms} onCheckedChange={v => setF({ ...f, sms: !!v })} /><span>{t('guest.smsConsent')}</span></label>
      <label className="guest-consent"><Checkbox checked={f.mail} onCheckedChange={v => setF({ ...f, mail: !!v })} /><span>{t('guest.emailConsent')}</span></label>
      {err && <p className="field-error" role="alert">{err}</p>}
      <Button type="submit" className="guest-primary" disabled={busy}>{t('checkin.addAndCheckIn')}</Button>
    </form>
  </ResponsiveSheet>;
}
