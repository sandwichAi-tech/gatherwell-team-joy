import { FeatureRoute } from '@/lib/feature-flags';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { OffersManagePage } from '@/components/offers';
import { gatherwellHead } from '@/lib/gatherwell-head';

export const Route = createFileRoute('/_authenticated/_app/offers')({
  validateSearch: z.object({ new: z.string().optional(), mode: z.string().optional() }),
  head: () => gatherwellHead('me', 'offers.title'),
  component: function OffersRoute() {
    const { new: kind, mode } = Route.useSearch();
    const page = <OffersManagePage newKind={kind === 'course' || kind === 'download' ? kind : undefined} mode={mode === 'bundle' ? 'bundle' : undefined} />;
    // Single file resources are part of the launch menu; the full offers/courses manager is not.
    if (kind === 'download' && mode !== 'bundle') return page;
    return <FeatureRoute flag={['feature_selling', 'feature_courses']}>{page}</FeatureRoute>;
  },
});
