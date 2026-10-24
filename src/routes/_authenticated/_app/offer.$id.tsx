import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { OfferPage } from '@/components/offers';
import { gatherwellHead } from '@/lib/gatherwell-head';

export const Route = createFileRoute('/_authenticated/_app/offer/$id')({
  validateSearch: z.object({ paid: z.coerce.number().optional(), panel: z.string().optional() }),
  head: () => gatherwellHead('me'),
  component: function OfferRoute() { const { id } = Route.useParams(); const { paid, panel } = Route.useSearch(); return <OfferPage id={id} paid={!!paid} panel={panel} />; },
});
