import type { ReactNode } from 'react';
import { ClientOnly, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import i18n from '@/lib/i18n';

export function setLanguage(language: 'en' | 'es') {
  void i18n.changeLanguage(language);
  localStorage.setItem('gatherwell-language', language);
}

export function LanguageToggle() {
  const { t, i18n: inst } = useTranslation();
  return <div className="segmented auth-language" role="group" aria-label={t('me.language')}>
    {(['en', 'es'] as const).map(lang => <button key={lang} type="button" aria-pressed={inst.resolvedLanguage === lang} className={inst.resolvedLanguage === lang ? 'selected' : ''} onClick={() => setLanguage(lang)}>{t(lang === 'en' ? 'me.english' : 'me.spanish')}</button>)}
  </div>;
}

export function Brand() {
  const { t } = useTranslation();
  return <div className="brand auth-brand"><span className="brand-mark" aria-hidden="true">g</span><span>{t('brand')}</span></div>;
}

export function AuthFrame({ children, footer = true }: { children: ReactNode; footer?: boolean }) {
  return <ClientOnly fallback={<div className="auth-screen" />}><AuthFrameInner footer={footer}>{children}</AuthFrameInner></ClientOnly>;
}

function AuthFrameInner({ children, footer }: { children: ReactNode; footer: boolean }) {
  const { t } = useTranslation();
  return <div className="auth-screen">
    <div className="auth-topbar"><LanguageToggle /></div>
    <main className="auth-card">
      <Brand />
      {children}
    </main>
    {footer && <footer className="auth-footer"><Link to="/terms">{t('auth.terms')}</Link><span aria-hidden="true">·</span><Link to="/privacy">{t('auth.privacy')}</Link></footer>}
  </div>;
}

export function pageHead(titleKey: string, descKey: string) {
  const title = `${i18n.t(titleKey)} · ${i18n.t('brand')}`;
  const description = i18n.t(descKey);
  return { meta: [{ title }, { name: 'description', content: description }, { property: 'og:title', content: title }, { property: 'og:description', content: description }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] };
}

export function LegalPage({ kind }: { kind: 'terms' | 'privacy' }) {
  const { t } = useTranslation();
  return <AuthFrame footer={false}>
    <h1 className="auth-title">{t(kind === 'terms' ? 'legal.termsTitle' : 'legal.privacyTitle')}</h1>
    <p className="auth-subtitle">{t('legal.placeholder')}</p>
    <Link to="/login" className="auth-link">{t('legal.back')}</Link>
  </AuthFrame>;
}
