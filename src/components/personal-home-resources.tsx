import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/launch-states';
import { ChevronRight } from '@/components/icons';
import type { HomeResource } from '@/lib/personal-home';

export function PersonalHomeResources({ resources }: { resources: HomeResource[] }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage === 'es' ? 'es-MX' : 'en-US';
  return <section className="learn-section" aria-labelledby="personal-resources"><div className="section-heading"><h2 id="personal-resources">{t('personalHome.resources')}</h2><Button asChild variant="link"><Link to="/learn">{t('home.viewAll')}</Link></Button></div>
    {!resources.length ? <EmptyState compact icon="BookOpen" text={t('personalHome.noResources')} action={<Button asChild variant="secondary"><Link to="/discover">{t('personalHome.discoverResources')}</Link></Button>} /> : <ul className="customer-list">{resources.map(r => {
      const title = lang === 'es-MX' ? r.title_es || r.title_en : r.title_en;
      const content = <><strong>{title}</strong><small>{r.status === 'draft' ? t('templates.draft') : r.price_cents ? new Intl.NumberFormat(lang, { style: 'currency', currency: 'USD' }).format(r.price_cents / 100) : t('personalHome.free')}</small><ChevronRight /></>;
      return <li key={`${r.entity}:${r.id}`}>{r.entity === 'offer' ? <Link to="/o/$id" params={{ id: r.id }} className="customer-item-head">{content}</Link> : <Link to="/resource/$kind/$id" params={{ kind: r.entity, id: r.id }} className="customer-item-head">{content}</Link>}</li>;
    })}</ul>}
  </section>;
}