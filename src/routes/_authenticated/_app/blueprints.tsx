import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { BlueprintsPage } from '@/components/blueprints-page';
import { templatesQuery } from '@/lib/templates';
import i18n from '@/lib/i18n';

export const Route = createFileRoute('/_authenticated/_app/blueprints')({
  validateSearch: z.object({ create: z.boolean().optional() }),
  loader: ({ context }) => context.queryClient.ensureQueryData(templatesQuery()),
  head: () => {
    const title = `${i18n.t('templates.heading')} · ZoheeWell`; const description = i18n.t('templates.metaDescription');
    return { meta: [{ title }, { name: 'description', content: description }, { property: 'og:title', content: title }, { property: 'og:description', content: description }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' }] };
  },
  component: Page,
});
function Page() { const { create } = Route.useSearch(); return <BlueprintsPage create={create} />; }
