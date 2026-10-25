import { useEffect, useState, type FormEvent } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useTranslation } from 'react-i18next';
import { AuthFrame, pageHead } from '@/components/auth-frame';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GwIcon } from '@/components/gw-icon';
import { supabase } from '@/integrations/supabase/client';
import { getAdminAccess } from '@/lib/admin.functions';
import { NOINDEX_META } from '@/lib/seo';

export const Route = createFileRoute('/admin-login')({
  head: () => { const h = pageHead('auth.adminTitle', 'auth.adminSubtitle'); return { meta: [...h.meta, { ...NOINDEX_META }] }; },
  component: AdminLogin,
});

function AdminLogin() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const access = useServerFn(getAdminAccess);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgot, setForgot] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetBusy, setResetBusy] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      try {
        const result = await access();
        if (active && result.admin) void navigate({ to: '/admin', replace: true });
      } catch { /* Keep the sign-in form available if session validation fails. */ }
    });
    return () => { active = false; };
  }, [access, navigate]);

  async function signIn(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await queryClient.cancelQueries();
      queryClient.clear();
      const result = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (result.error || !result.data.user) {
        setError(t('auth.passwordError'));
        return;
      }
      setPassword('');
      const permission = await access();
      if (!permission.admin) {
        await queryClient.cancelQueries();
        queryClient.clear();
        await supabase.auth.signOut();
        setError(t('auth.adminOnly'));
        return;
      }
      await navigate({ to: '/admin', replace: true });
    } catch {
      setError(t('auth.error'));
    } finally {
      setBusy(false);
    }
  }

  async function sendReset(event: FormEvent) {
    event.preventDefault();
    if (resetBusy) return;
    const value = resetEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) { setResetError(t('auth.invalidEmail')); return; }
    setResetBusy(true); setResetError(null);
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(value, { redirectTo: `${window.location.origin}/reset-password` });
      if (err) setResetError(t('auth.error')); else setResetSent(value);
    } catch { setResetError(t('auth.error')); } finally { setResetBusy(false); }
  }

  if (forgot) return <AuthFrame>
    <div className="auth-icon"><GwIcon name="ShieldCheck" /></div>
    <h1 className="auth-title">{t('auth.resetTitle')}</h1>
    {resetSent ? <p className="auth-subtitle" role="status">{t('auth.resetSent', { email: resetSent })}</p> : <>
      <p className="auth-subtitle">{t('auth.resetSubtitle')}</p>
      <form className="auth-form" onSubmit={sendReset} noValidate>
        <label className="field-label" htmlFor="reset-email">{t('auth.email')}</label>
        <Input id="reset-email" className="field-input" type="email" autoComplete="email" value={resetEmail} onChange={event => setResetEmail(event.target.value)} disabled={resetBusy} aria-invalid={!!resetError} aria-describedby={resetError ? 'reset-error' : undefined} />
        {resetError && <p id="reset-error" className="field-error" role="alert">{resetError}</p>}
        <Button type="submit" className="auth-button mt-3" disabled={resetBusy}>{t(resetBusy ? 'auth.resetSending' : 'auth.resetSend')}</Button>
      </form>
    </>}
    <Button type="button" variant="link" className="auth-link" onClick={() => { setForgot(false); setResetSent(null); setResetError(null); }}>{t('auth.resetBack')}</Button>
  </AuthFrame>;

  return <AuthFrame>
    <div className="auth-icon"><GwIcon name="ShieldCheck" /></div>
    <h1 className="auth-title">{t('auth.adminTitle')}</h1>
    <p className="auth-subtitle">{t('auth.adminSubtitle')}</p>
    <form className="auth-form" onSubmit={signIn}>
      <label className="field-label" htmlFor="admin-email">{t('auth.email')}</label>
      <Input id="admin-email" className="field-input" type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} required disabled={busy} />
      <label className="field-label mt-3" htmlFor="admin-password">{t('auth.password')}</label>
      <div className="relative">
        <Input id="admin-password" className="field-input pr-12" type={visible ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required disabled={busy} />
        <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full min-w-11" aria-label={t(visible ? 'auth.hidePassword' : 'auth.showPassword')} aria-pressed={visible} onClick={() => setVisible(value => !value)}><GwIcon name={visible ? 'EyeOff' : 'Eye'} /></Button>
      </div>
      <div className="flex justify-end"><Button type="button" variant="link" className="auth-link min-h-11 px-0" onClick={() => { setResetEmail(email.trim()); setForgot(true); }}>{t('auth.forgot')}</Button></div>
      {error && <p className="field-error" role="alert">{error}</p>}
      <Button type="submit" className="auth-button mt-3" disabled={busy}>{t(busy ? 'auth.signingIn' : 'auth.adminSignIn')}</Button>
    </form>
    <Button asChild variant="link" className="auth-link"><Link to="/login">{t('auth.regularSignIn')}</Link></Button>
  </AuthFrame>;
}