import { useEffect, useState, type FormEvent } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AuthFrame, pageHead } from '@/components/auth-frame';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GwIcon } from '@/components/gw-icon';
import { supabase } from '@/integrations/supabase/client';
import { NOINDEX_META } from '@/lib/seo';

export const Route = createFileRoute('/reset-password')({
  head: () => { const h = pageHead('auth.newPasswordTitle', 'meta.resetPassword'); return { meta: [...h.meta, { ...NOINDEX_META }] }; },
  component: ResetPassword,
});

function ResetPassword() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [ready, setReady] = useState<'checking' | 'ok' | 'invalid'>('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let active = true;
    const isRecovery = window.location.hash.includes('type=recovery') || new URLSearchParams(window.location.search).has('code');
    const sub = supabase.auth.onAuthStateChange((event, session) => { if (active && session && (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN')) setReady('ok'); });
    const timer = setTimeout(() => {
      void supabase.auth.getSession().then(({ data }) => { if (active) setReady(r => r !== 'checking' ? r : data.session && (isRecovery || r === 'checking') ? 'ok' : 'invalid'); });
    }, 1200);
    return () => { active = false; clearTimeout(timer); sub.data.subscription.unsubscribe(); };
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (password.length < 8) { setError(t('auth.passwordShort')); return; }
    if (password !== confirm) { setError(t('auth.passwordMismatch')); return; }
    setBusy(true); setError(null);
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) { setError(t('auth.error')); return; }
      setPassword(''); setConfirm('');
      await queryClient.cancelQueries(); queryClient.clear();
      await supabase.auth.signOut();
      setDone(true);
      setTimeout(() => { void navigate({ to: '/admin-login', replace: true }); }, 2500);
    } catch { setError(t('auth.error')); } finally { setBusy(false); }
  }

  return <AuthFrame>
    <div className="auth-icon"><GwIcon name="ShieldCheck" /></div>
    <h1 className="auth-title">{t('auth.newPasswordTitle')}</h1>
    {done ? <p className="auth-subtitle" role="status">{t('auth.passwordSaved')}</p>
      : ready === 'checking' ? <p className="auth-subtitle" role="status">{t('auth.checkingLink')}</p>
      : ready === 'invalid' ? <p className="field-error" role="alert">{t('auth.recoveryMissing')}</p>
      : <>
        <p className="auth-subtitle">{t('auth.newPasswordSubtitle')}</p>
        <form className="auth-form" onSubmit={save} noValidate>
          <label className="field-label" htmlFor="new-password">{t('auth.newPassword')}</label>
          <Input id="new-password" className="field-input" type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} disabled={busy} aria-invalid={!!error} />
          <label className="field-label mt-3" htmlFor="confirm-password">{t('auth.confirmPassword')}</label>
          <Input id="confirm-password" className="field-input" type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} disabled={busy} aria-invalid={!!error} />
          {error && <p className="field-error" role="alert">{error}</p>}
          <Button type="submit" className="auth-button mt-3" disabled={busy}>{t(busy ? 'auth.savingPassword' : 'auth.savePassword')}</Button>
        </form>
      </>}
    <Button asChild variant="link" className="auth-link"><Link to="/admin-login">{t('auth.resetBack')}</Link></Button>
  </AuthFrame>;
}
