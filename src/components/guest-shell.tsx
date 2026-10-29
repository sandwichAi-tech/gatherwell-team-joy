import { useEffect, type ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Brand } from '@/components/auth-frame';
import { NavLanguage } from '@/components/landing/landing-chrome';
import { QueryFeedback } from '@/components/launch-states';
import { applySavedLanguage } from '@/lib/i18n';

/** Public guest pages server-render in English; the saved language applies once this page has hydrated. */
export function GuestShell({ children }: { children: ReactNode }) {
  useEffect(() => { applySavedLanguage(); }, []);
  return <GuestShellInner>{children}</GuestShellInner>;
}

function GuestShellInner({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  return <div className="guest-screen">
    <header className="guest-topbar"><Brand /><NavLanguage /></header>
    <main id="main-content" className="guest-main"><QueryFeedback />{children}</main>
    <footer className="guest-footer"><Link to="/login">{t('guest.hostYourOwn')}</Link></footer>
  </div>;
}

