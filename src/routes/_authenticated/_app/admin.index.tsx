import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { ADMIN_TABS, AdminConsole } from '@/components/admin-console';
import i18n from '@/lib/i18n';

export const Route = createFileRoute('/_authenticated/_app/admin/')({
  validateSearch: z.object({ tab: z.enum(ADMIN_TABS).catch('overview').default('overview') }),
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
