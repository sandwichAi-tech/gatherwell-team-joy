import { createFileRoute, notFound } from '@tanstack/react-router';
import { z } from 'zod';
import { ADMIN_TABS, AdminConsole } from '@/components/admin-console';
import i18n from '@/lib/i18n';
import { getAdminAccess } from '@/lib/admin.functions';
import { Button } from '@/components/ui/button';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/_authenticated/_app/admin/')({
  validateSearch: z.object({ tab: z.enum(ADMIN_TABS).catch('overview').default('overview') }),
  beforeLoad: async () => { const access = await getAdminAccess(); if (!access.admin) throw notFound(); },
  notFoundComponent: AdminUnavailable,
  head: () => {
    const title = `${i18n.t('admin.title')} · ${i18n.t('brand')}`;
    const description = i18n.t('admin.subtitle');
    return { meta: [{ title }, { name: 'description', content: description }, { property: 'og:title', content: title }, { property: 'og:description', content: description }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: 'robots', content: 'noindex' }] };
  },
  component: AdminPage,
});

function AdminPage() {
  const { tab } = Route.useSearch();
  return <AdminConsole tab={tab} />;
}

function AdminUnavailable() {
  const { t } = useTranslation();
  return <section className="empty-panel"><h1>{t('admin.deniedTitle')}</h1><p>{t('admin.deniedBody')}</p><Button asChild variant="secondary"><Link to="/home">{t('admin.backHome')}</Link></Button></section>;
}
