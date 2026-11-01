import { createFileRoute } from '@tanstack/react-router';
import { queryOptions, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { LandingFrame } from '@/components/landing/landing-chrome';
import { Button } from '@/components/ui/button';
import { LegalMarkdown } from '@/lib/legal-markdown';
import { legalHead } from '@/lib/legal-head';

type AgreementText = { id: string; version: number; locale: string; body: string; sha256: string; effective_from: string } | null;

export const platformAgreementQuery = (locale: 'en' | 'es') => queryOptions({
  queryKey: ['platform-agreement-text', locale],
  queryFn: async () => {
    const { data, error } = await supabase.rpc('platform_agreement_text', { _locale: locale });
    if (error) throw error;
    return (data ?? null) as AgreementText;
  },
});

export const Route = createFileRoute('/legal/platform-agreement')({
  validateSearch: (s: Record<string, unknown>): { lang?: 'es' } => (s.lang === 'es' ? { lang: 'es' } : {}),
  head: () => legalHead('eventAgreements.title', 'legalAgreement.metaDesc', '/legal/platform-agreement'),
  component: PlatformAgreementPage,
});

function PlatformAgreementPage() {
  const { t, i18n } = useTranslation();
  const { lang } = Route.useSearch();
  const locale: 'en' | 'es' = lang === 'es' || i18n.resolvedLanguage === 'es' ? 'es' : 'en';
  const q = useQuery(platformAgreementQuery(locale));
  return <LandingFrame>
    <main id="main-content" className="legal-doc legal-agreement">
      <article className="legal-article legal-md" aria-busy={q.isPending}>
        {q.isPending ? <p role="status">{t('publicEvent.loading')}</p>
          : q.isError ? <div role="alert"><p>{t('legalAgreement.loadFailed')}</p><Button type="button" variant="secondary" onClick={() => q.refetch()}>{t('legalAgreement.retry')}</Button></div>
          : !q.data ? <p role="status">{t('legalAgreement.unavailable')}</p>
          : <>
            <p className="legal-muted">{t('legalAgreement.versionLine', { version: q.data.version })}</p>
            <LegalMarkdown source={q.data.body} />
            <div className="legal-actions no-print"><Button type="button" variant="secondary" onClick={() => window.print()}>{t('legalCenter.print')}</Button></div>
          </>}
      </article>
    </main>
  </LandingFrame>;
}
