import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { LandingFrame } from '@/components/landing/landing-chrome';
import { siteMediaQuery } from '@/lib/site-media';
import i18n from '@/lib/i18n';

export const Route = createFileRoute('/credits')({
  ssr: false,
  head: () => {
    const title = i18n.t('landing.meta.creditsTitle');
    const description = i18n.t('landing.meta.credits');
    return { meta: [{ title }, { name: 'description', content: description }, { property: 'og:title', content: title }, { property: 'og:description', content: description }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] };
  },
  component: CreditsPage,
});

function CreditsPage() {
  const { t, i18n: inst } = useTranslation();
  const { data = [] } = useQuery(siteMediaQuery());
  const es = inst.resolvedLanguage === 'es';
  return <LandingFrame>
    <main className="gw-container gw-credits">
      <h1 className="gw-display gw-h1">{t('landing.credits.title')}</h1>
      <p className="gw-lede">{t('landing.credits.sub')}</p>
      <ul className="gw-credit-list">{data.map(row => <li key={row.id}>
        <span><strong>{es ? row.alt_es : row.alt_en}</strong><small>{row.slot}</small></span>
        <span>{row.credit ?? t('landing.credits.none')}</span>
      </li>)}</ul>
    </main>
  </LandingFrame>;
}
