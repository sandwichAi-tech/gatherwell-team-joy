import { useEffect, useState, type FormEvent } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Mail } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AuthFrame, pageHead } from '@/components/auth-frame';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable';
import { JOIN_CODE_KEY } from '@/lib/account';

export const Route = createFileRoute('/login')({ validateSearch: (s: Record<string, unknown>): { intent?: 'host' } => (s['intent'] === 'host' ? { intent: 'host' } : {}), head: () => pageHead('auth.title', 'meta.login'), component: LoginPage });

function GoogleMark() {
  return <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7z"/><path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z"/><path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8l4-3.1z"/><path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z"/></svg>;
}

function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { intent } = Route.useSearch();
  const after = intent === 'host' ? '/gathering/new' : '/home';
  const back = `${typeof window === 'undefined' ? '' : window.location.origin}/login${intent ? `?intent=${intent}` : ''}`;
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [team, setTeam] = useState<string | null>(null);

  useEffect(() => {
    const code = localStorage.getItem(JOIN_CODE_KEY);
    if (code) void supabase.rpc('get_team_invite', { _code: code }).then(({ data }) => setTeam(data?.[0]?.team_name ?? null));
    void supabase.auth.getUser().then(({ data }) => { if (data.user) void navigate({ to: after, replace: true }); });
    const { data } = supabase.auth.onAuthStateChange((event, session) => { if (event === 'SIGNED_IN' && session) void navigate({ to: after, replace: true }); });
    return () => data.subscription.unsubscribe();
  }, [navigate, after]);

  const google = async () => {
    setError(null);
    const result = await lovable.auth.signInWithOAuth('google', { redirect_uri: back });
    if (result.error) setError(t('auth.error'));
  };

  const sendLink = async (event: FormEvent) => {
    event.preventDefault();
    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) { setError(t('auth.invalidEmail')); return; }
    setBusy(true); setError(null);
    const { error: err } = await supabase.auth.signInWithOtp({ email: value, options: { emailRedirectTo: back } });
    setBusy(false);
    if (err) setError(t('auth.error')); else setSentTo(value);
  };

  if (sentTo) return <AuthFrame>
    <div className="auth-icon"><Mail /></div>
    <h1 className="auth-title">{t('auth.checkTitle')}</h1>
    <p className="auth-subtitle">{t('auth.checkText', { email: sentTo })}</p>
    <Button variant="link" className="auth-link" onClick={() => { setSentTo(null); setEmail(''); }}>{t('auth.differentEmail')}</Button>
  </AuthFrame>;

  return <AuthFrame>
    {team && <span className="chip auth-team-chip">{t('auth.joiningTeam', { team })}</span>}
    <h1 className="auth-title">{t('auth.title')}</h1>
    <p className="auth-subtitle">{t('auth.subtitle')}</p>
    <Button className="auth-button" onClick={google}><span className="google-mark"><GoogleMark /></span>{t('auth.google')}</Button>
    <div className="auth-divider"><span>{t('auth.or')}</span></div>
    <form onSubmit={sendLink} className="auth-form" noValidate>
      <label htmlFor="email" className="field-label">{t('auth.email')}</label>
      <Input id="email" type="email" autoComplete="email" inputMode="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={t('auth.emailPlaceholder')} className="field-input" />
      <Button type="submit" variant="secondary" className="auth-button" disabled={busy}>{busy ? t('auth.sending') : t('auth.sendLink')}</Button>
    </form>
    {error && <p className="field-error" role="alert">{error}</p>}
    <p className="auth-note">{t('auth.legalNote')}</p>
    <Button asChild variant="link" className="auth-link"><Link to="/admin-login">{t('auth.adminTitle')}</Link></Button>
  </AuthFrame>;
}
