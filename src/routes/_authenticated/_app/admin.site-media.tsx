import { createFileRoute } from '@tanstack/react-router';
import { SiteMediaAdmin } from '@/components/site-media-admin';
import i18n from '@/lib/i18n';

export const Route = createFileRoute('/_authenticated/_app/admin/site-media')({
  head: () => {
    const title = `${i18n.t('siteMedia.title')} · ${i18n.t('brand')}`;
    const description = i18n.t('siteMedia.subtitle');
    return { meta: [{ title }, { name: 'description', content: description }, { property: 'og:title', content: title }, { property: 'og:description', content: description }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: 'robots', content: 'noindex' }] };
  },
  component: SiteMediaAdmin,
});
