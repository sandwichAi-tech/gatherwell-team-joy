import type { ReactNode } from 'react';
import { ClientOnly, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import i18n, { SPANISH_ENABLED } from '@/lib/i18n';
import { ListSkeleton } from '@/components/launch-states';

export function setLanguage(language: 'en' | 'es') {
  void i18n.changeLanguage(language);
  localStorage.setItem('gatherwell-language', language);
}

export function LanguageToggle() {
  const { t, i18n: inst } = useTranslation();
  if (!SPANISH_ENABLED) return null;
  return <div className="segmented auth-language" role="group" aria-label={t('me.language')}>
    {(['en', 'es'] as const).map(lang => <button key={lang} type="button" aria-pressed={inst.resolvedLanguage === lang} className={inst.resolvedLanguage === lang ? 'selected' : ''} onClick={() => setLanguage(lang)}>{t(lang === 'en' ? 'me.english' : 'me.spanish')}</button>)}
  </div>;
}

export function Brand() {
  const { t } = useTranslation();
  return <div className="brand auth-brand"><span className="brand-mark" aria-hidden="true">g</span><span>{t('brand')}</span></div>;
}

export function AuthFrame({ children, footer = true }: { children: ReactNode; footer?: boolean }) {
  return <ClientOnly fallback={<div className="auth-screen"><ListSkeleton /></div>}><AuthFrameInner footer={footer}>{children}</AuthFrameInner></ClientOnly>;
}

function AuthFrameInner({ children, footer }: { children: ReactNode; footer: boolean }) {
  const { t } = useTranslation();
  return <div className="auth-screen">
    <div className="auth-topbar"><LanguageToggle /></div>
    <main id="main-content" className="auth-card">
      <Brand />
      {children}
    </main>
    {footer && <footer className="auth-footer"><Link to="/terms">{t('auth.terms')}</Link><span aria-hidden="true">·</span><Link to="/privacy">{t('auth.privacy')}</Link><span aria-hidden="true">·</span><Link to="/legal/$doc" params={{ doc: 'cookies' }}>{t('legalDocs.docs.cookies.title')}</Link></footer>}
  </div>;
}

export function pageHead(titleKey: string, descKey: string) {
  const title = `${i18n.t(titleKey)} · ${i18n.t('brand')}`;
  const description = i18n.t(descKey);
  return { meta: [{ title }, { name: 'description', content: description }, { property: 'og:title', content: title }, { property: 'og:description', content: description }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] };
}

export const LEGAL_DOCS = ['terms', 'privacy', 'host', 'guest', 'sms', 'cookies'] as const;
export type LegalDoc = (typeof LEGAL_DOCS)[number];

export function LegalPage({ kind }: { kind: LegalDoc }) {
  const { t } = useTranslation();
  const sections = t(`legalDocs.docs.${kind}.sections`, { returnObjects: true }) as { h: string; p: string }[];
  return <AuthFrame>
    <span className="chip sample-badge">{t('legalDocs.draft')}</span>
    <h1 className="auth-title">{t(`legalDocs.docs.${kind}.title`)}</h1>
    <p className="auth-subtitle">{t('legalDocs.updated')}</p>
    <div className="legal-body">{Array.isArray(sections) && sections.map(s => <section key={s.h}><h2>{s.h}</h2><p>{s.p}</p></section>)}</div>
    <nav className="legal-links" aria-label={t('legalDocs.more')}>{LEGAL_DOCS.filter(d => d !== kind).map(d => <Link key={d} to="/legal/$doc" params={{ doc: d }}>{t(`legalDocs.docs.${d}.title`)}</Link>)}</nav>
    <button type="button" className="auth-link" onClick={() => history.back()}>{t('legalDocs.back')}</button>
  </AuthFrame>;
}
