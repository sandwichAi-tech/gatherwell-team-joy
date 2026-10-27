import { useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ResponsiveSheet } from '@/components/responsive-sheet';
import { confirmedWalkIn, walkInErrorKey, type WalkInResult } from '@/lib/walk-in';

export function WalkInSheet({ open, eventId, onClose, onSaved }: { open: boolean; eventId: string; onClose: () => void; onSaved: () => void }) {
  const { t, i18n } = useTranslation();
  const blank = { first: '', last: '', phone: '', email: '' };
  const [fields, setFields] = useState(blank); const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null); const [existing, setExisting] = useState<WalkInResult | null>(null);
  const request = useRef<{ fingerprint: string; id: string } | null>(null); const submitting = useRef(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (submitting.current) return;
    setError(null); setExisting(null);
    if (!fields.first.trim()) { setError(t('guest.errors.name_required')); return; }
    if (!fields.phone.trim() && !fields.email.trim()) { setError(t('guest.errors.contact_required')); return; }
    const fingerprint = JSON.stringify([eventId, fields]);
    if (request.current?.fingerprint !== fingerprint) request.current = { fingerprint, id: crypto.randomUUID() };
    submitting.current = true; setBusy(true);
    try {
      const { data, error: failure } = await supabase.rpc('walk_in_admit', { _event: eventId, _request: request.current.id, _first: fields.first.trim(), _last: fields.last.trim(), _phone: fields.phone.trim(), _email: fields.email.trim(), _language: i18n.resolvedLanguage === 'es' ? 'es' : 'en' });
      if (failure) { setError(t(walkInErrorKey(failure))); return; }
      const result = data as unknown as WalkInResult;
      if (result.result === 'existing' || result.result === 'already') { setExisting(result); onSaved(); return; }
      if (!confirmedWalkIn(result)) { setError(t('checkin.walkInRetry')); return; }
      onSaved(); toast.success(t('checkin.walkInAdded', { name: fields.first.trim() })); setFields(blank); request.current = null; onClose();
    } catch { setError(t('checkin.walkInRetry')); }
    finally { submitting.current = false; setBusy(false); }
  };
  const checkExisting = async () => {
    if (!existing || submitting.current) return;
    submitting.current = true; setBusy(true); setError(null);
    try {
      const { error: failure } = await supabase.rpc('check_in_rsvp', { _rsvp: existing.rsvp_id, _undo: false });
      if (failure) { setError(t(walkInErrorKey(failure))); return; }
      onSaved(); toast.success(t('checkin.scanResult.ok', { name: fields.first.trim() })); onClose();
    } catch { setError(t('checkin.walkInRetry')); } finally { submitting.current = false; setBusy(false); }
  };
  return <ResponsiveSheet open={open} onOpenChange={value => { if (!value && !busy) onClose(); }} title={t('checkin.walkIn')}
    footer={<Button form="walkin-form" type="submit" className="min-h-12 w-full whitespace-normal" disabled={busy}>{t(busy ? 'launch.waiting' : 'checkin.addAndCheckIn')}</Button>}>
    <form id="walkin-form" className="guest-form" onSubmit={submit} noValidate>
      <div className="guest-name-row">{(['first', 'last'] as const).map(key => <div key={key}><label className="field-label" htmlFor={`w-${key}`}>{t(key === 'first' ? 'guest.firstName' : 'guest.lastName')}</label><Input id={`w-${key}`} autoFocus={key === 'first'} maxLength={60} value={fields[key]} onChange={e => setFields({ ...fields, [key]: e.target.value })} /></div>)}</div>
      {(['phone', 'email'] as const).map(key => <div key={key}><label className="field-label" htmlFor={`w-${key}`}>{t(`guest.${key}`)}</label><Input id={`w-${key}`} type={key === 'phone' ? 'tel' : 'email'} maxLength={key === 'phone' ? 30 : 200} value={fields[key]} onChange={e => setFields({ ...fields, [key]: e.target.value })} /></div>)}
      {existing && <div role="status"><p>{t(existing.checked_in ? 'checkin.walkInAlready' : 'checkin.walkInExisting')}</p>{!existing.checked_in && existing.status === 'going' && <Button type="button" className="min-h-12 whitespace-normal" disabled={busy} onClick={() => void checkExisting()}>{t('checkin.checkExisting')}</Button>}</div>}
      {error && <div role="alert"><p className="field-error">{error}</p><Button asChild variant="link"><Link to="/e/$id" params={{ id: eventId }}>{t('checkin.attendeeResolution')}</Link></Button></div>}
    </form>
  </ResponsiveSheet>;
}