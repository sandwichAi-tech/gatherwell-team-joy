import { useState, type FormEvent } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { MessageCircle, Send } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ResponsiveSheet } from '@/components/responsive-sheet';
import { supabase } from '@/integrations/supabase/client';

const db = supabase as unknown as { rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: any; error: { message?: string } | null }> };

const errKey = (e: unknown) => {
  const m = String((e as { message?: string })?.message ?? '');
  for (const k of ['blocked', 'rate_limited', 'not_allowed', 'adult_required', 'invalid_body']) if (m.includes(k)) return `inbox.errors.${k}`;
  return 'profile.saveError';
};

/** "Contact host" — opens a registration-tied in-app thread. No email/phone is exposed. */
export function ContactHostButton({ eventId, offerId, label }: { eventId?: string; offerId?: string; label?: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); const text = body.trim(); if (!text) return;
    setBusy(true);
    const { data, error } = await db.rpc('start_contact_thread', { _event: eventId ?? null, _offer: offerId ?? null, _body: text });
    setBusy(false);
    if (error) { toast.error(t(errKey(error))); return; }
    toast.success(t('inbox.sent'));
    setOpen(false); setBody('');
    void navigate({ to: '/inbox', search: { thread: data as string } });
  };
  return <>
    <Button variant="secondary" onClick={() => setOpen(true)}><MessageCircle />{label ?? t('inbox.contactHost')}</Button>
    <ResponsiveSheet open={open} onOpenChange={setOpen} title={t('inbox.contactHost')} description={t('inbox.contactHostText')}>
      <form className="edit-form" onSubmit={submit}>
        <div><label className="field-label" htmlFor="ch-body">{t('inbox.message')}</label><Textarea id="ch-body" required rows={4} maxLength={2000} value={body} onChange={e => setBody(e.target.value)} /></div>
        <p className="muted">{t('inbox.privacyNote')}</p>
        <Button type="submit" disabled={busy || !body.trim()}><Send />{t('inbox.send')}</Button>
      </form>
    </ResponsiveSheet>
  </>;
}
