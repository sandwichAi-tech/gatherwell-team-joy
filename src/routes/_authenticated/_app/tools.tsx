import { createFileRoute } from '@tanstack/react-router';
import i18n from '@/lib/i18n';
import { ToolsPage } from '@/components/tools-page';
import { RetryState } from '@/components/launch-states';
import { NOINDEX_META } from '@/lib/seo';

export const Route = createFileRoute('/_authenticated/_app/tools')({
  head: () => {
    const title = `${i18n.t('toolsPage.title')} · ${i18n.t('brand')}`;
    const description = i18n.t('toolsPage.subtitle');
    return { meta: [{ title }, { name: 'description', content: description }, { property: 'og:title', content: title }, { property: 'og:description', content: description }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { ...NOINDEX_META }] };
  },
  component: ToolsPage,
  errorComponent: ({ reset }) => <RetryState retry={reset} />,
});
