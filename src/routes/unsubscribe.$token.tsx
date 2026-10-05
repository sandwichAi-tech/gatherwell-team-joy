import { useEffect, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { AuthFrame, pageHead, setLanguage } from '@/components/auth-frame';
import { supabase } from '@/integrations/supabase/client';

export const Route = createFileRoute('/unsubscribe/$token')({ head: () => pageHead('unsubscribe.title', 'meta.unsubscribe'), component: UnsubscribePage });

type Prefs = { email: string; language: string; all_off: boolean; reminders: boolean; announcements: boolean; badges: boolean; followups: boolean };

function UnsubscribePage() {
  const { t } = useTranslation(); const { token } = Route.useParams();
  const [prefs, setPrefs] = useState<Prefs | null | 'invalid'>(null); const [saved, setSaved] = useState(false); const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!/^[0-9a-f-]{36}$/i.test(token)) { setPrefs('invalid'); return; }
    void supabase.rpc('get_email_prefs', { _token: token }).then(({ data }) => {
      if (!data) { setPrefs('invalid'); return; }
      const p = data as unknown as Prefs; setPrefs(p); if (p.language === 'es' || p.language === 'en') setLanguage(p.language);
    });
  }, [token]);
  const save = async (next: Partial<Prefs>) => {
    if (!prefs || prefs === 'invalid') return; setBusy(true);
    const merged = { ...prefs, ...next };
    const { error } = await supabase.rpc('set_email_prefs', { _token: token, _prefs: merged });
    setBusy(false); if (!error) { setPrefs(merged); setSaved(true); }
  };
  return <AuthFrame>
    {prefs === null && <p className="auth-subtitle">{t('join.loading')}</p>}
    {prefs === 'invalid' && <><h1 className="auth-title">{t('error.notFound')}</h1><p className="auth-subtitle">{t('unsubscribe.invalid')}</p></>}
    {prefs && prefs !== 'invalid' && <>
      <span className="eyebrow">{t('unsubscribe.eyebrow')}</span>
      <h1 className="auth-title">{t('unsubscribe.title')}</h1>
      <p className="auth-subtitle">{t('unsubscribe.for', { email: prefs.email })}</p>
      <div className="settings-list unsubscribe-list">{(['reminders', 'announcements', 'badges', 'followups'] as const).map(key => <label className="switch-row notify-row" key={key}>
        <span><strong>{t(`notify.type.${key}`)}</strong></span>
        <Switch disabled={prefs.all_off || busy} checked={!prefs.all_off && prefs[key]} onCheckedChange={v => void save({ [key]: v })} aria-label={t(`notify.type.${key}`)} /></label>)}</div>
      {prefs.all_off
        ? <Button variant="secondary" className="auth-button" disabled={busy} onClick={() => void save({ all_off: false })}>{t('unsubscribe.resubscribe')}</Button>
        : <Button className="auth-button" disabled={busy} onClick={() => void save({ all_off: true })}>{t('unsubscribe.all')}</Button>}
      {saved && <p className="auth-subtitle" role="status">{prefs.all_off ? t('unsubscribe.doneAll') : t('unsubscribe.saved')}</p>}
      <p className="not-connected">{t('unsubscribe.note')}</p>
    </>}
  </AuthFrame>;
}
