import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { OffersManagePage } from '@/components/offers';
import { gatherwellHead } from '@/lib/gatherwell-head';

export const Route = createFileRoute('/_authenticated/_app/offers')({
  validateSearch: z.object({ new: z.string().optional(), mode: z.string().optional() }),
  head: () => gatherwellHead('me', 'offers.title'),
  component: function OffersRoute() {
    const { new: kind, mode } = Route.useSearch();
    return <OffersManagePage newKind={kind === 'course' || kind === 'download' ? kind : undefined} mode={mode === 'bundle' ? 'bundle' : undefined} />;
  },
});
