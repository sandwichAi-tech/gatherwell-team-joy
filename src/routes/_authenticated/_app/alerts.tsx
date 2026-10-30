import { FeatureRoute } from '@/lib/feature-flags';
import { createFileRoute } from '@tanstack/react-router';
import { AlertsPage } from '@/components/alerts';
import { gatherwellHead } from '@/lib/gatherwell-head';

export const Route = createFileRoute('/_authenticated/_app/alerts')({
  head: () => {
    const base = gatherwellHead('me');
    return { ...base, meta: [...base.meta, { name: 'robots', content: 'noindex, nofollow' }] };
  },
  component: () => <FeatureRoute flag="feature_alerts"><AlertsPage /></FeatureRoute>,
});
