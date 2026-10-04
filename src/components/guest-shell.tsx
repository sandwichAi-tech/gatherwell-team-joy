import type { ReactNode } from 'react';
import { ClientOnly, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Brand, LanguageToggle } from '@/components/auth-frame';

/** Public guest pages render client-only so browser-detected language never mismatches hydration. */
export function GuestShell({ children }: { children: ReactNode }) {
  return <ClientOnly fallback={<div className="guest-screen" />}><GuestShellInner>{children}</GuestShellInner></ClientOnly>;
}

function GuestShellInner({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  return <div className="guest-screen">
    <header className="guest-topbar"><Brand /><LanguageToggle /></header>
    <main className="guest-main">{children}</main>
    <footer className="guest-footer"><Link to="/login">{t('guest.hostYourOwn')}</Link></footer>
  </div>;
}

