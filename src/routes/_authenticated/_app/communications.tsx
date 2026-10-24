import { createFileRoute } from '@tanstack/react-router';
import i18n from '@/lib/i18n';
import { CommunicationsPage } from '@/components/communications';

export const Route = createFileRoute('/_authenticated/_app/communications')({
  head: () => {
    const title = `${i18n.t('comms.title')} · ${i18n.t('brand')}`;
    const description = i18n.t('comms.subtitle');
    return { meta: [{ title }, { name: 'description', content: description }, { property: 'og:title', content: title }, { property: 'og:description', content: description }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] };
  },
  component: CommunicationsPage,
});
