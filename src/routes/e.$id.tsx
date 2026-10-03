import { useState, type FormEvent } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { CalendarDays, MapPin, UsersRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AuthFrame, pageHead } from '@/components/auth-frame';
import { supabase } from '@/integrations/supabase/client';

export const Route = createFileRoute('/e/$id')({ head: () => pageHead('publicEvent.eyebrow', 'meta.event'), component: PublicEventPage });

function PublicEventPage() {
  const { t, i18n } = useTranslation();
  const { id } = Route.useParams();
  const { data, isLoading } = useQuery({
    queryKey: ['public-event', id],
    queryFn: async () => {
      if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
      const { data: event } = await supabase.from('events').select('id,title,description_en,description_es,starts_at,timezone,location_name,address,online_url').eq('id', id).maybeSingle();
      if (!event) return null;
      const { data: count } = await supabase.rpc('event_going_count', { _event_id: id });
      return { event, going: count ?? 0 };
    },
  });
  const [form, setForm] = useState({ name: '', phone: '', email: '', plusOnes: 0, sms: false, mail: false });
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setBusy(true); setError(null);
    const { data: result, error: err } = await supabase.rpc('create_guest_rsvp', { _event_id: id, _guest_name: form.name, _guest_phone: form.phone, _guest_email: form.email, _language: i18n.resolvedLanguage ?? 'en', _plus_ones: form.plusOnes, _sms_opt_in: form.sms, _email_opt_in: form.mail });
    setBusy(false);
    if (err || !result) setError(t('auth.error')); else setCode(result);
  };

  if (isLoading) return <AuthFrame><p className="auth-subtitle">{t('publicEvent.loading')}</p></AuthFrame>;
  if (!data) return <AuthFrame><h1 className="auth-title">{t('publicEvent.notFound')}</h1></AuthFrame>;
  const { event, going } = data;
  const when = new Intl.DateTimeFormat(i18n.resolvedLanguage, { dateStyle: 'full', timeStyle: 'short', timeZone: event.timezone }).format(new Date(event.starts_at));
  const description = i18n.resolvedLanguage === 'es' ? event.description_es ?? event.description_en : event.description_en ?? event.description_es;

  return <AuthFrame>
    <span className="eyebrow">{t('publicEvent.eyebrow')}</span>
    <h1 className="auth-title">{event.title}</h1>
    <div className="event-facts">
      <p><CalendarDays />{when}</p>
      <p><MapPin />{event.location_name ?? (event.online_url ? t('publicEvent.online') : event.address)}</p>
      <p className="tabular-nums"><UsersRound />{t('publicEvent.going', { count: going })}</p>
    </div>
    {description && <p className="auth-subtitle">{description}</p>}
    {code ? <div className="rsvp-done"><h2>{t('publicEvent.doneTitle')}</h2><p>{t('publicEvent.doneText')}</p><code>{code}</code></div> :
      <form className="auth-form" onSubmit={submit}>
        <h2 className="section-title">{t('publicEvent.rsvpTitle')}</h2>
        <label className="field-label" htmlFor="g-name">{t('publicEvent.name')}</label>
        <Input id="g-name" required maxLength={120} className="field-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        <label className="field-label" htmlFor="g-phone">{t('publicEvent.phone')}</label>
        <Input id="g-phone" type="tel" maxLength={30} className="field-input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
        <label className="field-label" htmlFor="g-email">{t('publicEvent.emailOpt')}</label>
        <Input id="g-email" type="email" maxLength={200} className="field-input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
        <label className="field-label" htmlFor="g-plus">{t('publicEvent.plusOnes')}</label>
        <Input id="g-plus" type="number" min={0} max={10} className="field-input" value={form.plusOnes} onChange={e => setForm({ ...form, plusOnes: Math.max(0, Math.min(10, Number(e.target.value) || 0)) })} />
        <label className="check-row"><input type="checkbox" checked={form.sms} onChange={e => setForm({ ...form, sms: e.target.checked })} />{t('publicEvent.smsOptIn')}</label>
        <label className="check-row"><input type="checkbox" checked={form.mail} onChange={e => setForm({ ...form, mail: e.target.checked })} />{t('publicEvent.emailOptIn')}</label>
        <Button type="submit" className="auth-button" disabled={busy}>{t('publicEvent.submit')}</Button>
        {error && <p className="field-error" role="alert">{error}</p>}
      </form>}
  </AuthFrame>;
}
