import { useEffect, useId, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { ResponsiveSheet } from '@/components/responsive-sheet';
import { supabase } from '@/integrations/supabase/client';
import { cancelConfirmMatches, missingBackendFunction, refundDeadline, type RefundEligibility, type RefundStatus } from '@/lib/cancellation';

type Err = { code?: string; message: string } | null;
const db = supabase as unknown as { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: Err }>; from: (t: string) => any };
const money = (c: number, lang: string) => new Intl.NumberFormat(lang === 'es' ? 'es-419' : 'en-US', { style: 'currency', currency: 'USD' }).format(c / 100);

type Summary = { going: number; waitlist: number; paid: number; refundable_cents: number; refunds: Partial<Record<RefundStatus, number>> };

/** Host: high-friction event cancellation. Typed title, affected-booking summary, refund requests (never "refunded"). */
export function HostEventCancelSheet({ event, open, onClose, onDone }: { event: { id: string; title: string }; open: boolean; onClose: () => void; onDone: () => void | Promise<void> }) {
  const { t, i18n } = useTranslation(); const lang = i18n.resolvedLanguage ?? 'en'; const inputId = useId();
  const [typed, setTyped] = useState(''); const [notify, setNotify] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (!open) { setTyped(''); setError(null); } }, [open]);
  const summary = useQuery({ queryKey: ['event-cancel-summary', event.id], enabled: open, retry: false, queryFn: async () => {
    const { data, error: e } = await db.rpc('event_cancellation_summary', { _event: event.id }); if (e) throw e; return data as Summary;
  } });
  const unavailable = summary.isError;
  const ready = cancelConfirmMatches(typed, event.title);
  const submit = async () => {
    if (!ready || busy) return; setBusy(true); setError(null);
    const { data, error: e } = await db.rpc('cancel_event_with_refunds', { _event: event.id, _confirm: typed });
    if (e) { setBusy(false); setError(t(missingBackendFunction(e) ? 'cancellation.errors.notReady' : e.message.includes('confirm_mismatch') ? 'cancellation.errors.mismatch' : 'cancellation.errors.generic')); return; }
    let queued = 0;
    if (notify) { const { data: n } = await supabase.rpc('notify_gathering_cancelled', { _event: event.id }); queued = Number(n ?? 0); }
    setBusy(false);
    const requests = Number((data as { refund_requests?: number })?.refund_requests ?? 0);
    toast.success(t('cancellation.host.done', { count: requests }));
    if (notify) toast.message(t('cancellation.host.queued', { count: queued }));
    await onDone();
  };
  return <ResponsiveSheet open={open} onOpenChange={o => !o && onClose()} title={t('cancellation.host.title')} description={t('cancellation.host.help')}
    footer={<div className="confirm-actions"><Button variant="secondary" onClick={onClose}>{t('gathering.keep')}</Button>
      <Button className="danger-button" disabled={!ready || busy || unavailable} aria-busy={busy} onClick={() => void submit()}>{t('cancellation.host.confirm')}</Button></div>}>
    <div className="edit-form cancel-sheet">
      {summary.isLoading && <p role="status">{t('publicEvent.loading')}</p>}
      {unavailable && <p className="field-error" role="alert">{t('cancellation.errors.notReady')} <Button type="button" variant="ghost" onClick={() => void summary.refetch()}>{t('error.retry')}</Button></p>}
      {summary.data && <ul className="plain-list cancel-summary" aria-label={t('cancellation.host.affected')}>
        <li>{t('cancellation.host.going', { count: summary.data.going })}</li>
        <li>{t('cancellation.host.waitlist', { count: summary.data.waitlist })}</li>
        {summary.data.paid > 0 && <li>{t('cancellation.host.paid', { count: summary.data.paid, amount: money(summary.data.refundable_cents, lang) })}</li>}
      </ul>}
      {summary.data && summary.data.paid > 0 && <p className="field-hint">{t('cancellation.host.refundHow')}</p>}
      <p className="field-hint">{t('cancellation.host.stops')}</p>
      <label className="switch-row"><Checkbox checked={notify} onCheckedChange={v => setNotify(!!v)} /><span><strong>{t('gathering.notifyGuests')}</strong><small>{t('cancellation.host.notifyNote')}</small></span></label>
      <label className="field-label" htmlFor={inputId}>{t('cancellation.host.typeTitle', { title: event.title })}</label>
      <Input id={inputId} value={typed} onChange={e => setTyped(e.target.value)} autoComplete="off" aria-invalid={!!typed && !ready} />
      {error && <p className="field-error" role="alert">{error}</p>}
    </div>
  </ResponsiveSheet>;
}

type RefundRow = { id: string; status: RefundStatus; amount_cents: number; attempt: number; source: string; failure_reason: string | null; created_at: string };

/** Host: refund requests for this event with provider-confirmed states; failed ones can be retried once at a time. */
export function HostRefundRequests({ eventId, userId }: { eventId: string; userId: string }) {
  const { t, i18n } = useTranslation(); const lang = i18n.resolvedLanguage ?? 'en'; const qc = useQueryClient(); const [busy, setBusy] = useState<string | null>(null);
  const { data } = useQuery({ queryKey: ['refund-requests', eventId, userId], retry: false, queryFn: async () => {
    const { data: rows, error } = await db.from('refund_requests').select('id,status,amount_cents,attempt,source,failure_reason,created_at').eq('event_id', eventId).eq('host_id', userId).order('created_at', { ascending: false });
    if (error) return [] as RefundRow[]; return (rows ?? []) as RefundRow[];
  } });
  if (!data?.length) return null;
  const act = async (fn: 'retry_refund_request' | 'approve_refund_request', id: string) => {
    if (busy) return; setBusy(id); const { error } = await db.rpc(fn, { _id: id }); setBusy(null);
    if (error) toast.error(t('cancellation.errors.generic')); await qc.invalidateQueries({ queryKey: ['refund-requests', eventId] });
  };
  return <section className="panel refund-requests" aria-labelledby={`rr-${eventId}`}>
    <h2 id={`rr-${eventId}`}>{t('cancellation.refunds.title')}</h2>
    <p className="field-hint">{t('cancellation.refunds.providerNote')}</p>
    <ul className="plain-list">{data.map(r => <li key={r.id} className="refund-row">
      <span>{money(r.amount_cents, lang)}</span>
      <span className="chip quiet-chip">{t(`cancellation.status.${r.status}`)}</span>
      {r.status === 'failed' && <Button variant="secondary" disabled={busy === r.id} aria-busy={busy === r.id} onClick={() => void act('retry_refund_request', r.id)}>{t('cancellation.refunds.retry')}</Button>}
      {r.status === 'review' && <Button variant="secondary" disabled={busy === r.id} aria-busy={busy === r.id} onClick={() => void act('approve_refund_request', r.id)}>{t('cancellation.refunds.approve')}</Button>}
    </li>)}</ul>
  </section>;
}

type Preview = { policy: string; starts_at: string; event_status: string; checked_in: boolean; status: string; paid_cents: number | null; booking_fee_cents: number | null; eligibility: RefundEligibility; refund_status: RefundStatus | null; refund_cents: number | null };

export const cancelPreviewQuery = (code: string) => ({ queryKey: ['registration-cancel-preview', code], retry: false, queryFn: async () => {
  const { data, error } = await db.rpc('registration_cancel_preview', { _code: code }); if (error) throw error; return (data ?? null) as Preview | null;
} });

/** Attendee booking: policy, cutoff, amounts and refund state. Renders nothing until the backend supports it. */
export function BookingPolicy({ code }: { code: string }) {
  const { t, i18n } = useTranslation(); const lang = i18n.resolvedLanguage ?? 'en';
  const { data } = useQuery(cancelPreviewQuery(code));
  if (!data) return null;
  const deadline = refundDeadline(data.policy, data.starts_at);
  const fmt = new Intl.DateTimeFormat(lang === 'es' ? 'es-419' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' });
  const paid = data.paid_cents != null;
  return <section className="guest-card booking-policy" aria-labelledby={`bp-${code}`}>
    <h3 id={`bp-${code}`} className="guest-subhead">{t('cancellation.policy.title')}</h3>
    {!paid ? <p>{t('cancellation.policy.free')}</p> : <>
      <p>{t(`cancellation.policy.${data.policy === '24h' || data.policy === '7d' || data.policy === 'custom' ? data.policy : 'none'}`)}</p>
      {deadline && <p>{t('cancellation.policy.deadline', { date: fmt.format(deadline) })}</p>}
      <ul className="plain-list">
        <li>{t('cancellation.policy.paid', { amount: money(data.paid_cents ?? 0, lang) })}</li>
        {!!data.booking_fee_cents && <li>{t('cancellation.policy.fee', { amount: money(data.booking_fee_cents, lang) })}</li>}
      </ul>
      <p className="field-hint">{t('cancellation.policy.hostCancels')}</p>
    </>}
    {data.refund_status && <p role="status"><strong>{t(`cancellation.status.${data.refund_status}`)}</strong>{data.refund_cents != null && ` · ${money(data.refund_cents, lang)}`}</p>}
  </section>;
}

/** Attendee cancel confirmation with policy outcome. Falls back to the existing free cancel only for unpaid bookings. */
export function RegistrationCancelSheet({ code, open, onClose, onDone }: { code: string; open: boolean; onClose: () => void; onDone: () => void | Promise<void> }) {
  const { t, i18n } = useTranslation(); const lang = i18n.resolvedLanguage ?? 'en'; const qc = useQueryClient();
  const preview = useQuery({ ...cancelPreviewQuery(code), enabled: open });
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (!open) setError(null); }, [open]);
  const p = preview.data; const backendMissing = preview.isError;
  const outcome = !p ? null : p.eligibility === 'free' ? 'free' : p.eligibility;
  const submit = async () => {
    if (busy) return; setBusy(true); setError(null);
    const { data, error: e } = await db.rpc('cancel_my_registration', { _code: code });
    if (e && missingBackendFunction(e)) {
      // Not-yet-upgraded backend: only free bookings may use the old path; paid bookings must not lose their seat without a refund record.
      if (p?.paid_cents != null || backendMissing) { setBusy(false); setError(t('cancellation.errors.paidNotReady')); return; }
      const r = await supabase.rpc('cancel_rsvp_by_code', { _code: code }); if (r.error) { setBusy(false); setError(t('cancellation.errors.generic')); return; }
    } else if (e) { setBusy(false); setError(t('cancellation.errors.generic')); return; }
    setBusy(false);
    const res = data as { result?: string; refund?: string } | null;
    if (res?.result === 'checked_in') { setError(t('cancellation.errors.checkedIn')); return; }
    toast.success(t(res?.refund === 'pending' ? 'cancellation.attendee.donePending' : res?.refund === 'review' ? 'cancellation.attendee.doneReview' : 'guest.toastCancelled'));
    await qc.invalidateQueries({ queryKey: ['registration-cancel-preview', code] });
    await onDone();
  };
  return <ResponsiveSheet open={open} onOpenChange={o => !o && onClose()} title={t('guest.cancelRsvpTitle')} description={t('guest.cancelRsvpText')}
    footer={<div className="confirm-actions"><Button variant="secondary" onClick={onClose}>{t('gathering.keep')}</Button>
      <Button className="danger-button" disabled={busy || preview.isLoading} aria-busy={busy} onClick={() => void submit()}>{t('guest.cancelRsvp')}</Button></div>}>
    <div className="edit-form cancel-sheet">
      {preview.isLoading && <p role="status">{t('publicEvent.loading')}</p>}
      {outcome && <p role="status">{t(`cancellation.attendee.outcome.${outcome}`, { amount: money(Math.max(0, (p?.paid_cents ?? 0) - (p?.booking_fee_cents ?? 0)), lang) })}</p>}
      {outcome && outcome !== 'free' && <p className="field-hint">{t('cancellation.refunds.providerNote')}</p>}
      {error && <p className="field-error" role="alert">{error}</p>}
    </div>
  </ResponsiveSheet>;
}
