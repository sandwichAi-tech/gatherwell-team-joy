import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { LandingFrame } from '@/components/landing/landing-chrome';
import { CopyButton } from '@/components/copy-button';
import { Button } from '@/components/ui/button';
import type { LegalDoc } from '@/components/auth-frame';
import { canonicalUrl } from '@/lib/seo';
import { LEGAL_CONTACTS, LEGAL_EFFECTIVE_DATE, LEGAL_GROUPS, LEGAL_VERSION, PUBLISHED_LEGAL_DOCS, legalPath, legalTitleKey, sectionId, type LegalCenterDoc } from '@/lib/legal-center';

function useEffective() {
  const { t, i18n } = useTranslation();
  const date = LEGAL_EFFECTIVE_DATE
    ? new Intl.DateTimeFormat(i18n.resolvedLanguage === 'es' ? 'es-419' : 'en-US', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(LEGAL_EFFECTIVE_DATE))
    : t('legalCenter.datePending');
  return { short: t('legalCenter.effectiveShort', { date, version: LEGAL_VERSION }), long: t('legalCenter.effectiveLong', { date, version: LEGAL_VERSION }) };
}

function DocLink({ doc, children, className }: { doc: LegalCenterDoc; children: React.ReactNode; className?: string }) {
  if (doc === 'terms') return <Link to="/terms" className={className}>{children}</Link>;
  if (doc === 'privacy') return <Link to="/privacy" className={className}>{children}</Link>;
  return <Link to="/legal/$doc" params={{ doc }} className={className}>{children}</Link>;
}

export function LegalCenterPage() {
  const { t } = useTranslation();
  const eff = useEffective();
  return <LandingFrame>
    <main id="main-content" className="legal-center">
      <header className="legal-center-head">
        <h1>{t('legalCenter.title')}</h1>
        <p>{t('legalCenter.intro')}</p>
      </header>
      <section className="legal-card legal-company" aria-labelledby="legal-company">
        <h2 id="legal-company">{t('legalCenter.company')}</h2>
        <p>{t('legalCenter.companyLine')}</p>
        <p className="legal-muted">{t('legalCenter.addressPending')}</p>
        <ul className="legal-contacts">
          {LEGAL_CONTACTS.map(c => <li key={c}><a href={`mailto:${c}@zoheewell.com`}><span>{t(`legalCenter.contacts.${c}`)}</span><span className="legal-muted">{c}@zoheewell.com</span></a></li>)}
        </ul>
      </section>
      {LEGAL_GROUPS.map(g => <section key={g.id} className="legal-group" aria-labelledby={`legal-group-${g.id}`}>
        <h2 id={`legal-group-${g.id}`}>{t(`legalCenter.groups.${g.id}`)}</h2>
        <ul className="legal-grid">
          {g.docs.map(doc => {
            const published = PUBLISHED_LEGAL_DOCS.includes(doc);
            const body = <><strong>{t(legalTitleKey(doc))}</strong><span>{t(`legalCenter.summaries.${doc}`)}</span><small>{published ? eff.short : t('legalCenter.notPublished')}</small></>;
            return <li key={doc}>{published ? <DocLink doc={doc} className="legal-card legal-doc-card">{body}</DocLink> : <div className="legal-card legal-doc-card is-pending">{body}</div>}</li>;
          })}
        </ul>
      </section>)}
    </main>
  </LandingFrame>;
}

export function LegalDocument({ kind }: { kind: LegalDoc }) {
  const { t } = useTranslation();
  const eff = useEffective();
  const sections = t(`legalDocs.docs.${kind}.sections`, { returnObjects: true }) as { h: string; p: string }[];
  const list = Array.isArray(sections) ? sections : [];
  const toc = <ol>{list.map((s, i) => <li key={s.h}><a href={`#${sectionId(i)}`}>{s.h}</a></li>)}</ol>;
  return <LandingFrame>
    <main id="main-content" className="legal-doc">
      <div className="legal-print-mark" aria-hidden="true">{t('brand')}</div>
      <aside className="legal-toc no-print" aria-label={t('legalCenter.onThisPage')}>
        <details className="legal-toc-mobile"><summary>{t('legalCenter.onThisPage')}</summary>{toc}</details>
        <nav className="legal-toc-desktop"><h2>{t('legalCenter.onThisPage')}</h2>{toc}</nav>
      </aside>
      <article className="legal-article">
        <header className="legal-doc-head">
          <span className="chip sample-badge">{t('legalDocs.draft')}</span>
          <h1>{t(`legalDocs.docs.${kind}.title`)}</h1>
          <p>{eff.long}</p>
          <p className="legal-muted">{t('legalDocs.updated')}</p>
          <div className="legal-actions no-print">
            <Button type="button" variant="secondary" onClick={() => window.print()}>{t('legalCenter.print')}</Button>
            <CopyButton text={canonicalUrl(legalPath(kind))} label={t('legalCenter.copyLink')} />
          </div>
        </header>
        <div className="legal-text">
          {list.map((s, i) => <section key={s.h} id={sectionId(i)}>
            <h2>{s.h} <a className="legal-anchor no-print" href={`#${sectionId(i)}`} aria-label={t('legalCenter.linkTo', { section: s.h })}>#</a></h2>
            <p>{s.p}</p>
          </section>)}
        </div>
        <footer className="legal-doc-foot no-print">
          <p>{t('legalCenter.questions')} <a href="mailto:legal@zoheewell.com">legal@zoheewell.com</a></p>
          <nav aria-label={t('legalDocs.more')} className="legal-links">
            {PUBLISHED_LEGAL_DOCS.filter(d => d !== kind).map(d => <DocLink key={d} doc={d}>{t(legalTitleKey(d))}</DocLink>)}
          </nav>
          <Link to="/legal" className="legal-back">{t('legalCenter.back')}</Link>
        </footer>
      </article>
    </main>
  </LandingFrame>;
}
